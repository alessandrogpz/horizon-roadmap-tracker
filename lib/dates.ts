// Shared date helpers. All dates are handled in local time and serialized as
// "YYYY-MM-DD" to avoid timezone shifts from Date.toISOString().

export const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayYMD(): string {
  return formatDateYMD(new Date());
}

/** Parse a "YYYY-MM-DD" string as a local-midnight Date. */
export function parseYMD(dateStr: string): Date {
  const parts = dateStr.split("-");
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getMondayOfDateWeek(date: Date): Date {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** 1-based curriculum week number for targetDate, counted from the Monday of startDate's week. */
export function getWeekNum(startDateStr: string, targetDate: Date = new Date()): number {
  if (!startDateStr) return 1;
  const startMonday = getMondayOfDateWeek(parseYMD(startDateStr));

  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - startMonday.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return Math.floor(diffDays / 7) + 1;
}

/** Calendar date ("YYYY-MM-DD") of a day name (Mon..Sun) in the week `offset` weeks from the current one. */
export function getDateForDayName(dayName: string, offset: number = 0): string {
  const dayNameToIndex: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const targetDayIndex = dayNameToIndex[dayName] ?? 0;
  const currentMonday = getMondayOfDateWeek(new Date());
  const mondayOfTargetWeek = new Date(currentMonday);
  mondayOfTargetWeek.setDate(currentMonday.getDate() + offset * 7);
  const diff = targetDayIndex === 0 ? 6 : targetDayIndex - 1; // Mon=0 .. Sun=6
  const targetDate = new Date(mondayOfTargetWeek);
  targetDate.setDate(mondayOfTargetWeek.getDate() + diff);
  return formatDateYMD(targetDate);
}

/** Calendar date of 1-based curriculum day `n`, counted from startDate — so
 *  day 1 *is* the start date. Inverse of `dayForDate`, and consistent with
 *  `daysSince` below, which is what `Phase.recommendedByDay` is compared
 *  against. Uses setDate rather than millisecond arithmetic so it stays
 *  correct across daylight-saving boundaries. */
export function dateForDay(startDateStr: string, n: number): Date {
  const d = parseYMD(startDateStr);
  d.setDate(d.getDate() + n - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 1-based curriculum day number of a "YYYY-MM-DD" date. Inverse of
 *  `dateForDay`. Rounds rather than floors so a DST shift (which makes the
 *  span 23 or 25 hours) can't drop a day. */
export function dayForDate(startDateStr: string, dateStr: string): number {
  const start = parseYMD(startDateStr);
  const target = parseYMD(dateStr);
  return Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/** Compact human-readable form used for phase deadlines, e.g. "31 Aug 2026". */
export function formatDayMonthYear(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** 1-based day count from startDate (inclusive), never below 1. */
export function daysSince(startDateStr: string): number {
  const start = parseYMD(startDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays) + 1;
}
