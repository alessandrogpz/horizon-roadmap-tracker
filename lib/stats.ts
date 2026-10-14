// Pure, read-only summaries of a track, for the header's stat detail panels.
// No React, no I/O — everything here is derived from a TrackState plus "what
// day is it", so each shape is testable on its own.

import type { CompletedItem, Material, Phase, TrackState } from "./types";
import { completedItemTitle } from "./streak";
import { bridges, restScheduleOf, streakWithRest, type RestOn } from "./restDays";
import { dateForDay, dayForDate, daysSince, formatDateYMD, parseYMD } from "./dates";
import { trackTotalDays, recommendedPhaseId } from "./trackActions";

/** Count of dates in `history` within the last `days` days ending at `todayStr`. */
const activeWithin = (history: Set<string>, todayStr: string, days: number): number => {
  const cursor = parseYMD(todayStr);
  let count = 0;
  for (let i = 0; i < days; i += 1) {
    if (history.has(formatDateYMD(cursor))) count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
};

// --- Streak ------------------------------------------------------------

export interface StreakStats {
  current: number;
  /** Longest consecutive run anywhere in the history. */
  longest: number;
  /** Days with at least one recorded accomplishment. */
  activeDays: number;
  activeLast30: number;
  /** Every accomplishment ever recorded, not just the days they fell on. */
  totalAccomplishments: number;
  /** Share of days since the track started that were active, 0-100. */
  consistencyPct: number;
  /** Most recent active days, newest first. */
  recent: { date: string; titles: string[] }[];
}

export function streakStats(
  track: TrackState,
  todayStr: string,
  /** The days off to step over, by date. Defaults to the track's own; a view
   *  that combines several passes the days *all* of them had off, because a
   *  day one track was supposed to work on is not a day off. */
  rest: RestOn = restScheduleOf(track)
): StreakStats {
  const history = [...new Set(track.streakHistory || [])].sort();
  const set = new Set(history);

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of history) {
    run = previous && bridges(previous, date, rest) ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  const completedHistory = track.completedItemsHistory || {};
  const totalAccomplishments = Object.values(completedHistory).reduce(
    (sum, items) => sum + (items?.length || 0),
    0
  );

  const elapsed = track.startDate ? daysSince(track.startDate) : 0;

  return {
    current: streakWithRest(history, todayStr, rest),
    longest,
    activeDays: history.length,
    activeLast30: activeWithin(set, todayStr, 30),
    totalAccomplishments,
    consistencyPct: elapsed > 0 ? Math.min(100, (history.length / elapsed) * 100) : 0,
    recent: history
      .slice(-5)
      .reverse()
      .map((date) => ({
        date,
        titles: (completedHistory[date] || []).map(completedItemTitle),
      })),
  };
}

/**
 * One cell per day from the track's start (aligned back to the start of that
 * week, so weeks read as columns) up to today, with how many accomplishments
 * landed on it. The shape the streak grid renders, kept here so the component
 * stays presentational.
 */
export interface StreakDay {
  /** "" for the leading/trailing cells that only pad a week out to seven. */
  date: string;
  count: number;
}

export function streakCalendar(
  track: Pick<TrackState, "startDate" | "completedItemsHistory">,
  todayStr: string,
  weekStartsOn: "sun" | "mon" = "sun"
): StreakDay[] {
  if (!track.startDate) return [];
  const counts: Record<string, number> = {};
  Object.entries(track.completedItemsHistory || {}).forEach(([date, items]) => {
    counts[date] = items?.length || 0;
  });

  const cursor = parseYMD(track.startDate);
  // Back to the first day of the track's opening week, so every column holds
  // one whole week and the rows mean the same weekday all the way across.
  const offsetToWeekStart = weekStartsOn === "mon" ? (cursor.getDay() + 6) % 7 : cursor.getDay();
  cursor.setDate(cursor.getDate() - offsetToWeekStart);
  const today = parseYMD(todayStr);

  const days: StreakDay[] = [];
  while (cursor <= today) {
    const date = formatDateYMD(cursor);
    days.push({ date, count: counts[date] || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  while (days.length % 7 !== 0) days.push({ date: "", count: 0 });
  return days;
}

/**
 * One calendar year of days, padded out to whole weeks at both ends.
 *
 * Unlike `streakCalendar`, which runs from a track's own start to today and so
 * grows as the track does, this is a fixed shape you can step through a year
 * at a time — and a shape that is the same for every track, which is what lets
 * several be stacked with their columns lining up.
 *
 * Days outside the track's life are blank rather than zero: the track did not
 * exist to be missed, and neither does tomorrow. The year is also capped at
 * today, so the current one does not open on three months of empty December.
 */
export function yearCalendar(
  history: Record<string, CompletedItem[]>,
  startDate: string,
  year: number,
  todayStr: string,
  weekStartsOn: "sun" | "mon" = "sun"
): StreakDay[] {
  if (!startDate) return [];
  const counts: Record<string, number> = {};
  Object.entries(history).forEach(([date, items]) => {
    counts[date] = items?.length ?? 0;
  });

  const cursor = new Date(year, 0, 1);
  const offset = weekStartsOn === "mon" ? (cursor.getDay() + 6) % 7 : cursor.getDay();
  cursor.setDate(cursor.getDate() - offset);
  const lastDay = new Date(year, 11, 31);
  const now = parseYMD(todayStr);
  const end = lastDay < now ? lastDay : now;

  const out: StreakDay[] = [];
  while (cursor <= end) {
    const date = formatDateYMD(cursor);
    const lived = date >= startDate && date <= todayStr;
    out.push({ date: lived ? date : "", count: lived ? counts[date] ?? 0 : 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  while (out.length % 7 !== 0) out.push({ date: "", count: 0 });
  return out;
}

/** One month of a year, as a block that starts on the right weekday. */
export interface MonthBlock {
  key: string;
  label: string;
  /** `null` for the leading cells that push the 1st under its weekday, and for
   *  days outside the track's own life. */
  cells: (StreakDay | null)[];
}

/**
 * A year broken into months, each block padded so the 1st lands under the
 * right weekday.
 *
 * The continuous shape — one unbroken ribbon of weeks — is good for seeing a
 * long run at a glance and bad for reading a month out of, because nothing
 * marks where one ends. Both apps offer the two, and both default to this one.
 *
 * Months with nothing in range are dropped rather than drawn: in the year a
 * track began there can be eleven of them, which is eleven headings over
 * blocks of empty squares before the first real day.
 */
export function monthCalendar(
  history: Record<string, CompletedItem[]>,
  startDate: string,
  year: number,
  todayStr: string,
  weekStartsOn: "sun" | "mon" = "sun"
): MonthBlock[] {
  if (!startDate) return [];
  const counts: Record<string, number> = {};
  Object.entries(history).forEach(([date, items]) => {
    counts[date] = items?.length ?? 0;
  });

  const blocks: MonthBlock[] = [];
  const now = parseYMD(todayStr);
  // Months that have not happened yet are not months of this track's year.
  const stop = year === now.getFullYear() ? now.getMonth() : 11;

  for (let month = 0; month <= stop; month += 1) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    const offset = weekStartsOn === "mon" ? (firstWeekday + 6) % 7 : firstWeekday;
    const cells: (StreakDay | null)[] = Array.from({ length: offset }, () => null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      // Days outside the track's own life are left blank rather than drawn as
      // zeroes: the track did not exist to be missed.
      const lived = date >= startDate && date <= todayStr;
      cells.push(lived ? { date, count: counts[date] ?? 0 } : null);
    }

    if (cells.some((cell) => cell)) {
      blocks.push({ key: `${year}-${month}`, label: `${MONTH_NAMES[month]} ${year}`, cells });
    }
  }

  return blocks;
}

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The scale an all-tracks year is drawn against: a year of empty days, how
 * many week-columns that is, and where each month's name belongs.
 *
 * Built from the calendar rather than from any track, because a row that began
 * yesterday would name one month, place it at the far end, and be wrong above
 * every other row. Both apps hang their stacked years on this, and they used
 * to build it — and the month-label logic under it — a line at a time each.
 */
export function yearRuler(
  year: number,
  todayStr: string,
  weekStartsOn: "sun" | "mon" = "sun"
): { days: StreakDay[]; columns: number; marks: { month: number; column: number }[] } {
  const days = yearCalendar({}, `${year}-01-01`, year, todayStr, weekStartsOn);
  return { days, columns: Math.ceil(days.length / 7), marks: monthMarks(days) };
}

/**
 * Where to write each month's name along a year of columns.
 *
 * One mark per month, at the column its first real day falls in, and dropped
 * when it would land on top of the one before it — at this zoom a month is
 * about four columns, and a three-letter name is wider than that only where a
 * month is cut short by the start of the year or by today.
 */
function monthMarks(days: StreakDay[]): { month: number; column: number }[] {
  const marks: { month: number; column: number }[] = [];
  let seen = -1;
  for (let column = 0; column * 7 < days.length; column += 1) {
    const anchor = days.slice(column * 7, column * 7 + 7).find((day) => day.date);
    if (!anchor) continue;
    const month = parseYMD(anchor.date).getMonth();
    if (month === seen) continue;
    seen = month;
    if (marks.length > 0 && column - marks[marks.length - 1].column < 3) continue;
    marks.push({ month, column });
  }
  return marks;
}

/** The years a track has anything to show for, from its first to the one we
 *  are in — so a stepper cannot offer a 2019 the track never had. */
export function yearsWithHistory(
  history: Record<string, CompletedItem[]>,
  startDate: string,
  todayStr: string
): { first: number; last: number } {
  const now = parseYMD(todayStr).getFullYear();
  const dates = Object.keys(history);
  if (startDate) dates.push(startDate);
  const earliest = dates.reduce((low, date) => Math.min(low, Number(date.slice(0, 4))), now);
  return { first: earliest, last: now };
}

// --- Timeline ----------------------------------------------------------

export interface PhaseWindow {
  phase: Phase;
  /** 1-based curriculum day the phase opens on, and the day it's due by. */
  startDay: number;
  endDay?: number;
  startDate: Date;
  endDate?: Date;
  state: "done" | "current" | "upcoming";
}

export interface TimelineStats {
  daysPassed: number;
  totalDays: number;
  progressPct: number;
  daysRemaining: number;
  /**
   * Days past the planned total, or 0 while the track is still inside it.
   *
   * A track outliving its estimate is the ordinary case, not a failure: plans
   * are guesses and the guess is usually short. Without this the only thing a
   * display could say was "Day 573 of 92" over a bar pinned at full, which
   * reads as a track that has gone wrong rather than one that is simply still
   * going.
   */
  overrunDays: number;
  startDate: Date;
  endDate: Date;
  windows: PhaseWindow[];
}

export function timelineStats(track: TrackState): TimelineStats {
  const daysPassed = track.startDate ? daysSince(track.startDate) : 0;
  const totalDays = trackTotalDays(track);

  let openingDay = 1;
  const windows: PhaseWindow[] = track.phases.map((phase) => {
    const startDay = openingDay;
    const endDay = phase.recommendedByDay;
    if (endDay !== undefined) openingDay = endDay + 1;
    return {
      phase,
      startDay,
      endDay,
      startDate: dateForDay(track.startDate, startDay),
      endDate: endDay !== undefined ? dateForDay(track.startDate, endDay) : undefined,
      state:
        phase.id === track.currentPhase
          ? "current"
          : phase.id < track.currentPhase
            ? "done"
            : "upcoming",
    };
  });

  return {
    daysPassed,
    totalDays,
    progressPct: totalDays > 0 ? Math.min(100, (daysPassed / totalDays) * 100) : 0,
    daysRemaining: Math.max(0, totalDays - daysPassed),
    overrunDays: Math.max(0, daysPassed - totalDays),
    startDate: dateForDay(track.startDate, 1),
    endDate: dateForDay(track.startDate, totalDays),
    windows,
  };
}

// --- Current phase -----------------------------------------------------

export interface PhaseStats {
  phase: Phase | null;
  window: PhaseWindow | null;
  /** 1-based day within the current phase. */
  dayInPhase: number;
  /** Length of the phase in days, when it has a deadline. */
  phaseLength?: number;
  daysLeft?: number;
  phasePct?: number;
  tasksDone: number;
  tasksTotal: number;
  /** The phase the schedule expects today, when it differs from the current one. */
  behindBy: number;
  recommendedPhase: Phase | null;
}

export function phaseStats(track: TrackState, todayStr: string): PhaseStats {
  const timeline = timelineStats(track);
  const window = timeline.windows.find((w) => w.phase.id === track.currentPhase) || null;
  const phase = window?.phase || null;

  // Time spent in this phase, not time since last entering it: whatever was
  // banked when the phase was previously left, plus the stretch running now.
  const phaseStart = track.currentPhaseStartDate || track.startDate;
  const banked = track.phaseDaysSpent?.[String(track.currentPhase)] ?? 0;
  const dayInPhase = phaseStart ? banked + Math.max(1, dayForDate(phaseStart, todayStr)) : banked;

  const tasks = phase?.tasks || [];
  const recommendedId = recommendedPhaseId(track, timeline.daysPassed);
  const recommendedPhase = track.phases.find((p) => p.id === recommendedId) || null;

  const phaseLength =
    window?.endDay !== undefined ? window.endDay - window.startDay + 1 : undefined;
  const dayOfWindow = timeline.daysPassed - (window?.startDay ?? 1) + 1;

  return {
    phase,
    window,
    dayInPhase,
    phaseLength,
    daysLeft:
      window?.endDay !== undefined ? Math.max(0, window.endDay - timeline.daysPassed) : undefined,
    phasePct:
      phaseLength !== undefined
        ? Math.max(0, Math.min(100, (dayOfWindow / phaseLength) * 100))
        : undefined,
    tasksDone: tasks.filter((t) => t.completed).length,
    tasksTotal: tasks.length,
    behindBy: Math.max(0, recommendedId - track.currentPhase),
    recommendedPhase,
  };
}

// --- Overall progress --------------------------------------------------

export interface ProgressBreakdown {
  label: string;
  done: number;
  total: number;
  pct: number;
}

export interface ProgressStats {
  /** Elapsed share of the horizon — how much of the *time* is spent. */
  timePct: number;
  /** Completed share of the actual work — phases, tasks, deliverables, materials. */
  workPct: number;
  /** workPct - timePct: positive is ahead of the calendar, negative behind. */
  paceDelta: number;
  breakdown: ProgressBreakdown[];
}

/** A material counts as done only when it's explicitly Completed. */
const isMaterialComplete = (m: Material) => (m.status || "").toLowerCase() === "completed";

export function progressStats(track: TrackState): ProgressStats {
  const timeline = timelineStats(track);

  const phasesDone = track.phases.filter((p) => p.id < track.currentPhase).length;
  const allTasks = track.phases.flatMap((p) => p.tasks || []);
  const portfolio = track.portfolio || [];
  const materials = track.materials || [];

  const parts: ProgressBreakdown[] = [
    { label: "Phases", done: phasesDone, total: track.phases.length },
    { label: "Phase tasks", done: allTasks.filter((t) => t.completed).length, total: allTasks.length },
    { label: "Deliverables", done: portfolio.filter((p) => p.completed).length, total: portfolio.length },
    { label: "Materials", done: materials.filter(isMaterialComplete).length, total: materials.length },
  ].map((part) => ({ ...part, pct: part.total > 0 ? (part.done / part.total) * 100 : 0 }));

  // Weight every dimension that actually has items in it equally, so a track
  // with no portfolio isn't permanently capped below 100%.
  const counted = parts.filter((p) => p.total > 0);
  const workPct = counted.length > 0
    ? counted.reduce((sum, p) => sum + p.pct, 0) / counted.length
    : 0;

  return {
    timePct: timeline.progressPct,
    workPct,
    paceDelta: workPct - timeline.progressPct,
    breakdown: parts,
  };
}
