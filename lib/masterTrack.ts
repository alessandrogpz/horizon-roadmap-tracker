// Every track at once, read-only.
//
// A workspace with six tracks answers six questions well and the seventh one —
// "what am I actually doing, across all of it?" — not at all. The master view
// is that seventh answer: the same dashboard, the same panels, built from
// every track you have not switched off.
//
// Three rules shape everything in here.
//
// 1. **It is read-only, and that is structural rather than a flag.** Nothing
//    in this module returns a `TrackState`, and nothing in it produces an
//    editable shape. There is no master track on disk, nothing to save and
//    nothing to merge, which is the only way to be sure that editing the
//    aggregate can never mean editing six real tracks by accident.
//
// 2. **Everything keeps the colour of the track it came from.** An aggregate
//    whose rows all look the same is a list you cannot read. Every item, every
//    phase, every day carries its track's colour and name back with it.
//
// 3. **Averages are weighted by the length of the goal.** A ninety-day track
//    at 50% and a three-year track at 50% are not the same amount of work, and
//    a plain mean would say they were.

import type { Material, Phase, PortfolioProject, TrackMeta, TrackState } from "./types";
import { formatDateYMD, getDateForDayName, getWeekNum, parseYMD } from "./dates";
import { monthCalendar, progressStats, timelineStats, yearCalendar, type MonthBlock, type StreakDay } from "./stats";
import { computeRotationItemsForDay } from "./rotation";
import { isRestType, longestStreakWithRest, restScheduleOf, restWeekdays, streakWithRest, type RestOn } from "./restDays";
import { trackTotalDays } from "./trackActions";

/** What a track contributed to one day. */
export interface DayPart {
  trackId: string;
  name: string;
  color: string;
  count: number;
}

/** One day of the master grid: what every track did on it. */
export interface MasterDay {
  /** "" for the cells that only pad a week or a month out. */
  date: string;
  /** Everything recorded that day, across every included track. */
  count: number;
  /** One entry per track that did something, in list order. */
  parts: DayPart[];
}

export interface MasterMonth {
  key: string;
  label: string;
  cells: (MasterDay | null)[];
}

/** An item, and which track it belongs to. */
export interface Owned<T> {
  track: TrackMeta;
  item: T;
}

export interface MasterPhase {
  track: TrackMeta;
  phase: Phase;
  /** When it opens and, when the track gives it a deadline, when it is due. */
  startDate: Date;
  endDate?: Date;
  state: "done" | "current" | "upcoming";
}

/** One weekday, across every track: what each one calls it, and what its
 *  rotations put on it. */
export interface MasterWeekDay {
  /** "Mon" … "Sun". */
  name: string;
  /** The date this weekday falls on in the week being viewed. */
  date: string;
  entries: {
    track: TrackMeta;
    /** What the track calls this day — "Push", "Rest", "Study". */
    label: string;
    /** Whether the track has this day off. */
    rest: boolean;
    /** The rotation items this track puts on this day, in this week. */
    rotations: { label: string; title: string; description?: string }[];
  }[];
}

export interface MasterProgress {
  /** Elapsed share of every horizon, weighted by how long each one is. */
  timePct: number;
  /** Completed share of the actual work, weighted the same way. */
  workPct: number;
  /** workPct − timePct: positive is ahead of the calendar. */
  paceDelta: number;
  /** Every track's planned length, added up. */
  totalDays: number;
  /** How many tracks it is averaging over. */
  count: number;
}

export interface MasterStreak {
  /** A day counts if *any* included track did something on it. */
  current: number;
  longest: number;
  activeDays: number;
  activeLast30: number;
  totalAccomplishments: number;
}

/** The earliest day any of them began — the first day there was anything to
 *  miss. An older track's days are not blanks on a younger one's account. */
export function masterStart(tracks: TrackState[]): string {
  return tracks.reduce((earliest, track) => {
    if (!track.startDate) return earliest;
    return !earliest || track.startDate < earliest ? track.startDate : earliest;
  }, "");
}

/** Which dates each track has something on, and how much. */
function countsByTrack(tracks: TrackState[]): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  for (const track of tracks) {
    const counts: Record<string, number> = {};
    for (const [date, items] of Object.entries(track.completedItemsHistory ?? {})) {
      if (items?.length) counts[date] = items.length;
    }
    out.set(track.meta.id, counts);
  }
  return out;
}

/** Turns one date into a day of the master grid. A track only contributes on
 *  days it was alive for, so a track started in June leaves May alone rather
 *  than reading as six weeks of nothing from it. */
