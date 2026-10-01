// The days a track has deliberately taken off, and what they mean for a streak.
//
// A week is built from focus types — "what a day is for" — and one or more of
// them is usually a day *not* for anything: Free, Rest, whatever the track
// calls it. Until now the streak could not tell that kind of day from a day
// that was simply missed, so a plan with Sunday off could never hold a streak
// longer than six, and the number quietly punished people for following their
// own schedule.
//
// A rest day now *bridges* a streak rather than extending it. It does not
// break the run, and it does not add to it either: the count is still days of
// work, and inflating it would make a track with five rest days a week look
// like the most consistent thing anyone had ever done.
//
// The week is *dated*. A schedule is a decision about what comes next, not a
// claim about what already happened, so changing it never rewrites the past:
// turn Thursday from a day off into a working day and every Thursday you
// already took off stays taken off, dot and all, while Thursdays from today
// onward are working days. The track keeps a short log of when the set
// changed (`TrackState.restDaysFrom`); a track whose week never moves carries
// nothing, and one written before the log existed reads as "it has always
// been what it is now".
//
// Everything that asks about rest days therefore asks about a *date*, which
// is what `RestOn` is: give it a day, it gives you the weekdays that were off
// on that day.

import { DAYS_SHORT, formatDateYMD, parseYMD } from "./dates";
import type { FocusType, TrackState } from "./types";

/**
 * Focus types that are a day off when nothing says otherwise.
 *
 * Every template ships one of these two, and they predate the flag, so the
 * flag has to be allowed to be absent and still mean something. A type the
 * user made called "Recovery" is not in here and is not a rest day until they
 * say so — guessing from a label would make the rule unpredictable in exactly
 * the cases where it matters.
 */
const REST_BY_DEFAULT = new Set(["free", "rest"]);

/** Whether a focus type is a day off. The stored flag wins; without one, the
 *  two keys every template ships are days off and nothing else is. */
export function isRestType(key: string, type?: Pick<FocusType, "restDay">): boolean {
  return type?.restDay ?? REST_BY_DEFAULT.has(key);
}

/**
 * The weekdays off on a given date.
 *
 * A function rather than a set, because the answer changes with the date: the
 * week you keep now is not necessarily the week you kept in March, and a grid
 * drawing a year has to ask once per day.
 */
export type RestOn = (date: string) => ReadonlySet<string>;

const NONE: ReadonlySet<string> = new Set();

/** A schedule that never changes. For callers that genuinely have one set —
 *  and for tests. */
export const fixedRest = (rest: ReadonlySet<string>): RestOn => () => rest;

/**
 * This track's schedule, as of any date.
 *
 * With no log, the current week has always been the week — which is what
 * tracks written before the log assume, and what a track that has never been
 * reshaped actually means. With a log, the entry in force on that date wins;
 * a date before the first entry uses the first entry, which is the set the
 * track opened with.
 */
export function restScheduleOf(
  track: Pick<TrackState, "weekSchedule" | "focusTypes" | "restDaysFrom"> | null | undefined
): RestOn {
  if (!track) return () => NONE;
  const log = track.restDaysFrom;
  const current = restWeekdays(track);
  if (!log || log.length === 0) return () => current;

  // Sorted once here rather than trusted: entries are appended in order, but
  // a merge between two devices can interleave them.
  const entries = [...log].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const sets = entries.map((entry) => new Set(entry.days) as ReadonlySet<string>);

  return (date: string) => {
    if (!date) return NONE;
    let chosen = 0;
    for (let i = 0; i < entries.length; i += 1) {
      if (entries[i].date <= date) chosen = i;
      else break;
    }
    return sets[chosen];
  };
}

/** Whether this track ever takes a day off — for deciding whether a key is
 *  worth drawing. Looks at the whole log, not just today's week. */
export function anyRestDays(
  track: Pick<TrackState, "weekSchedule" | "focusTypes" | "restDaysFrom"> | null | undefined
): boolean {
  if (!track) return false;
  if (restWeekdays(track).size > 0) return true;
  return (track.restDaysFrom ?? []).some((entry) => entry.days.length > 0);
}

/** The weekday names ("Mon" … "Sun") this track has taken off *now*. */
export function restWeekdays(
  track: Pick<TrackState, "weekSchedule" | "focusTypes"> | null | undefined
): ReadonlySet<string> {
  const days = new Set<string>();
  for (const day of track?.weekSchedule ?? []) {
    if (isRestType(day.type, track?.focusTypes?.[day.type])) days.add(day.name);
  }
  return days;
}

