// The one place that reads and writes the stored workspace. Everything that
// needs workspace data goes through here, so migrations, edit-counter
// bookkeeping and the Dexie record shape all live behind a single door.

import { db } from "./localDb";
import type { TrackId, TrackState, Workspace } from "./types";
import { CURRENT_SCHEMA_VERSION, migrateWorkspace } from "./migrations";
import { completedItemTitle } from "./streak";
import { visibleTracks } from "./selectors";
import { blankTrack } from "./templates";
import { applyDailyResetIfNeeded } from "./dailyReset";

/** Stamps `now` onto `${prefix}${id}` for every id whose presence in `newIds`
 *  differs from `oldIds`, so a later per-item merge (lib/merge.ts) knows
 *  exactly which items changed on this device and when. */
const stampChangedIds = (
  existing: Record<string, number>,
  oldIds: string[],
  newIds: string[],
  prefix: string,
  now: number
): { map: Record<string, number>; changed: boolean } => {
  const allIds = new Set([...oldIds, ...newIds]);
  let changed = false;
  let map = existing;
  allIds.forEach((id) => {
    if (oldIds.includes(id) !== newIds.includes(id)) {
      if (map === existing) map = { ...existing };
      map[`${prefix}${id}`] = now;
      changed = true;
    }
  });
  return { map, changed };
};

/**
 * Track fields that are *not* structural config — progress data that
 * lib/merge.ts reconciles per item, plus sync bookkeeping this module owns.
 * Everything else on a track counts as config, and editing it bumps
 * `configVersion` so the "higher side wins" rule protects it during a merge.
 *
 * Deliberately an exclusion list rather than an inclusion list: forgetting to
 * add a new structural field would silently lose edits to it in a merge,
 * whereas forgetting to exclude a new progress field only over-bumps a
 * counter. The safe default is therefore "new field = config".
 *
 * `dailyTasks`/`dailyRevisionItems` are excluded on purpose: ticking today's
 * checkbox rewrites them, and that must not let one device's whole structural
 * config win just because it checked a box more recently.
 */
const NON_CONFIG_FIELDS: ReadonlySet<string> = new Set<keyof TrackState>([
  "streakHistory",
  "completedItemsHistory",
  "weeklyCompletions",
  "dailyTasks",
  "dailyRevisionItems",
  "lastTasksResetDate",
  "itemUpdatedAt",
  "historyUpdatedAt",
  "isSynced",
  "configVersion",
  // Legacy fields nothing reads or writes anymore.
  "dailyFocus",
  "dailyStudyPoints",
  "studyStreak",
  "lastDailyRoutineCheck",
]);

const configChangedBetween = (oldTrack: Partial<TrackState>, newTrack: TrackState): boolean => {
  const fields = new Set([...Object.keys(oldTrack), ...Object.keys(newTrack)]);
  for (const field of fields) {
    if (NON_CONFIG_FIELDS.has(field)) continue;
    const key = field as keyof TrackState;
    if (JSON.stringify(oldTrack[key]) !== JSON.stringify(newTrack[key])) return true;
  }
  return false;
};

/** Per-track edit-counter/config-version bookkeeping — the same algorithm the
 *  app has always used, just scoped to one track's slice instead of the
 *  whole saved record. Drives lib/merge.ts's per-item and structural merge. */
export const applyTrackBookkeeping = (
  oldTrack: TrackState | undefined,
  newTrack: TrackState,
  isReset: boolean
): { track: TrackState; changed: boolean } => {
  const oldData: Partial<TrackState> = oldTrack || {};
  const now = Date.now();

  const itemUpdatedAt: Record<string, Record<string, number>> = { ...(oldData.itemUpdatedAt || {}) };
  const oldComps = oldData.weeklyCompletions || {};
  const newComps = newTrack.weeklyCompletions || {};
  const allDates = Array.from(new Set([...Object.keys(oldComps), ...Object.keys(newComps)]));

  let hasChanges = false;
  allDates.forEach((date) => {
    const oldVal = oldComps[date] || { tasks: [], revisions: [] };
    const newVal = newComps[date] || { tasks: [], revisions: [] };
    const { map: afterTasks, changed: tasksChanged } = stampChangedIds(
      itemUpdatedAt[date] || {}, oldVal.tasks || [], newVal.tasks || [], "t:", now
    );
    const { map: afterRevs, changed: revsChanged } = stampChangedIds(
      afterTasks, oldVal.revisions || [], newVal.revisions || [], "r:", now
    );
    if (tasksChanged || revsChanged) {
      itemUpdatedAt[date] = afterRevs;
      hasChanges = true;
    }
  });

  const historyUpdatedAt: Record<string, Record<string, number>> = { ...(oldData.historyUpdatedAt || {}) };
  const oldHist = oldData.completedItemsHistory || {};
  const newHist = newTrack.completedItemsHistory || {};
  const allHistDates = Array.from(new Set([...Object.keys(oldHist), ...Object.keys(newHist)]));
  allHistDates.forEach((date) => {
    const oldTitles = (oldHist[date] || []).map(completedItemTitle);
    const newTitles = (newHist[date] || []).map(completedItemTitle);
    const { map, changed } = stampChangedIds(historyUpdatedAt[date] || {}, oldTitles, newTitles, "", now);
    if (changed) {
      historyUpdatedAt[date] = map;
      hasChanges = true;
    }
  });

  const track: TrackState = { ...newTrack, itemUpdatedAt, historyUpdatedAt };

  if (isReset) {
    // System-initiated daily reset: don't bump configVersion, so this save
    // doesn't accidentally win version conflicts against other devices.
    track.configVersion = oldData.configVersion || 0;
    return { track, changed: hasChanges };
  }

  const configChanged = configChangedBetween(oldData, newTrack);
  track.configVersion = configChanged ? (oldData.configVersion || 0) + 1 : (oldData.configVersion || 0);

  return { track, changed: configChanged || hasChanges };
};

