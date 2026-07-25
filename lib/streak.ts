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

/** Length of the current consecutive-day streak ending today (or yesterday, so
 *  a day not yet worked doesn't instantly zero an otherwise-live streak).
 *  Counts back one calendar day at a time from the anchor while each date is
 *  present in the history set. Dates are "YYYY-MM-DD" in local time. */
export function currentStreakLength(streakHistory: string[] = [], todayStr: string): number {
  if (!todayStr) return 0;
  const days = new Set(streakHistory);

  // Anchor on today if it's already been worked, otherwise on yesterday — an
  // untouched today shouldn't reset a streak the user is still mid-day on.
  const cursor = new Date(`${todayStr}T00:00:00`);
  if (!days.has(todayStr)) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  const asYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  while (days.has(asYMD(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
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
