// How a Workspace maps onto MongoDB documents, and back. Pure functions, no
// database access, so the mapping is tested on its own.
//
// The app keeps a workspace as one nested object. The server splits it:
//
//   tracks       one document per track: its configuration, with phases,
//                materials, rotations and the rest *embedded*. They're small,
//                always read and written with the track, and merged per item.
//   completions  one document per track per day (the bucket pattern): which
//                tasks and revisions were ticked, and the day's
//                accomplishments. History grows forever, so it can't live in
//                the track document (16 MB cap), and ticking one box shouldn't
//                rewrite the whole track.
//
// On the client, per-day progress is spread over four maps keyed by date,
// two of them keyed again by id or title. Here each day becomes an array of
// items, so free-text titles end up as *values*, never as field names.

import type { CompletedItem, DayCompletions, TrackState, Workspace } from "../../types";
import { rebuildStreakHistory } from "../../streak";

/** Progress fields that live in `completions`, plus flags only the device
 *  cares about. Everything else on a track is stored in its document.
 *  (mergeAppState stamps the sync flags onto each track as well as the
 *  workspace, so merged data carries them per track.) */
const NOT_IN_TRACK_DOC = [
  "weeklyCompletions",
  "itemUpdatedAt",
  "completedItemsHistory",
  "historyUpdatedAt",
  "streakHistory",
  "isSynced",
  "hasUnsyncedChanges",
  "lastSyncTime",
  "isReset",
] as const;

type TrackConfig = Omit<TrackState, Extract<(typeof NOT_IN_TRACK_DOC)[number], keyof TrackState>>;

/** A track document, minus what the store adds (`_id`, `userId`, `updatedAt`). */
export type StoredTrack = TrackConfig & { trackId: string; schemaVersion: number; configVersion: number };

/** One tick box's state on one day. `updatedAt` 0 means "no timestamp"
 *  (data older than per-item timestamps). A box unticked later is kept with
 *  `done: false` so the merge knows it was unticked, and when. */
export interface ItemState {
  id: string;
  done: boolean;
  updatedAt: number;
}

export interface Accomplishment {
  title: string;
  description?: string;
  /** Stored as a plain string by older versions; kept so it round-trips. */
  plain?: boolean;
  done: boolean;
  updatedAt: number;
}

/** A completions document, minus `_id`, `userId` and `updatedAt`. */
export interface StoredDay {
  trackId: string;
  date: string;
  tasks: ItemState[];
  revisions: ItemState[];
  accomplishments: Accomplishment[];
}

const itemStates = (present: string[], stamps: Record<string, number>, prefix: string): ItemState[] => {
  const ids = [...present];
  for (const key of Object.keys(stamps)) {
    const itemId = key.startsWith(prefix) ? key.slice(prefix.length) : null;
    if (itemId && !ids.includes(itemId)) ids.push(itemId);
  }
  return ids.map((itemId) => ({ id: itemId, done: present.includes(itemId), updatedAt: stamps[`${prefix}${itemId}`] ?? 0 }));
};

const accomplishments = (items: CompletedItem[], stamps: Record<string, number>): Accomplishment[] => {
  const result: Accomplishment[] = items.map((item) =>
    typeof item === "string"
      ? { title: item, plain: true, done: true, updatedAt: stamps[item] ?? 0 }
      : {
          title: item.title,
          ...(item.description !== undefined ? { description: item.description } : {}),
          done: true,
          updatedAt: stamps[item.title] ?? 0,
        }
  );
  for (const [title, updatedAt] of Object.entries(stamps)) {
    if (!result.some((a) => a.title === title)) result.push({ title, done: false, updatedAt });
  }
  return result;
};

/** Splits a workspace into track and completion documents. */
export function splitWorkspace(workspace: Workspace): { tracks: StoredTrack[]; days: StoredDay[] } {
  const tracks: StoredTrack[] = [];
  const days: StoredDay[] = [];
  const schemaVersion = workspace.schemaVersion ?? 0;

  for (const [trackId, track] of Object.entries(workspace.tracks)) {
    const config: Record<string, unknown> = { ...track };
    for (const field of NOT_IN_TRACK_DOC) delete config[field];
    tracks.push({ ...(config as TrackConfig), trackId, schemaVersion, configVersion: track.configVersion ?? 0 });

    const dates = new Set([
      ...Object.keys(track.weeklyCompletions ?? {}),
      ...Object.keys(track.itemUpdatedAt ?? {}),
      ...Object.keys(track.completedItemsHistory ?? {}),
      ...Object.keys(track.historyUpdatedAt ?? {}),
    ]);
    for (const date of [...dates].sort()) {
      const ticked: DayCompletions = track.weeklyCompletions?.[date] ?? { tasks: [], revisions: [] };
      const stamps = track.itemUpdatedAt?.[date] ?? {};
      const day: StoredDay = {
        trackId,
        date,
        tasks: itemStates(ticked.tasks ?? [], stamps, "t:"),
        revisions: itemStates(ticked.revisions ?? [], stamps, "r:"),
        accomplishments: accomplishments(track.completedItemsHistory?.[date] ?? [], track.historyUpdatedAt?.[date] ?? {}),
      };
      // A day with nothing in it carries no information; don't store it.
      if (day.tasks.length || day.revisions.length || day.accomplishments.length) days.push(day);
    }
  }
  return { tracks, days };
}