/** Fresh install: an empty workspace. The provider gives it a starter track on
 *  load (see ensureStarterTrack below). */
const buildEmptyWorkspace = (): Workspace => ({
  activeTrackId: "",
  tracks: {},
  schemaVersion: CURRENT_SCHEMA_VERSION,
});

/** Reads the stored workspace, bringing it up to the current schema first. */
export const fetchWorkspace = async (): Promise<Workspace> => {
  try {
    const record = await db.workspace.get("current");
    if (!record) {
      const empty = buildEmptyWorkspace();
      await db.workspace.put({ id: "current", data: empty });
      return empty;
    }

    const { workspace, changed } = migrateWorkspace(record.data);
    if (changed) {
      await db.workspace.put({ id: "current", data: workspace });
    }
    return workspace;
  } catch (error) {
    console.error("fetchWorkspace local error:", error);
    throw error;
  }
};

/** Writes a workspace verbatim, with no bookkeeping — for the sync engine,
 *  which has already decided exactly what the record should contain. */
export const putWorkspace = async (workspace: Workspace): Promise<void> => {
  await db.workspace.put({ id: "current", data: workspace });
};

/** Saves a user-initiated change: runs each track's edit bookkeeping, then
 *  persists. Pass `isReset` on the workspace for system-initiated writes
 *  (the daily reset) that must not bump any configVersion. */
export const updateWorkspace = async (newWorkspace: Workspace): Promise<{ success: true }> => {
  try {
    const record = await db.workspace.get("current");
    const oldWorkspace = record?.data;
    const isReset = !!newWorkspace.isReset;

    let anyChanged = false;
    const tracks: Record<TrackId, TrackState> = {};
    Object.entries(newWorkspace.tracks).forEach(([id, track]) => {
      const { track: bookkept, changed } = applyTrackBookkeeping(oldWorkspace?.tracks?.[id], track, isReset);
      tracks[id] = bookkept;
      if (changed) anyChanged = true;
    });

    const finalWorkspace: Workspace = { ...newWorkspace, tracks };
    delete finalWorkspace.isReset;

    if (isReset) {
      finalWorkspace.hasUnsyncedChanges = newWorkspace.hasUnsyncedChanges ?? oldWorkspace?.hasUnsyncedChanges ?? false;
    } else if (anyChanged) {
      finalWorkspace.hasUnsyncedChanges = true;
    } else if (finalWorkspace.hasUnsyncedChanges === undefined) {
      finalWorkspace.hasUnsyncedChanges = oldWorkspace?.hasUnsyncedChanges ?? false;
    }

    // `isSynced` only ever turns on here. The first real edit sets it: from
    // then on this device's data is worth keeping, so a Drive sync merges it
    // instead of replacing it with the Drive copy (ensureStarterTrack has the
    // case this protects). The caller's copy may predate that write, so it
    // must never switch the stored flag back off.
    if ((anyChanged && !isReset) || oldWorkspace?.isSynced) {
      finalWorkspace.isSynced = true;
    }

    await putWorkspace(finalWorkspace);
    return { success: true };
  } catch (error) {
    console.error("updateWorkspace local error:", error);
    throw error;
  }
};

export const createTrack = async (track: TrackState): Promise<void> => {
  const ws = await fetchWorkspace();
  const nextWorkspace: Workspace = {
    ...ws,
    tracks: { ...ws.tracks, [track.meta.id]: track },
    activeTrackId: track.meta.id,
    // A track the user asked for is real local data. Mark the workspace synced
    // so the first Sync takes the merge path — otherwise syncWithGoogleDrive's
    // "unsynced: overwrite local with remote" branch would discard this track
    // when the Drive account already holds data from another device.
    isSynced: true,
  };
  await putWorkspace(nextWorkspace);
};

/**
 * First run, or every track archived: adds a blank track so the app opens
 * straight onto a usable dashboard. Transactional and idempotent, so React
 * running the load effect twice, or two open tabs, can't add two.
 *
 * It leaves `isSynced` as it was. On a fresh install that means unset, so if
 * this device is then connected to a Drive that already holds tracks, the
 * first sync replaces the untouched starter with the real data instead of
 * merging a stray "My Track" into it. The first real edit sets `isSynced`
 * (see updateWorkspace), so nothing the user actually wrote is ever replaced.
 */
export const ensureStarterTrack = async (today: string): Promise<Workspace> =>
  db.transaction("rw", db.workspace, async () => {
    const ws = await fetchWorkspace();
    if (visibleTracks(ws).length > 0) return ws;

    const { data: starter } = applyDailyResetIfNeeded(blankTrack("My Track", today), today);
    const next: Workspace = {
      ...ws,
      tracks: { ...ws.tracks, [starter.meta.id]: starter },
      activeTrackId: starter.meta.id,
    };
    await putWorkspace(next);
    return next;
  });
