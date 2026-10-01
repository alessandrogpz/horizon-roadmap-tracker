// A year of a track's days, small enough to sit inside a row.
//
// The same data the Progress grid draws, at a glance rather than at a size you
// can tap: weeks as columns, weekdays as rows, painted in the track's own
// colour. A whole year across a phone leaves each day about four points, which
// is far too small to press — and it is not meant to be pressed. It is meant
// to be recognised. Progress is where a day can be opened.

import { useMemo, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import type { StreakDay } from "@shared/stats";
import { marksRestDay, type RestOn } from "@shared/restDays";
import { shadeOf, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

/** Fifty-three columns is a year plus the part-weeks at either end. */
const WEEKS = 53;
/** How much of a column is the day, and how much the gap after it. Sizes are
 *  fractions rather than points because the only fixed quantity here is the
 *  width of whatever the grid was put inside — a year has to fit it, and at
 *  phone width that lands somewhere near five points a day. */
const DOT_SHARE = 0.78;

/** A column of days the track had not started yet. Shared, because it is the
 *  same nothing in every one of them. */
const BLANK_WEEK: StreakDay[] = Array.from({ length: 7 }, () => ({ date: "", count: 0 }));

export function TrackHeatmap({
  days,
  colour,
  start,
  today,
  rest,
}: {
  days: StreakDay[];
  colour: string;
  /** The track's first day, marked the same way the Progress grid marks it:
   *  in the page's opposite, so it survives whichever colour the track is. */
  start?: string;
  /** What day it is, so a day off that has not happened yet is not marked as
   *  one. Without it nothing is marked. */
  today?: string;
  /** The track's days off, by date — the week it kept then, not the one it
   *  keeps now. An empty day on one of them that has passed carries a dot
   *  rather than reading as a day missed. */
  rest?: RestOn;
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  // Measured rather than assumed. Hard-coded five-point days overflowed the
  // card they were in by a few weeks, and the overflow was invisible in a
  // screenshot of the right phone and obvious on any other.
  const [width, setWidth] = useState(0);

  // The most recent year, in whole weeks. `streakCalendar` pads to sevens, so
  // slicing by week is a slice by seven and nothing has to be recounted.
  //
  // Always fifty-three columns, even for a track three weeks old: the empty
  // ones are padded in at the front so a day is the same size on every row of
  // the list. Sized to the weeks a track happens to have, a young track drew
  // enormous squares and an old one tiny ones, and the two could not be
  // compared — which is the only reason to put them in a list together.
  const weeks = useMemo(() => {
    const recent = days.slice(-WEEKS * 7);
    const out: StreakDay[][] = [];
    for (let i = 0; i < recent.length; i += 7) out.push(recent.slice(i, i + 7));
    while (out.length < WEEKS) out.unshift(BLANK_WEEK);
    return out;
  }, [days]);

  // One column is a day and the gap after it; the last gap falls off the end,
  // which is what the fractional week is subtracting. Fractional sizes are
  // fine — the cells are drawn, not laid out against anything.
  const column = width > 0 ? width / (WEEKS - (1 - DOT_SHARE)) : 0;
  const dot = column * DOT_SHARE;
  const gap = column - dot;

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (Math.abs(next - width) > 0.5) setWidth(next);
  };

  return (
    // Hidden until it has been measured, rather than drawn at a guessed size
    // and corrected a frame later in front of the reader.
    <View style={[styles.grid, { gap, opacity: width > 0 ? 1 : 0 }]} onLayout={onLayout}>
      {weeks.map((week, index) => (
        <View key={index} style={{ gap }}>
          {week.map((day, dayIndex) => {
            // A day off that *passed* with nothing on it. Work done on a rest
            // day is still work, so only empty ones are marked.
            const resting =
              Boolean(rest) &&
              day.count === 0 &&
              day.date !== start &&
              marksRestDay(day.date, rest!, today ?? "", start);
            return (
              <View
                key={dayIndex}
                style={{
                  width: dot,
                  height: dot,
                  borderRadius: Math.max(1, dot * 0.25),
                  alignItems: "center",
                  justifyContent: "center",
                  // A padding cell is not a day with nothing in it, so it is not
                  // drawn at all rather than drawn as an empty one.
                  backgroundColor: !day.date
                    ? "transparent"
                    : day.date === start
                      ? palette.foreground
                      : shadeOf(colour, day.count, palette.surfaceMuted),
                }}
              >
                {resting && (
                  <View
                    style={{
                      width: Math.max(1, dot * 0.4),
                      height: Math.max(1, dot * 0.4),
                      borderRadius: dot,
                      backgroundColor: colour,
                    }}
                  />
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    grid: { flexDirection: "row" },
    // Referenced so the palette is used and the styles rebuild with the theme.
    _: { backgroundColor: palette.background },
  });
}