/** Rebuilds a workspace from its documents. */
export function assembleWorkspace(tracks: StoredTrack[], days: StoredDay[], activeTrackId: string | undefined): Workspace {
  const byTrack = new Map<string, StoredDay[]>();
  for (const day of days) {
    if (!byTrack.has(day.trackId)) byTrack.set(day.trackId, []);
    byTrack.get(day.trackId)!.push(day);
  }

  const assembled: Record<string, TrackState> = {};
  for (const stored of tracks) {
    const { trackId, schemaVersion: _schemaVersion, ...config } = stored;
    void _schemaVersion;
    const weeklyCompletions: TrackState["weeklyCompletions"] = {};
    const itemUpdatedAt: Record<string, Record<string, number>> = {};
    const completedItemsHistory: TrackState["completedItemsHistory"] = {};
    const historyUpdatedAt: Record<string, Record<string, number>> = {};

    for (const day of byTrack.get(trackId) ?? []) {
      weeklyCompletions[day.date] = {
        tasks: day.tasks.filter((t) => t.done).map((t) => t.id),
        revisions: day.revisions.filter((r) => r.done).map((r) => r.id),
      };
      const stamps: Record<string, number> = {};
      for (const t of day.tasks) if (t.updatedAt) stamps[`t:${t.id}`] = t.updatedAt;
      for (const r of day.revisions) if (r.updatedAt) stamps[`r:${r.id}`] = r.updatedAt;
      itemUpdatedAt[day.date] = stamps;

      completedItemsHistory[day.date] = day.accomplishments
        .filter((a) => a.done)
        .map((a) => (a.plain ? a.title : a.description !== undefined ? { title: a.title, description: a.description } : { title: a.title }));
      const titleStamps: Record<string, number> = {};
      for (const a of day.accomplishments) if (a.updatedAt) titleStamps[a.title] = a.updatedAt;
      historyUpdatedAt[day.date] = titleStamps;
    }

    assembled[trackId] = {
      ...(config as TrackConfig),
      weeklyCompletions,
      itemUpdatedAt,
      completedItemsHistory,
      historyUpdatedAt,
      // Derived, never stored: it's a function of the accomplishments.
      streakHistory: rebuildStreakHistory(completedItemsHistory),
      isSynced: true,
    } as TrackState;
  }

  const ids = Object.keys(assembled);
  return {
    activeTrackId: activeTrackId && assembled[activeTrackId] ? activeTrackId : (ids[0] ?? ""),
    tracks: assembled,
    // The lowest version any track was stored at: the migration pipeline
    // replays from there, and its steps are idempotent.
    schemaVersion: tracks.length ? Math.min(...tracks.map((t) => t.schemaVersion)) : 0,
    isSynced: true,
  };
}

/**
 * Pulls timestamps from the future back to `now` plus a small allowance
 * (threat T3). Last-write-wins trusts timestamps: a device whose clock runs
 * a day fast would otherwise win every merge for a day, and a crafted request
 * could win them forever.
 */
export function clampWorkspace(workspace: Workspace, now: number, allowanceMs = 5 * 60 * 1000): Workspace {
  const limit = now + allowanceMs;
  const clampMap = (map: Record<string, Record<string, number>> | undefined) =>
    map &&
    Object.fromEntries(
      Object.entries(map).map(([date, stamps]) => [
        date,
        Object.fromEntries(Object.entries(stamps).map(([key, ts]) => [key, Math.min(ts, limit)])),
      ])
    );

  const tracks: Record<string, TrackState> = {};
  for (const [trackId, track] of Object.entries(workspace.tracks)) {
    tracks[trackId] = {
      ...track,
      ...(track.itemUpdatedAt ? { itemUpdatedAt: clampMap(track.itemUpdatedAt) } : {}),
      ...(track.historyUpdatedAt ? { historyUpdatedAt: clampMap(track.historyUpdatedAt) } : {}),
      ...(track.materials
        ? {
            materials: track.materials.map((m) =>
              m.updatedAt !== undefined && m.updatedAt > limit ? { ...m, updatedAt: limit } : m
            ),
          }
        : {}),
    };
  }
  return { ...workspace, tracks };
}

/** Marks a workspace as freshly synced, the way mergeWorkspace does. */
export const markSynced = (workspace: Workspace, now: number): Workspace => ({
  ...workspace,
  isSynced: true,
  hasUnsyncedChanges: false,
  lastSyncTime: now,
});

/** JSON with object keys sorted, so two documents built by different code
 *  paths compare equal when their contents are. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
