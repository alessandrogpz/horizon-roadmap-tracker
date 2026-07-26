// Pure, read-only summaries of a track, for the header's stat detail panels.
// No React, no I/O — everything here is derived from a TrackState plus "what
// day is it", so each shape is testable on its own.

import type { Material, Phase, TrackState } from "./types";
import { currentStreakLength, completedItemTitle } from "./streak";
import { dateForDay, dayForDate, daysSince, formatDateYMD, parseYMD } from "./dates";
import { trackTotalDays, recommendedPhaseId } from "./trackActions";

const asYMD = (d: Date) => formatDateYMD(d);

/** Count of dates in `history` within the last `days` days ending at `todayStr`. */
const activeWithin = (history: Set<string>, todayStr: string, days: number): number => {
  const cursor = parseYMD(todayStr);
  let count = 0;
  for (let i = 0; i < days; i += 1) {
    if (history.has(asYMD(cursor))) count += 1;
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

export function streakStats(track: TrackState, todayStr: string): StreakStats {
  const history = [...new Set(track.streakHistory || [])].sort();
  const set = new Set(history);

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of history) {
    if (previous) {
      const expected = parseYMD(previous);
      expected.setDate(expected.getDate() + 1);
      run = asYMD(expected) === date ? run + 1 : 1;
    } else {
      run = 1;
    }
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
    current: currentStreakLength(history, todayStr),
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
 * One cell per day from the track's start (aligned back to the preceding
 * Sunday, so weeks read as columns) up to today, with how many accomplishments
 * landed on it. The shape the streak grid renders, kept here so the component
 * stays presentational.
 */
export interface StreakDay {
  /** "" for the leading/trailing cells that only pad a week out to seven. */
  date: string;
  count: number;
}

export function streakCalendar(track: TrackState, todayStr: string): StreakDay[] {
  if (!track.startDate) return [];
  const counts: Record<string, number> = {};
  Object.entries(track.completedItemsHistory || {}).forEach(([date, items]) => {
    counts[date] = items?.length || 0;
  });

  const cursor = parseYMD(track.startDate);
  cursor.setDate(cursor.getDate() - cursor.getDay()); // back to Sunday
  const today = parseYMD(todayStr);

  const days: StreakDay[] = [];
  while (cursor <= today) {
    const date = asYMD(cursor);
    days.push({ date, count: counts[date] || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  while (days.length % 7 !== 0) days.push({ date: "", count: 0 });
  return days;
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

  const phaseStart = track.currentPhaseStartDate || track.startDate;
  const dayInPhase = phaseStart ? Math.max(1, dayForDate(phaseStart, todayStr)) : 0;

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
