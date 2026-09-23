// Edit bookkeeping: the timestamps and version counters that let two devices
// merge instead of overwrite.
//
// This is the quiet half of every edit. `setItemCompletion` decides what the new
// state *is*; this decides what a later merge can *tell* about it — which items
// changed on this device, and when. Without it an untick is indistinguishable
// from "never ticked", so the other device's timestamped copy wins and the tick
// comes back. That was exactly the phone's bug before it called this.
//
// It lives apart from workspaceRepo because it is pure: no Dexie, no browser,
// nothing platform-specific. The website and the Android app both run it, which
// is the point — two copies of a merge rule are two rules.

import type { TrackState } from "./types";
import { completedItemTitle } from "./streak";

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
