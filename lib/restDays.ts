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
// There is one honest limitation. A track stores the week it has *now*, not
// the week it had in March, so moving Sunday from Free to Study re-reads every
// past Sunday as a working day. Keeping a dated history of the schedule would
// fix it and would cost a field on every track, a merge rule and a migration,
// for an answer that changes only when someone reshapes their week — and when
// they do, the new shape is usually the one they would rather be judged by.

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

/** The weekday names ("Mon" … "Sun") this track has taken off. */
export function restWeekdays(
  track: Pick<TrackState, "weekSchedule" | "focusTypes"> | null | undefined
): ReadonlySet<string> {
  const days = new Set<string>();
  for (const day of track?.weekSchedule ?? []) {
    if (isRestType(day.type, track?.focusTypes?.[day.type])) days.add(day.name);
  }
  return days;
}

/** Whether a "YYYY-MM-DD" falls on one of them. */
export function isRestDate(date: string, rest: ReadonlySet<string>): boolean {
  if (!date || rest.size === 0) return false;
  return rest.has(DAYS_SHORT[parseYMD(date).getDay()]);
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
  rest: ReadonlySet<string>
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
    else if (!isRestDate(date, rest)) break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** The track's current streak, with its own rest days applied. What every
 *  screen showing a flame should call. */
export function trackStreak(
  track: Pick<TrackState, "streakHistory" | "weekSchedule" | "focusTypes"> | null | undefined,
  todayStr: string
): number {
  if (!track) return 0;
  return streakWithRest(track.streakHistory ?? [], todayStr, restWeekdays(track));
}

/**
 * Whether two worked days are consecutive once rest days are stepped over.
 *
 * Used for the longest run, which has to apply the same rule as the current
 * one or the two numbers contradict each other. Bounded: with at least one
 * working weekday in the week, any gap of a week or more must contain one, so
 * there is nothing to walk.
 */
export function bridges(from: string, to: string, rest: ReadonlySet<string>): boolean {
  const start = parseYMD(from);
  const end = parseYMD(to);
  const gap = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (gap <= 1) return gap === 1;
  if (gap > 7) return rest.size === 7;

  for (let step = 1; step < gap; step += 1) {
    start.setDate(start.getDate() + 1);
    if (!isRestDate(formatDateYMD(start), rest)) return false;
  }
  return true;
}
