// Ticking a checkbox on this dashboard is not a one-field write: it has to
// keep the day's completion id set, the accomplishment history that feeds the
// streak graph, the derived streak, and (for stored items) the item's own
// `completed` flag all consistent. That combination used to be hand-rolled at
// six separate call sites in WeeklyPlan and ScheduleDayModal, with small
// divergences between them.
//
// These functions are the single implementation. All pure — they take a track
// and return a new one, mutating nothing, so callers can hand the result
// straight to an optimistic setState.

import type { CompletedItem, DateStr, DayCompletions, DayKey, RevisionItem, TaskItem, TrackState } from "./types";
import { completedItemTitle, rebuildStreakHistory } from "./streak";

/** Which of a day's two checklists an item belongs to. */
export type ItemKind = "revision" | "focus";

const COMPLETION_FIELD = { revision: "revisions", focus: "tasks" } as const;

export interface DayItemRef {
  /** Calendar date ("YYYY-MM-DD") the completion is recorded against. This is
   *  the date the streak graph and weeklyCompletions are keyed by — not
   *  necessarily today, since past and future days are editable. */
  dateStr: DateStr;
  kind: ItemKind;
  id: string;
  title: string;
  description?: string;
  /** Day-of-week key ("Mon".."Sun") of the stored list holding this item.
   *  Omit it for rotation-generated items, which are recomputed from the
   *  rotation definition on every render and have no stored record to keep
   *  in sync. */
  dayKey?: DayKey;
}

/** Replaces one date's completion-id sets, leaving every other date alone. */
const withDayCompletions = (
  track: TrackState,
  dateStr: DateStr,
  update: (day: DayCompletions) => DayCompletions
): Record<DateStr, DayCompletions> => {
  const all = { ...(track.weeklyCompletions || {}) };
  const existing = all[dateStr] || { tasks: [], revisions: [] };
  all[dateStr] = update({ tasks: [...(existing.tasks || [])], revisions: [...(existing.revisions || [])] });
  return all;
};

/** Replaces one date's accomplishment list, leaving every other date alone. */
const withHistory = (
  track: TrackState,
  dateStr: DateStr,
  update: (items: CompletedItem[]) => CompletedItem[]
): Record<DateStr, CompletedItem[]> => {
  const all = { ...(track.completedItemsHistory || {}) };
  all[dateStr] = update(all[dateStr] || []);
  return all;
};

/** Syncs the stored item's own `completed` flag, for items that have one. */
const storedFlagPatch = (track: TrackState, item: DayItemRef, completed: boolean): Partial<TrackState> => {
  if (!item.dayKey) return {};
  const flip = <T extends { id: string; completed: boolean }>(list: T[]): T[] =>
    list.map((it) => (it.id === item.id ? { ...it, completed } : it));

  if (item.kind === "revision") {
    const byDay = track.dailyRevisionItems || {};
    return { dailyRevisionItems: { ...byDay, [item.dayKey]: flip(byDay[item.dayKey] || []) } };
  }
  const byDay = track.dailyTasks || {};
  return { dailyTasks: { ...byDay, [item.dayKey]: flip(byDay[item.dayKey] || []) } };
};

/**
 * Records or clears one item's completion for a date, keeping the day's
 * completion ids, the accomplishment history, the streak and the stored
 * item flag in step.
 *
 * The history is keyed by title rather than id on purpose — material and
 * portfolio completions land in the same list and have no day-item id at
 * all, and lib/merge.ts reconciles it per title across devices.
 */
export function setItemCompletion(track: TrackState, item: DayItemRef, completed: boolean): TrackState {
  const field = COMPLETION_FIELD[item.kind];

  const weeklyCompletions = withDayCompletions(track, item.dateStr, (day) => ({
    ...day,
    [field]: completed
      ? day[field].includes(item.id)
        ? day[field]
        : [...day[field], item.id]
      : day[field].filter((id) => id !== item.id),
  }));

  const completedItemsHistory = withHistory(track, item.dateStr, (items) =>
    completed
      ? items.some((it) => completedItemTitle(it) === item.title)
        ? items
        : [...items, { title: item.title, description: item.description || "" }]
      : items.filter((it) => completedItemTitle(it) !== item.title)
  );

  return {
    ...track,
    ...storedFlagPatch(track, item, completed),
    weeklyCompletions,
    completedItemsHistory,
    streakHistory: rebuildStreakHistory(completedItemsHistory),
  };
}

/** Whether an item currently counts as completed for a date. */
export function isItemCompleted(track: TrackState, dateStr: DateStr, kind: ItemKind, id: string): boolean {
  return (track.weeklyCompletions?.[dateStr]?.[COMPLETION_FIELD[kind]] || []).includes(id);
}

/** Adds a manually-created item to a day's checklist. */
export function addDayItem(
  track: TrackState,
  dayKey: DayKey,
  kind: ItemKind,
  fields: { title: string; description?: string }
): TrackState {
  const title = fields.title.trim();
  if (!title) return track;

  if (kind === "revision") {
    const item: RevisionItem = {
      id: `rev_${Date.now()}`,
      title,
      description: fields.description?.trim() || "",
      completed: false,
    };
    const byDay = track.dailyRevisionItems || {};
    return { ...track, dailyRevisionItems: { ...byDay, [dayKey]: [...(byDay[dayKey] || []), item] } };
  }

  const item: TaskItem = { id: `task_${Date.now()}`, title, description: fields.description?.trim() || "", completed: false };
  const byDay = track.dailyTasks || {};
  return { ...track, dailyTasks: { ...byDay, [dayKey]: [...(byDay[dayKey] || []), item] } };
}

/** Edits a stored item's text in place. */
export function updateDayItem(
  track: TrackState,
  dayKey: DayKey,
  kind: ItemKind,
  id: string,
  fields: { title?: string; description?: string }
): TrackState {
  if (kind === "revision") {
    const byDay = track.dailyRevisionItems || {};
    const next = (byDay[dayKey] || []).map((it) => (it.id === id ? { ...it, ...fields } : it));
    return { ...track, dailyRevisionItems: { ...byDay, [dayKey]: next } };
  }
  const byDay = track.dailyTasks || {};
  const next = (byDay[dayKey] || []).map((it) => (it.id === id ? { ...it, ...fields } : it));
  return { ...track, dailyTasks: { ...byDay, [dayKey]: next } };
}

/** Deletes a manually-added item, first clearing any completion it recorded so
 *  the day's history and streak don't keep counting something that's gone. */
export function removeDayItem(track: TrackState, item: DayItemRef & { dayKey: DayKey }): TrackState {
  const cleared = setItemCompletion(track, item, false);

  if (item.kind === "revision") {
    const byDay = cleared.dailyRevisionItems || {};
    const next = (byDay[item.dayKey] || []).filter((it) => it.id !== item.id);
    return { ...cleared, dailyRevisionItems: { ...byDay, [item.dayKey]: next } };
  }
  const byDay = cleared.dailyTasks || {};
  const next = (byDay[item.dayKey] || []).filter((it) => it.id !== item.id);
  return { ...cleared, dailyTasks: { ...byDay, [item.dayKey]: next } };
}