function dayFor(date: string, tracks: TrackState[], counts: Map<string, Record<string, number>>, todayStr: string): MasterDay {
  const parts: DayPart[] = [];
  let total = 0;
  for (const track of tracks) {
    if (!track.startDate || date < track.startDate || date > todayStr) continue;
    const count = counts.get(track.meta.id)?.[date] ?? 0;
    if (count <= 0) continue;
    parts.push({ trackId: track.meta.id, name: track.meta.name, color: track.meta.color, count });
    total += count;
  }
  return { date, count: total, parts };
}

/**
 * A calendar year of days, across every track.
 *
 * Hung on a ruler rather than on any one track: the same year with every day
 * counted as lived from the earliest start. Built from a track instead, the
 * shape would change with whichever track happened to be first, and the
 * columns would stop lining up with the month names above them.
 */
export function masterCalendar(
  tracks: TrackState[],
  year: number,
  todayStr: string,
  weekStartsOn: "sun" | "mon" = "mon"
): MasterDay[] {
  const start = masterStart(tracks);
  if (!start) return [];
  const counts = countsByTrack(tracks);
  return yearCalendar({}, start, year, todayStr, weekStartsOn).map((day: StreakDay) =>
    day.date ? dayFor(day.date, tracks, counts, todayStr) : { date: "", count: 0, parts: [] }
  );
}

/** The same year, broken into months. */
export function masterMonths(
  tracks: TrackState[],
  year: number,
  todayStr: string,
  weekStartsOn: "sun" | "mon" = "mon"
): MasterMonth[] {
  const start = masterStart(tracks);
  if (!start) return [];
  const counts = countsByTrack(tracks);
  return monthCalendar({}, start, year, todayStr, weekStartsOn).map((block: MonthBlock) => ({
    key: block.key,
    label: block.label,
    cells: block.cells.map((cell) => (cell ? dayFor(cell.date, tracks, counts, todayStr) : null)),
  }));
}

/** Every date any included track did something on. */
export function masterHistory(tracks: TrackState[]): string[] {
  const dates = new Set<string>();
  for (const track of tracks) {
    for (const [date, items] of Object.entries(track.completedItemsHistory ?? {})) {
      if (items?.length) dates.add(date);
    }
  }
  return [...dates].sort();
}

/**
 * The days *every* included track has off.
 *
 * Not the union: a Sunday one track rests on and another works on is a day
 * something was expected, and excusing it would let the track that rests most
 * decide the streak for all of them.
 */
export function masterRestWeekdays(tracks: TrackState[]): ReadonlySet<string> {
  if (tracks.length === 0) return new Set();
  const sets = tracks.map(restWeekdays);
  return new Set([...sets[0]].filter((day) => sets.every((set) => set.has(day))));
}

/**
 * The same intersection, asked per date.
 *
 * Each track's own week is dated, so the days they *all* had off is a
 * question about a day rather than a standing fact: two tracks can agree
 * about Sunday in March and disagree about it in September.
 */
export function masterRestOn(tracks: TrackState[]): RestOn {
  if (tracks.length === 0) return () => new Set();
  const schedules = tracks.map(restScheduleOf);
  return (date: string) => {
    const sets = schedules.map((on) => on(date));
    return new Set([...sets[0]].filter((day) => sets.every((set) => set.has(day))));
  };
}

