// The one place that reads and writes the stored workspace. Everything that
// needs workspace data goes through here, so migrations, edit-counter
// bookkeeping and the Dexie record shape all live behind a single door.

import { db } from "./localDb";
import type { TrackId, TrackState, Workspace } from "./types";
import { CURRENT_SCHEMA_VERSION, migrateWorkspace } from "./migrations";
import { applyTrackBookkeeping } from "./bookkeeping";
import { visibleTracks } from "./selectors";
import { blankTrack } from "./templates";
import { applyDailyResetIfNeeded } from "./dailyReset";

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
 *  (the daily reset) that must not bump any configVersion.
 *
 *  Returns whether the stored workspace now has unsynced changes: only this
 *  save can tell (it compares with what was stored), and the header's sync
 *  status needs to know. */
export const updateWorkspace = async (
  newWorkspace: Workspace
): Promise<{ success: true; hasUnsyncedChanges: boolean }> => {
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
    // then on this device's data is worth keeping, so a sync merges it
    // instead of replacing it with the account's copy (ensureStarterTrack has the
    // case this protects). The caller's copy may predate that write, so it
    // must never switch the stored flag back off.
    if ((anyChanged && !isReset) || oldWorkspace?.isSynced) {
      finalWorkspace.isSynced = true;
    }

    await putWorkspace(finalWorkspace);
    return { success: true, hasUnsyncedChanges: !!finalWorkspace.hasUnsyncedChanges };
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
    // so the first Sync takes the merge path — otherwise the sync engine's
    // "unsynced: overwrite local with remote" branch would discard this track
    // when the account already holds data from another device.
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
 * this device is then signed in to an account that already holds tracks, the
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
