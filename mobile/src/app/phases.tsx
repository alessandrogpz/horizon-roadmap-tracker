// The roadmap: the phases between the start and the deadline, and which one
// today falls in.
//
// Read-only on purpose. Rewriting a phase's description is desk work — a
// paragraph of prose on a phone keyboard — while *knowing where you are* is
// precisely the thing worth having in a pocket. The schedule itself comes from
// `timelineStats` in the shared core, so the dates here and on the website are
// computed by the same code rather than by two that agree today.

import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { phaseStats, timelineStats } from "@shared/stats";
import { formatDayMonthYear } from "@shared/dates";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { DARK, LIGHT, RADIUS, SPACING, type Palette } from "../theme";

export default function PhasesScreen() {
  const { track, today } = useWorkspace();
  const palette = useColorScheme() === "light" ? LIGHT : DARK;
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const timeline = useMemo(() => (track ? timelineStats(track) : null), [track]);
  const current = useMemo(() => (track ? phaseStats(track, today) : null), [track, today]);

  if (!track || !timeline) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>No track open.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <Text style={styles.headline}>
          Day {timeline.daysPassed} of {timeline.totalDays}
        </Text>
        <Text style={styles.muted}>
          {timeline.daysRemaining > 0
            ? `${timeline.daysRemaining} days left · ends ${formatDayMonthYear(timeline.endDate)}`
            : `Ended ${formatDayMonthYear(timeline.endDate)}`}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, timeline.progressPct)}%` }]} />
        </View>
      </View>

      {current?.behindBy ? (
        <Text style={styles.behind}>
          The schedule expects phase {current.recommendedPhase?.id ?? "?"} by now — {current.behindBy} phase
          {current.behindBy === 1 ? "" : "s"} ahead of where this track is. Worth a look, not a panic.
        </Text>
      ) : null}

      {timeline.windows.map(({ phase, state, startDate, endDate }) => (
        <View
          key={phase.id}
          style={[styles.phase, state === "current" && { borderColor: palette.accent }]}
        >
          <View style={styles.phaseHead}>
            <Text style={[styles.phaseLabel, state === "current" && { color: palette.accent }]}>
              Phase {phase.id}
              {state === "done" ? " · done" : state === "current" ? " · now" : ""}
            </Text>
            <Text style={styles.dates}>
              {formatDayMonthYear(startDate)}
              {endDate ? ` – ${formatDayMonthYear(endDate)}` : ""}
            </Text>
          </View>
          <Text style={styles.phaseTitle}>{phase.title}</Text>
          {phase.description ? <Text style={styles.muted}>{phase.description}</Text> : null}
        </View>
      ))}

      {timeline.windows.length === 0 && (
        <Text style={styles.muted}>This track has no phases yet. Add them in Horizon on the web.</Text>
      )}
    </ScrollView>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md },
    centered: { alignItems: "center", justifyContent: "center" },
    summary: { gap: SPACING.sm },
    headline: { color: palette.foreground, fontSize: 20, fontWeight: "700" },
    muted: { color: palette.mutedForeground, fontSize: 13, lineHeight: 18 },
    progressTrack: { height: 6, borderRadius: 3, backgroundColor: palette.surfaceMuted, overflow: "hidden" },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: palette.accent },
    behind: { color: palette.foreground, fontSize: 13, lineHeight: 18 },
    phase: {
      gap: SPACING.xs,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    phaseHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: SPACING.sm },
    phaseLabel: { color: palette.subtleForeground, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
    dates: { color: palette.subtleForeground, fontSize: 11 },
    phaseTitle: { color: palette.foreground, fontSize: 15, fontWeight: "600" },
  });
}