export function masterStreak(tracks: TrackState[], todayStr: string): MasterStreak {
  const history = masterHistory(tracks);
  const rest = masterRestOn(tracks);

  const longest = longestStreakWithRest(history, rest);

  const set = new Set(history);
  const cursor = parseYMD(todayStr);
  let activeLast30 = 0;
  for (let i = 0; i < 30; i += 1) {
    if (set.has(formatDateYMD(cursor))) activeLast30 += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const totalAccomplishments = tracks.reduce(
    (sum, track) =>
      sum + Object.values(track.completedItemsHistory ?? {}).reduce((n, items) => n + (items?.length ?? 0), 0),
    0
  );

  return {
    current: streakWithRest(history, todayStr, rest),
    longest,
    activeDays: history.length,
    activeLast30,
    totalAccomplishments,
  };
}

/**
 * How far along all of it is.
 *
 * Weighted by each track's planned length, which is the whole reason this is
 * not a plain mean: finishing a ninety-day track is not the same achievement
 * as finishing a three-year one, and an average that treats them alike moves
 * most when the smallest track moves.
 */
export function masterProgress(tracks: TrackState[]): MasterProgress {
  if (tracks.length === 0) return { timePct: 0, workPct: 0, paceDelta: 0, totalDays: 0, count: 0 };

  let weight = 0;
  let time = 0;
  let work = 0;
  for (const track of tracks) {
    const days = Math.max(1, trackTotalDays(track));
    weight += days;
    time += timelineStats(track).progressPct * days;
    work += progressStats(track).workPct * days;
  }

  const timePct = weight > 0 ? time / weight : 0;
  const workPct = weight > 0 ? work / weight : 0;
  return { timePct, workPct, paceDelta: workPct - timePct, totalDays: weight, count: tracks.length };
}

/**
 * Every track's phases on one timeline, in the order they actually happen.
 *
 * Sorted by the date a phase opens rather than grouped by track, because the
 * question this answers is "what is running now, and what is next" — which is
 * a question about the calendar, not about which track a phase belongs to. A
 * phase with no deadline sorts by its start like any other and simply has no
 * end to show.
 */
export function masterPhases(tracks: TrackState[]): MasterPhase[] {
  const windows: MasterPhase[] = [];
  for (const track of tracks) {
    for (const window of timelineStats(track).windows) {
      windows.push({
        track: track.meta,
        phase: window.phase,
        startDate: window.startDate,
        endDate: window.endDate,
        state: window.state,
      });
    }
  }
  return windows.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

/**
 * The week, across every track.
 *
 * Each track keeps its own week number — they started on different days, so
 * "week 12" is a different week for each of them — which is why the rotation
 * for a given day is computed per track from that track's own start rather
 * than from a shared count.
 */
export function masterWeek(tracks: TrackState[], weekOffset: number): MasterWeekDay[] {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return names.map((name) => {
    const date = getDateForDayName(name, weekOffset);
    const entries = tracks.map((track) => {
      const day = (track.weekSchedule ?? []).find((entry) => entry.name === name);
      const type = day ? track.focusTypes?.[day.type] : undefined;
      const weekNum = track.startDate ? getWeekNum(track.startDate, parseYMD(date)) : 1;
      const { revisions, focus } = computeRotationItemsForDay(track.rotations ?? [], weekNum, name, track.currentPhase);
      const byId = new Map((track.rotations ?? []).map((rotation) => [`rotation_${rotation.id}`, rotation.label]));
      return {
        track: track.meta,
        label: day?.label ?? type?.label ?? "—",
        rest: day ? isRestType(day.type, type) : false,
        rotations: [
          // Both buckets a rotation can feed. Which one it is does not matter
          // here — the question this panel answers is "what does this day ask
          // of that track", and a revision item and a focus item are both an
          // answer to it.
          ...revisions.map((item) => ({ id: item.id, title: item.title, description: item.description })),
          ...focus.map((item) => ({ id: item.id, title: item.title, description: undefined })),
        ].map((item) => ({
          label: byId.get(item.id) ?? "Rotation",
          title: item.title,
          description: item.description,
        })),
      };
    });
    return { name, date, entries };
  });
}

/** Everything still to deliver, and everything already delivered, with the
 *  track each belongs to. Unfinished first — it is the half anybody opening
 *  this is looking for. */
export function masterDeliverables(tracks: TrackState[]): Owned<PortfolioProject>[] {
  const all = tracks.flatMap((track) => (track.portfolio ?? []).map((item) => ({ track: track.meta, item })));
  return [...all.filter((entry) => !entry.item.completed), ...all.filter((entry) => entry.item.completed)];
}

/** Every track's reading and watching. Archived ones are left out, the same as
 *  in a single track's own panel. */
export function masterMaterials(tracks: TrackState[]): Owned<Material>[] {
  return tracks.flatMap((track) =>
    (track.materials ?? []).filter((item) => !item.archived).map((item) => ({ track: track.meta, item }))
  );
}

/** The roadmaps that have anything written in them. */
export function masterRoadmaps(tracks: TrackState[]): { track: TrackMeta; content: string }[] {
  return tracks
    .filter((track) => (track.roadmapContent ?? "").trim().length > 0)
    .map((track) => ({ track: track.meta, content: track.roadmapContent as string }));
}

/**
 * Which tracks the master view is built from.
 *
 * The excluded list is stored rather than the included one, so a track made
 * tomorrow is in the view by default. "Show me everything except these two"
 * survives a new track; "show me these four" quietly loses it.
 */
export function masterSources(tracks: TrackState[], excluded: readonly string[]): TrackState[] {
  const off = new Set(excluded);
  return tracks.filter((track) => !off.has(track.meta.id));
}
