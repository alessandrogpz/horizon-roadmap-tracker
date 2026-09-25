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
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { phaseStats, progressStats, timelineStats } from "@shared/stats";
import { addPhase, removePhase, setCurrentPhase } from "@shared/trackActions";
import { formatDayMonthYear } from "@shared/dates";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { useUndo } from "../../components/UndoBar";
import { RADIUS, SPACING, TYPE, type Palette } from "../../theme";
import { usePalette } from "../../theme/ThemeProvider";
import { EditHeader, useEditMode } from "../../components/EditToggle";
import { Refreshable } from "../../components/Refreshable";
import { Ring } from "../../components/Ring";
import { SubNav } from "../../components/SubNav";

export default function PhasesScreen() {
  const { workspace, track, today, editTrack, restoreWorkspace } = useWorkspace();
  const palette = usePalette();
  const { editing, setEditing } = useEditMode();
  const { offer } = useUndo();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const timeline = useMemo(() => (track ? timelineStats(track) : null), [track]);
  const current = useMemo(() => (track ? phaseStats(track, today) : null), [track, today]);
  const progress = useMemo(() => (track ? progressStats(track) : null), [track]);
  /** Past its last day the plan is spent, and the screen stops measuring
   *  the track against a total it has outlived. */
  const overrun = (timeline?.overrunDays ?? 0) > 0;

  const currentIndex = useMemo(
    () => timeline?.windows.findIndex((w) => w.state === "current") ?? -1,
    [timeline]
  );

  if (!track || !timeline) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>No track open.</Text>
      </View>
    );
  }

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
      <EditHeader
        title="Phases"
        editing={editing}
        onChange={setEditing}
        hint="Add or remove a phase, or move the track to a different one."
      />

      {/* Where the track stands, as two figures rather than a sentence. The
          ring is the same idea as the website's: a proportion is a shape
          before it is a number, and the number beside it says of what. */}
      <View style={styles.tiles}>
        <View style={[styles.tile, styles.timelineTile]}>
          <Ring pct={timeline.progressPct} tint={overrun ? palette.subtleForeground : palette.accent}>
            <Text style={styles.ringPct} allowFontScaling={false}>
              {Math.round(timeline.progressPct)}%
            </Text>
          </Ring>
          <View style={styles.tileText}>
            <Text style={styles.tileLabel}>Timeline</Text>
            <View style={styles.figureRow}>
              <Text style={styles.figure}>{timeline.daysPassed}</Text>
              {/* Past the plan there is no total left to be a fraction of,
                  and the line under the tiles already says by how much. */}
              <Text style={styles.tileUnit} numberOfLines={1}>
                {overrun ? "days" : `/ ${timeline.totalDays} days`}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.tile}>
          <View style={styles.tileText}>
            <Text style={styles.tileLabel}>Phase day</Text>
            <View style={styles.figureRow}>
              {/* Days spent in this phase, counting the time from before the
                  track last moved away and came back to it. */}
              <Text style={styles.figure}>{current?.dayInPhase ?? 0}</Text>
              <Text style={styles.tileUnit} numberOfLines={1}>
                in {current?.phase?.id !== undefined ? `phase ${current.phase?.id}` : "no phase"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {overrun && (
        <View style={styles.overrunRow}>
          <Text style={styles.muted}>
            The plan ran out {timeline.overrunDays} day{timeline.overrunDays === 1 ? "" : "s"} ago
          </Text>
          <Link href="/tracks" asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="Extend the plan" style={styles.extend}>
              <Text style={styles.extendLabel}>Extend</Text>
              <Ionicons name="chevron-forward" size={12} color={palette.accent} />
            </Pressable>
          </Link>
        </View>
      )}

      {progress ? (
        <View style={styles.card}>
          {/* Time spent against work done. The pace is the interesting number:
              a track can be 70% through its calendar with 30% of the work
              finished, and neither figure says that on its own. */}
          <Text style={styles.cardTitle}>
            {Math.round(progress.workPct)}% done · {Math.round(progress.timePct)}% of the time spent
          </Text>
          {/* Pace compares work done against time spent. Past the end of the
              plan there is no time left to be behind on, so the comparison
              stops meaning anything and is not made. */}
          {!overrun && (
            <Text style={styles.muted}>
              {progress.paceDelta >= 0
                ? `${Math.round(progress.paceDelta)} points ahead of the calendar.`
                : `${Math.abs(Math.round(progress.paceDelta))} points behind the calendar.`}
            </Text>
          )}
          {progress.breakdown
            .filter((part) => part.total > 0)
            .map((part) => (
              <View key={part.label} style={styles.barRow}>
                <Text style={styles.barLabel}>{part.label}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.min(100, part.pct)}%` }]} />
                </View>
                <Text style={styles.barValue}>
                  {part.done}/{part.total}
                </Text>
              </View>
            ))}
        </View>
      ) : null}

      {current?.behindBy && !overrun ? (
        <Text style={styles.behind}>
          The schedule expects phase {current.recommendedPhase?.id ?? "?"} by now — {current.behindBy} phase
          {current.behindBy === 1 ? "" : "s"} ahead of where this track is. Worth a look, not a panic.
        </Text>
      ) : null}

      {/* One continuous line down the left, with a dot per phase — the shape
          of the plan read in a glance, which eight bordered cards did not
          give. The line is what carries the state: green behind you, accent
          at the phase you are in, then fading out ahead, so how far along the
          track is does not have to be spelled out in words.

          Wrapped in its own View because the screen's content container has a
          gap between children, and a gap would cut the line into pieces. */}
      <View style={styles.timeline}>
        {timeline.windows.map(({ phase, state, startDate, endDate, endDay }, index) => {
          const last = index === timeline.windows.length - 1;
          const previous = timeline.windows[index - 1];

          // A segment's colour is the state of the phase it leads *out* of,
          // so the change of colour happens at the dot rather than between.
          const colourOf = (windowState: string | undefined) =>
            windowState === "done" ? palette.success : windowState === "current" ? palette.accent : palette.cardBorder;

          // Ahead of the current phase, everything dims with distance. Nothing
          // beyond the current phase has been decided yet, and the display
          // should say so rather than presenting phase 8 as vividly as phase 2.
          const ahead = currentIndex >= 0 && index > currentIndex ? index - currentIndex : 0;
          const fade = Math.max(0.42, 1 - ahead * 0.17);
          const dim = state === "done" ? 0.65 : state === "current" ? 1 : fade;

          return (
            <View key={phase.id} style={styles.row}>
              {index > 0 && (
                <View
                  style={[styles.lineTop, { backgroundColor: colourOf(previous?.state), opacity: 0.5 * dim + 0.1 }]}
                />
              )}
              {!last && (
                <View style={[styles.lineBottom, { backgroundColor: colourOf(state), opacity: 0.5 * dim + 0.1 }]} />
              )}

              {/* The glow around the current phase, as a circle behind the dot
                  rather than a shadow — coloured shadows do not survive the
                  trip to Android. */}
              {state === "current" && <View style={styles.halo} />}
              <View
                style={[
                  styles.dot,
                  state === "done" && { backgroundColor: palette.success, borderColor: palette.success },
                  state === "current" && {
                    backgroundColor: palette.background,
                    borderColor: palette.accent,
                    borderWidth: 3,
                  },
                  state === "upcoming" && { opacity: fade },
                ]}
              />

              <Link href={{ pathname: "/phase/[id]", params: { id: phase.id } }} asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${phase.title}`}
                  // Flattened: expo-router's Link passes styles straight
                  // through to its child and will not take an array.
                  style={StyleSheet.flatten([styles.rowBody, { opacity: dim }])}
                >
                  <View style={styles.rowHead}>
                    <Text
                      style={[
                        styles.phaseLabel,
                        state === "current" && { color: palette.accent },
                        state === "done" && { color: palette.success },
                      ]}
                    >
                      PHASE {String(phase.id).padStart(2, "0")}
                    </Text>
                    <Text style={styles.phaseTitle} numberOfLines={1}>
                      {/* The label already says which number this is. */}
                      {phase.title.replace(/^Phase \d+:\s*/, "")}
                    </Text>
                  </View>

                  {phase.description ? (
                    <Text style={styles.muted} numberOfLines={2}>
                      {phase.description}
                    </Text>
                  ) : null}

                  <Text style={styles.dates}>
                    {/* "Due", not "Ends": every one of these dates is in the
                        past on a track that has run long, and a deadline that
                        has been and gone still reads correctly as a due date. */}
                    {endDate ? `Due ${formatDayMonthYear(endDate)}` : `From ${formatDayMonthYear(startDate)}`}
                    {endDay !== undefined ? ` · day ${endDay}` : ""}
                    {phase.tasks.length > 0
                      ? ` · ${phase.tasks.filter((t) => t.completed).length}/${phase.tasks.length} done`
                      : ""}
                  </Text>
                </Pressable>
              </Link>

              {editing && (
                <View style={styles.actions}>
                  {state !== "current" && (
                    <Pressable
                      accessibilityRole="button"
                      style={styles.smallButton}
                      onPress={() => editTrack((t) => setCurrentPhase(t, phase.id))}
                    >
                      <Text style={styles.smallLabel}>Make current</Text>
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    style={styles.smallButton}
                    onPress={() => {
                      // Snapshot first: the undo puts a whole workspace back
                      // rather than trying to reverse the edit, which would
                      // have to know where in the list the phase sat.
                      const previousWorkspace = workspace;
                      editTrack((t) => removePhase(t, phase.id));
                      if (previousWorkspace) offer("Phase removed", () => restoreWorkspace(previousWorkspace));
                    }}
                  >
                    <Text style={styles.smallLabel}>Remove</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {editing && (
        <Pressable
          accessibilityRole="button"
          style={styles.addButton}
          onPress={() => editTrack((t) => addPhase(t).track)}
        >
          <Text style={styles.smallLabel}>Add a phase</Text>
        </Pressable>
      )}

      {timeline.windows.length === 0 && (
        <Text style={styles.muted}>This track has no phases yet.</Text>
      )}
      <View style={styles.moreRow}>
        <Text style={styles.moreTitle}>More on this track</Text>
      </View>
      <SubNav
        links={[
          { href: "/roadmap", label: "Roadmap", icon: "map-outline" },
          { href: "/rhythm", label: "Week & rotations", icon: "calendar-outline" },
          { href: "/portfolio", label: "Deliverables", icon: "cube-outline" },
        ]}
      />

    </Refreshable>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md },
    centered: { alignItems: "center", justifyContent: "center" },
    summary: { gap: SPACING.sm },
    headline: { color: palette.foreground, ...TYPE.title, fontWeight: "700" },
    muted: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
    moreRow: { marginTop: SPACING.xl },
    moreTitle: {
      color: palette.subtleForeground,
      ...TYPE.eyebrow,
      fontWeight: "700",
      letterSpacing: 1.2,
    },
    card: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    cardTitle: { color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
    barRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    barLabel: { color: palette.mutedForeground, ...TYPE.caption, width: 84 },
    barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: palette.surfaceMuted, overflow: "hidden" },
    barFill: { height: 8, borderRadius: 4, backgroundColor: palette.accent },
    barValue: { color: palette.mutedForeground, ...TYPE.caption, width: 44, textAlign: "right" },
    progressTrack: { height: 6, borderRadius: 3, backgroundColor: palette.surfaceMuted, overflow: "hidden" },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: palette.accent },
    behind: { color: palette.foreground, ...TYPE.label, lineHeight: 18 },
    tiles: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm },
    tile: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    // The one with a ring in it needs the room the ring takes.
    timelineTile: { flex: 1.5 },
    tileText: { flex: 1, gap: 2 },
    tileLabel: {
      ...TYPE.eyebrow,
      color: palette.subtleForeground,
      fontWeight: "700",
    },
    figureRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
    figure: { ...TYPE.figure, color: palette.foreground, fontWeight: "700" },
    tileUnit: { ...TYPE.micro, color: palette.mutedForeground },
    ringPct: { ...TYPE.micro, color: palette.mutedForeground, fontWeight: "700" },
    overrunRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm },
    extend: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingVertical: SPACING.xs,
      paddingLeft: SPACING.sm,
    },
    extendLabel: { color: palette.accent, ...TYPE.label, fontWeight: "600" },
    // Rows sit flush against each other so the line running through them is
    // continuous; each row supplies its own breathing room instead.
    timeline: { marginVertical: SPACING.xs },
    row: { position: "relative", paddingLeft: 36, paddingRight: SPACING.xs, paddingVertical: SPACING.sm },
    // Both halves meet at the dot's centre, 18 from the row's top.
    lineTop: { position: "absolute", left: 12, top: 0, height: 18, width: 2 },
    lineBottom: { position: "absolute", left: 12, top: 18, bottom: 0, width: 2 },
    dot: {
      position: "absolute",
      left: 5,
      top: 10,
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    halo: {
      position: "absolute",
      left: 0,
      top: 5,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: palette.accent,
      opacity: 0.16,
    },
    rowBody: { gap: 3 },
    rowHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    phaseLabel: { color: palette.mutedForeground, ...TYPE.micro, fontWeight: "700", letterSpacing: 1.1 },
    dates: { color: palette.subtleForeground, ...TYPE.micro, marginTop: 1 },
    phaseTitle: { flex: 1, color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
    actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
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
      ...TYPE.subhead,
    },
    smallButton: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    smallLabel: { color: palette.mutedForeground, ...TYPE.caption, fontWeight: "600" },
    addButton: {
      alignItems: "center",
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
  });
}
