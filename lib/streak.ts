import type { AppState, CompletedItem } from "./types";

export function completedItemTitle(it: CompletedItem): string {
  return typeof it === "string" ? it : it.title;
}

/** Dates that have at least one recorded accomplishment. */
export function rebuildStreakHistory(completedItemsHistory: Record<string, CompletedItem[]>): string[] {
  return Object.keys(completedItemsHistory).filter(
    (date) => completedItemsHistory[date] && completedItemsHistory[date].length > 0
  );
}

interface StreakFields {
  streakHistory: string[];
  completedItemsHistory: Record<string, CompletedItem[]>;
}

/** Record an accomplishment for a date: appends to the day's history and refreshes the streak. */
export function addCompletion(data: AppState, dateStr: string, title: string, description: string = ""): StreakFields {
  const completedItemsHistory = { ...(data.completedItemsHistory || {}) };
  const items = completedItemsHistory[dateStr] || [];

  if (!items.some((it) => completedItemTitle(it) === title)) {
    completedItemsHistory[dateStr] = [...items, { title, description }];
  }
  return { streakHistory: rebuildStreakHistory(completedItemsHistory), completedItemsHistory };
}

/** Undo an accomplishment for a date. */
export function removeCompletion(data: AppState, dateStr: string, title: string): StreakFields {
  const completedItemsHistory = { ...(data.completedItemsHistory || {}) };
  const items = completedItemsHistory[dateStr] || [];

  completedItemsHistory[dateStr] = items.filter((it) => completedItemTitle(it) !== title);
  return { streakHistory: rebuildStreakHistory(completedItemsHistory), completedItemsHistory };
}