/** Whether a "YYYY-MM-DD" falls on one of them. Weekday only — see
 *  `marksRestDay` for the question the grids actually ask. */
export function isRestDate(date: string, rest: ReadonlySet<string>): boolean {
  if (!date || rest.size === 0) return false;
  return rest.has(DAYS_SHORT[parseYMD(date).getDay()]);
}

/**
 * Whether a day should carry the day-off mark.
 *
 * Three conditions, and the two beyond the weekday are the reason this exists
 * rather than every grid calling `isRestDate` directly:
 *
 * - **It has already happened.** A Sunday next month is not a day off, it is a
 *   day. Marking it says something about the future that nobody has lived yet,
 *   and the mark means "this gap was the plan" — which is a claim about the
 *   past. Today counts: a free day you are standing in is a day off until you
 *   put something on it, and the moment you do, the caller's `count` stops
 *   being zero and the square fills in instead.
 * - **The track existed for it.** `streakCalendar` runs from the *week* its
 *   track began in, so up to six real dates before the first day come back
 *   with a count of zero — days the track was not there to take off.
 * - It falls on a weekday the week has off.
 *
 * The bound used to be left to whichever calendar fed the grid: `yearCalendar`
 * and `monthCalendar` blank out everything past today, so most views were
 * right by accident. Views built on other calendars were not, and "right by
 * accident" is not a property you can check.
 */
export function marksRestDay(
  date: string,
  restOn: RestOn,
  todayStr: string,
  startDate?: string
): boolean {
  if (!date || !todayStr || date > todayStr) return false;
  if (startDate && date < startDate) return false;
  // The schedule *that day* had, not the one it has now.
  return isRestDate(date, restOn(date));
}

/**
 * The run of days ending now, counting days worked and stepping over days
 * deliberately taken off.
 *
 * Walking back one calendar day at a time, as `currentStreakLength` does, but
 * a rest day neither adds to the run nor ends it. The walk stops once the
 * cursor passes the earliest day ever recorded: nothing older can extend the
 * run, and without that bound a week with every day off would walk backwards
 * forever.
 */
export function streakWithRest(
  streakHistory: string[],
  todayStr: string,
  restOn: RestOn
): number {
  if (!todayStr) return 0;
  const worked = new Set(streakHistory);
  if (worked.size === 0) return 0;
  const earliest = [...worked].reduce((low, date) => (date < low ? date : low));

  // Anchored on today if it has already been worked, otherwise on yesterday —
  // a day still in progress should not zero a streak that is still alive.
  const cursor = parseYMD(todayStr);
  if (!worked.has(todayStr)) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  for (let date = formatDateYMD(cursor); date >= earliest; date = formatDateYMD(cursor)) {
    if (worked.has(date)) streak += 1;
    else if (!isRestDate(date, restOn(date))) break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** The track's current streak, with its own rest days applied. What every
 *  screen showing a flame should call. */
export function trackStreak(
  track:
    | Pick<TrackState, "streakHistory" | "weekSchedule" | "focusTypes" | "restDaysFrom">
    | null
    | undefined,
  todayStr: string
): number {
  if (!track) return 0;
  return streakWithRest(track.streakHistory ?? [], todayStr, restScheduleOf(track));
}

/**
 * Whether two worked days are consecutive once rest days are stepped over.
 *
 * Used for the longest run, which has to apply the same rule as the current
 * one or the two numbers contradict each other.
 *
 * Walked a day at a time, because the schedule can differ across the gap. It
 * stops at the first working day, which in any ordinary week is within seven,
 * and gives up past a year — a gap that long is only bridgeable by a week
 * with no working days in it at all, which is a track that records nothing.
 */
const LONGEST_BRIDGE = 366;

export function bridges(from: string, to: string, restOn: RestOn): boolean {
  const start = parseYMD(from);
  const end = parseYMD(to);
  const gap = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (gap <= 1) return gap === 1;
  if (gap > LONGEST_BRIDGE) return false;

  for (let step = 1; step < gap; step += 1) {
    start.setDate(start.getDate() + 1);
    const date = formatDateYMD(start);
    if (!isRestDate(date, restOn(date))) return false;
  }
  return true;
}
