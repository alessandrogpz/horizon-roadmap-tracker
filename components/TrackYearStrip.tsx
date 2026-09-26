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

/** Fifty-three columns is a year plus the part-weeks at either end. */
export const YEAR_WEEKS = 53;

export default function TrackYearStrip({
  days,
  color,
  cell = 6,
  gap = 2,
  start,
  today,
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
  today?: string;
  className?: string;
}) {
  // Always the full year, with the empty weeks padded in at the front. Sized
  // to the weeks a track happens to have, a three-week-old track drew huge
  // squares and a two-year-old one tiny ones, and the two could not be
  // compared — which is the only reason to put them in a list together.
  const recent = days.slice(-YEAR_WEEKS * 7);
  const weeks: StreakDay[][] = [];
  for (let i = 0; i < recent.length; i += 7) weeks.push(recent.slice(i, i + 7));
  while (weeks.length < YEAR_WEEKS) weeks.unshift(BLANK_WEEK);

  return (
    <div className={className} style={{ display: "flex", gap }}>
      {weeks.map((week, index) => (
        <div key={index} style={{ display: "flex", flexDirection: "column", gap }}>
          {week.map((day, dayIndex) => {
            const began = Boolean(start) && day.date === start;
            return (
              <div
                key={dayIndex}
                title={day.date ? `${day.date}: ${day.count} update${day.count === 1 ? "" : "s"}` : undefined}
                style={{
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
                  boxShadow: day.date && today && day.date === today ? "0 0 0 1.5px var(--foreground)" : undefined,
                }}
              />
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
