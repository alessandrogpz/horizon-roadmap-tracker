// The consistency grid: one cell per day since the track began, shaded by how
// much landed on it.
//
// The cells come from `streakCalendar` in the shared core — the same function
// the website's grid and the landing page's miniature use, so the three can't
// drift into disagreeing about what a day was worth. This screen only decides
// how a cell looks on a phone, and that the grid scrolls sideways rather than
// squeezing a year into 360 points.

import { useMemo, useRef } from "react";
import { ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { streakCalendar, type StreakDay } from "@shared/stats";
import { currentStreakLength } from "@shared/streak";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { DARK, LIGHT, RADIUS, SPACING, type Palette } from "../theme";

/** How many things done in a day reaches each shade. The website's thresholds. */
const levelFor = (count: number): number => (count === 0 ? 0 : count <= 1 ? 1 : count <= 2 ? 2 : count <= 3 ? 3 : 4);

const CELL = 13;
const GAP = 3;

export default function StreakScreen() {
  const { track, today } = useWorkspace();
  const palette = useColorScheme() === "light" ? LIGHT : DARK;
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const scroller = useRef<ScrollView>(null);

  const days = useMemo(() => (track ? streakCalendar(track, today) : []), [track, today]);
  const streak = useMemo(() => currentStreakLength(track?.streakHistory ?? [], today), [track, today]);

  // Seven rows, one column per week: the calendar is already week-major, so
  // chunking by seven gives the columns directly.
  const weeks = useMemo(() => {
    const out: StreakDay[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days]);

  const active = days.filter((d) => d.count > 0).length;

  if (!track) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>No track open.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headline}>
        <Text style={styles.number}>{streak}</Text>
        <Text style={styles.muted}>day{streak === 1 ? "" : "s"} in a row</Text>
      </View>

      <Text style={styles.muted}>
        {active} active day{active === 1 ? "" : "s"} since {track.startDate || "the start"}
      </Text>

      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        // A year is 53 columns: too many to squeeze onto a phone without the
        // cells becoming unreadable, so it scrolls and opens on the present.
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={styles.grid}
      >
        {weeks.map((week, column) => (
          <View key={column} style={styles.week}>
            {week.map((day, row) => (
              <View
                key={day.date || `pad-${column}-${row}`}
                style={[styles.cell, { backgroundColor: palette.streak[levelFor(day.count)] }, !day.date && styles.padding]}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.legend}>
        <Text style={styles.legendLabel}>Less</Text>
        {palette.streak.map((shade, i) => (
          <View key={i} style={[styles.cell, { backgroundColor: shade }]} />
        ))}
        <Text style={styles.legendLabel}>More</Text>
      </View>

      <Text style={styles.footnote}>
        A day counts when something was logged against it — a task ticked, a material finished. The same
        rule the website uses, because it is the same code.
      </Text>
    </ScrollView>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md },
    centered: { alignItems: "center", justifyContent: "center" },
    headline: { flexDirection: "row", alignItems: "baseline", gap: SPACING.sm },
    number: { color: palette.accent, fontSize: 34, fontWeight: "700" },
    muted: { color: palette.mutedForeground, fontSize: 13 },
    grid: { flexDirection: "row", gap: GAP, paddingVertical: SPACING.sm },
    week: { gap: GAP },
    cell: { width: CELL, height: CELL, borderRadius: 2 },
    padding: { opacity: 0 },
    legend: { flexDirection: "row", alignItems: "center", gap: GAP },
    legendLabel: { color: palette.subtleForeground, fontSize: 11, marginHorizontal: SPACING.xs },
    footnote: { color: palette.subtleForeground, fontSize: 12, lineHeight: 17 },
  });
}
