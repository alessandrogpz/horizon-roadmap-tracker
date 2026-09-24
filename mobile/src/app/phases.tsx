// The roadmap: the phases between the start and the deadline, and which one
// today falls in.
//
// Phases can be added, removed or made current from here; tapping one opens
// it in full (./phase/[id].tsx), which is where its title, description, tasks,
// deadline and detail sections are edited. The split matches what each view is
// for: this one is the shape of the plan, that one is the inside of a phase.
//
// The schedule comes from `timelineStats` in the shared core, so the dates here
// and on the website are computed by the same code rather than by two that
// agree today.

import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { phaseStats, timelineStats } from "@shared/stats";
import { addPhase, removePhase, setCurrentPhase } from "@shared/trackActions";
import { formatDayMonthYear } from "@shared/dates";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export default function PhasesScreen() {
  const { track, today, editTrack } = useWorkspace();
  const palette = usePalette();
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
          <Link href={{ pathname: "/phase/[id]", params: { id: phase.id } }} asChild>
            <Pressable accessibilityRole="button" accessibilityLabel={`Open ${phase.title}`}>
              <Text style={styles.phaseTitle}>{phase.title}</Text>
              {phase.description ? (
                <Text style={styles.muted} numberOfLines={2}>
                  {phase.description}
                </Text>
              ) : null}
              {phase.tasks.length > 0 && (
                <Text style={styles.taskCount}>
                  {phase.tasks.filter((t) => t.completed).length} of {phase.tasks.length} tasks done
                </Text>
              )}
            </Pressable>
          </Link>

          <View style={styles.actions}>
            {state !== "current" && (
              <Pressable accessibilityRole="button" style={styles.smallButton} onPress={() => editTrack((t) => setCurrentPhase(t, phase.id))}>
                <Text style={styles.smallLabel}>Make current</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              style={styles.smallButton}
              onPress={() => editTrack((t) => removePhase(t, phase.id))}
            >
              <Text style={styles.smallLabel}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        style={styles.addButton}
        onPress={() => editTrack((t) => addPhase(t).track)}
      >
        <Text style={styles.smallLabel}>Add a phase</Text>
      </Pressable>

      {timeline.windows.length === 0 && (
        <Text style={styles.muted}>This track has no phases yet.</Text>
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
    taskCount: { color: palette.subtleForeground, fontSize: 11, marginTop: 2 },
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
    actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.xs },
    editRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "center" },
    input: {
      flex: 1,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
      color: palette.foreground,
      fontSize: 15,
    },
    smallButton: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    smallLabel: { color: palette.mutedForeground, fontSize: 12, fontWeight: "600" },
    addButton: {
      alignItems: "center",
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
  });
}
