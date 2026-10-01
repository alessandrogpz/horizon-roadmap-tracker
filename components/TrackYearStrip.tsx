/**
 * A year of one track's days: weeks as columns, weekdays as rows, painted in
 * the track's own colour.
 *
 * The shape everyone knows from a year of contributions, at whatever size it
 * is given. It is the same picture the phone draws under each track in its
 * switcher and the same one the stacked all-tracks view draws a row of, which
 * is deliberate: a track should be recognisable by its year wherever the year
 * is shown.
 *
 * No state and no hooks, so a server component can render it — the landing
 * page does.
 */

import type { StreakDay } from "@/lib/stats";
import { shadeOf } from "@/lib/colors";
import { marksRestDay } from "@/lib/restDays";

/** Fifty-three columns is a year plus the part-weeks at either end. */
export const YEAR_WEEKS = 53;

export default function TrackYearStrip({
  days,
  color,
  cell = 6,
  gap = 2,
  start,
  today,
  markToday = true,
  rest,
  pad = true,
  onDayClick,
  className,
}: {
  /** Week-major, padded to sevens — what `yearCalendar` and `streakCalendar`
   *  both return. */
  days: StreakDay[];
  color: string;
  cell?: number;
  gap?: number;
  /** The track's first day, marked in the page's opposite so that it survives
   *  whichever colour the track is wearing. */
  start?: string;
  /** What day it is. Two jobs: it rings today, and it tells the day-off mark
   *  which days have already happened. */
  today?: string;
  /** Ring today. On by default, and turned off for strips drawn small enough
   *  that a 1.5-point ring is most of a cell — the track switcher's rows are
   *  four points a day, where the ring reads as a bright blob rather than a
   *  mark. Those strips end at today anyway, so it says nothing the shape has
   *  not already said. */
  markToday?: boolean;
  /** Weekday names this track has off. A day on one of them that *passed*
   *  with nothing recorded keeps its empty square and gains a dot, so a
   *  planned gap does not read as a missed day. Needs `today` to know which
   *  days have passed, and `start` to know which ones the track was there
   *  for; without `today` nothing is marked. */
  rest?: ReadonlySet<string>;
  /** Pad the front out to a whole year, so that every track in a list draws a
   *  day at the same size whatever age it is. */
  pad?: boolean;
  /** Makes the days pressable. Left off, the strip stays what it was: markup
   *  with no handlers, which a server component can render. */
  onDayClick?: (date: string) => void;
  className?: string;
}) {
  // Always the full year, with the empty weeks padded in at the front. Sized
  // to the weeks a track happens to have, a three-week-old track drew huge
  // squares and a two-year-old one tiny ones, and the two could not be
  // compared — which is the only reason to put them in a list together.
  const recent = days.slice(-YEAR_WEEKS * 7);
  const weeks: StreakDay[][] = [];
  for (let i = 0; i < recent.length; i += 7) weeks.push(recent.slice(i, i + 7));
  // Padded to a full year only when a full year was asked for. A caller that
  // hands over ten weeks wants ten columns, not ten with forty-three empty
  // ones in front of them.
  if (pad) while (weeks.length < YEAR_WEEKS) weeks.unshift(BLANK_WEEK);

  return (
    <div className={className} style={{ display: "flex", gap }}>
      {weeks.map((week, index) => (
        <div key={index} style={{ display: "flex", flexDirection: "column", gap }}>
          {week.map((day, dayIndex) => {
            const began = Boolean(start) && day.date === start;
            const pressable = Boolean(onDayClick) && Boolean(day.date);
            // A day off that *passed* with nothing on it. Only when it is
            // empty: work done on a rest day is still work, and it is drawn
            // as such.
            const resting =
              Boolean(rest) && day.count === 0 && !began && marksRestDay(day.date, rest!, today ?? "", start);
            const dot = Math.max(2, Math.round(cell * 0.34));
            return (
              <div
                key={dayIndex}
                role={pressable ? "button" : undefined}
                tabIndex={pressable ? -1 : undefined}
                onClick={pressable ? () => onDayClick?.(day.date) : undefined}
                title={
                  day.date
                    ? `${day.date}: ${day.count} update${day.count === 1 ? "" : "s"}${resting ? " — a day off" : ""}`
                    : undefined
                }
                style={{
                  cursor: pressable ? "pointer" : undefined,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: cell,
                  height: cell,
                  borderRadius: Math.max(1, cell * 0.25),
                  // A padding cell is not a day with nothing in it, so it is
                  // not drawn at all rather than drawn as an empty one.
                  background: !day.date
                    ? "transparent"
                    : began
                      ? "var(--foreground)"
                      : shadeOf(color, day.count, "var(--streak-0)"),
                  boxShadow:
                    markToday && day.date && today && day.date === today
                      ? "0 0 0 1.5px var(--foreground)"
                      : undefined,
                }}
              >
                {resting && (
                  <span
                    aria-hidden="true"
                    style={{ display: "block", width: dot, height: dot, borderRadius: "50%", background: color }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** A column of days the track had not started yet. Shared, because it is the
 *  same nothing in every one of them. */
const BLANK_WEEK: StreakDay[] = Array.from({ length: 7 }, () => ({ date: "", count: 0 }));
