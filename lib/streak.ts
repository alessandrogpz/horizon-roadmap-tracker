import type { AppState, CompletedItem } from "./types";

export function completedItemTitle(it: CompletedItem): string {
  return typeof it === "string" ? it : it.title;
}

interface StreakFields {
  streakHistory: string[];
  completedItemsHistory: Record<string, CompletedItem[]>;
}

/** Record an accomplishment for a date: marks the streak and appends to the day's history. */
export function addCompletion(data: AppState, dateStr: string, title: string, description: string = ""): StreakFields {
  const streakHistory = [...(data.streakHistory || [])];
  const completedItemsHistory = { ...(data.completedItemsHistory || {}) };
  const items = completedItemsHistory[dateStr] || [];

  streakHistory.push(dateStr);
  if (!items.some((it) => completedItemTitle(it) === title)) {
    completedItemsHistory[dateStr] = [...items, { title, description }];
  }
  return { streakHistory, completedItemsHistory };
}

/** Undo an accomplishment for a date. */
export function removeCompletion(data: AppState, dateStr: string, title: string): StreakFields {
  const streakHistory = [...(data.streakHistory || [])];
  const completedItemsHistory = { ...(data.completedItemsHistory || {}) };
  const items = completedItemsHistory[dateStr] || [];

  const idx = streakHistory.indexOf(dateStr);
  if (idx > -1) streakHistory.splice(idx, 1);
  completedItemsHistory[dateStr] = items.filter((it) => completedItemTitle(it) !== title);
  return { streakHistory, completedItemsHistory };
}
