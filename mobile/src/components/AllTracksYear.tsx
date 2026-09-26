// Every track's year at once: one strip per track, stacked, read sideways.
//
// A single track's grid runs *down* the page — seven columns wide, a week per
// row — because that is the only way a day stays big enough to tap on a phone.
// Several tracks cannot be laid out that way: three columns of weeks side by
// side is three narrow ribbons, and nothing about them can be compared.
//
// So the many-track view turns back to the shape everyone knows from a year
// of contributions — weeks across, weekdays down — zoomed out, and scrolled
// sideways instead of down. The names and their progress rings stay pinned at
// the left while the years slide underneath, which is what makes the stack
// readable: the whole point is that Tuesday the 3rd is the same column on
// every row.

import { useMemo, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { timelineStats, yearCalendar, type StreakDay } from "@shared/stats";
import { currentStreakLength } from "@shared/streak";
import { parseYMD } from "@shared/dates";
import type { TrackState } from "@shared/types";
import { Ring } from "./Ring";
import { RADIUS, SPACING, TYPE, shadeOf, withAlpha, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

/** Zoomed out from the single-track grid's 26, which is a size built for a
 *  thumb. Nothing here is tappable — it is the shape of a year, and the year
 *  it belongs to is one tap away on the track itself. */
const CELL = 11;
const GAP = 3;
const COLUMN = CELL + GAP;
/** Seven days and the gaps between them. */
const ROW = 7 * CELL + 6 * GAP;
/** The strip of month names above the grid. */
const LABELS = 16;
/** The pinned column: a ring, a name, a streak. */
const HEAD = 108;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Row {
  track: TrackState;
  colour: string;
  weeks: StreakDay[][];
  pct: number;
  streak: number;
}

export function AllTracksYear({
  tracks,
  year,
  today,
  weekStartsOn,
}: {
  tracks: TrackState[];
  year: number;
  today: string;
  weekStartsOn: "sun" | "mon";
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const strips = useRef<ScrollView>(null);
  /** Which year has already been dropped at its recent end. */
  const landedOn = useRef<number | null>(null);

  const rows = useMemo<Row[]>(
    () =>
      tracks.map((track) => {
        const days = yearCalendar(
          track.completedItemsHistory ?? {},
          track.startDate,
          year,
          today,
          weekStartsOn
        );
        const weeks: StreakDay[][] = [];
        for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
        return {
          track,
          colour: track.meta.color || palette.accent,
          weeks,
          pct: timelineStats(track).progressPct,
          streak: currentStreakLength(track.streakHistory ?? [], today),
        };
      }),
    [palette.accent, today, tracks, weekStartsOn, year]
  );

  // The ruler the rows are hung on: the same year with every day counted as
  // lived, so the columns and the month names come from the calendar rather
  // than from whichever track happens to be first. Read off a track, a row
  // that began yesterday would have named one month and placed it at the far
  // end, and every label above every other row would have been wrong.
  const ruler = useMemo(
    () => yearCalendar({}, `${year}-01-01`, year, today, weekStartsOn),
    [today, weekStartsOn, year]
  );
  const columns = Math.ceil(ruler.length / 7);
  const marks = useMemo(() => monthMarks(ruler), [ruler]);

  if (columns === 0) return null;

  return (
    <View style={styles.frame}>
      {/* Pinned. The spacer keeps these level with the strips, which start one
          label-row lower. */}
      <View style={styles.heads}>
        <View style={{ height: LABELS }} />
        {rows.map((row) => (
          <View key={row.track.meta.id} style={styles.head}>
            <Ring pct={row.pct} size={26} stroke={3} tint={row.colour} />
            <View style={styles.headText}>
              <Text style={styles.name} numberOfLines={2}>
                {row.track.meta.name}
              </Text>
              {row.streak > 0 && (
                <View style={styles.streak}>
                  <Ionicons name="flame" size={10} color={row.colour} />
                  <Text style={[styles.streakCount, { color: row.colour }]}>{row.streak}</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>

      <ScrollView
        horizontal
        ref={strips}
        // Left on, unlike everywhere else in the app. Two thirds of the year
        // is off the right edge and nothing else on the screen says so.
        showsHorizontalScrollIndicator
        // Opened at the recent end, the same as the vertical grid — which in a
        // shape that runs sideways is the right edge, not the bottom. Jumped
        // rather than animated, and once per year: this is where the graph
        // starts, not somewhere it travels to while you watch.
        onContentSizeChange={() => {
          if (landedOn.current === year) return;
          landedOn.current = year;
          strips.current?.scrollToEnd({ animated: false });
        }}
        // One scroller for every strip, so the rows cannot drift out of
        // alignment with each other — which they would if each carried its own.
        contentContainerStyle={{ width: columns * COLUMN }}
      >
        <View>
          <View style={{ height: LABELS, width: columns * COLUMN }}>
            {marks.map((mark) => (
              <Text
                key={mark.month}
                style={[styles.monthLabel, { left: mark.column * COLUMN }]}
                allowFontScaling={false}
              >
                {MONTHS[mark.month]}
              </Text>
            ))}
          </View>

          {rows.map((row) => (
            <View key={row.track.meta.id} style={styles.strip}>
              {row.weeks.map((week, index) => (
                <View key={index} style={styles.week}>
                  {week.map((day, dayIndex) => (
                    <View
                      key={dayIndex}
                      style={[
                        styles.cell,
                        {
                          backgroundColor: day.date
                            ? shadeOf(row.colour, day.count, palette.surfaceMuted)
                            : "transparent",
                        },
                        // The same two marks the single-track grid uses: the
                        // day it began, in the page's opposite so it survives
                        // any track colour, and today, ringed.
                        day.date && day.date === row.track.startDate && {
                          backgroundColor: palette.foreground,
                        },
                        day.date === today && { borderWidth: 2, borderColor: palette.foreground },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** Which column each month starts in. A week belongs to the month of its first
 *  real day, which is the same rule the single-track grid bands by. */
function monthMarks(days: StreakDay[]): { month: number; column: number }[] {
  const marks: { month: number; column: number }[] = [];
  let seen = -1;
  for (let column = 0; column * 7 < days.length; column += 1) {
    const anchor = days.slice(column * 7, column * 7 + 7).find((day) => day.date);
    if (!anchor) continue;
    const month = parseYMD(anchor.date).getMonth();
    if (month === seen) continue;
    seen = month;
    // Skipped when the name would land on top of the one before it — at this
    // zoom a month is four columns, and three characters is wider than that
    // only where a month is cut short by the start of the year or by today.
    if (marks.length > 0 && column - marks[marks.length - 1].column < 3) continue;
    marks.push({ month, column });
  }
  return marks;
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    frame: { flexDirection: "row" },
    heads: { width: HEAD, paddingRight: SPACING.sm },
    head: { height: ROW, flexDirection: "row", alignItems: "flex-start", gap: 6 },
    headText: { flex: 1, gap: 3 },
    name: { color: palette.foreground, ...TYPE.label, fontWeight: "600", lineHeight: 15 },
    streak: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 2,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: RADIUS.control,
      backgroundColor: withAlpha(palette.foreground, 0.06),
    },
    streakCount: { ...TYPE.micro, fontWeight: "700" },
    monthLabel: { position: "absolute", top: 0, color: palette.subtleForeground, ...TYPE.micro },
    strip: { height: ROW, flexDirection: "row", gap: GAP },
    week: { gap: GAP },
    cell: { width: CELL, height: CELL, borderRadius: 2 },
  });
}
