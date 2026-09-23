// Today: what this track asks of you on this day, and the streak riding on it.
//
// Every rule here comes from the shared core — which day of the week today is
// (`dates`), whether an item counts as done (`completions`), how long the
// streak is (`streak`). This screen decides only how it looks and what a tap
// does.

import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TrackState } from "@shared/types";
import { isItemCompleted, type DayItemRef, type ItemKind } from "@shared/completions";
import { currentStreakLength } from "@shared/streak";
import { DAYS_SHORT, parseYMD } from "@shared/dates";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { usePedometer } from "../steps/usePedometer";
import { shareTrack } from "../share/shareTrack";
import { DARK, LIGHT, RADIUS, SPACING, type Palette } from "../theme";

interface Row {
  id: string;
  title: string;
  description?: string;
  kind: ItemKind;
}

/** Today's stored items for this track: the focus list and the revision list
 *  for this day of the week. Rotation-generated items come later — they are
 *  recomputed rather than stored, and are not needed to show a working day. */
function rowsFor(track: TrackState, dateStr: string): { focus: Row[]; revision: Row[] } {
  const dayKey = DAYS_SHORT[parseYMD(dateStr).getDay()];
  return {
    focus: (track.dailyTasks?.[dayKey] ?? []).map((item) => ({ id: item.id, title: item.title, kind: "focus" })),
    revision: (track.dailyRevisionItems?.[dayKey] ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      kind: "revision",
    })),
  };
}

export default function TodayScreen() {
  const { track, today, loading, toggleItem } = useWorkspace();
  const palette = useColorScheme() === "light" ? LIGHT : DARK;
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();

  const rows = useMemo(() => (track ? rowsFor(track, today) : { focus: [], revision: [] }), [track, today]);
  const streak = useMemo(() => currentStreakLength(track?.streakHistory ?? [], today), [track, today]);
  const steps = usePedometer(today);

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (!track) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>No track yet.</Text>
      </View>
    );
  }

  const dayKey = DAYS_SHORT[parseYMD(today).getDay()];
  const done = [...rows.focus, ...rows.revision].filter((row) =>
    isItemCompleted(track, today, row.kind, row.id)
  ).length;
  const total = rows.focus.length + rows.revision.length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.trackName} numberOfLines={1}>
            {track.meta.name}
          </Text>
          <Text style={styles.muted}>
            {dayKey} · {total ? `${done} of ${total} done` : "nothing planned"}
          </Text>
        </View>
        <Link href="/tracks" asChild>
          <Pressable style={styles.switchButton} accessibilityRole="button">
            <Text style={styles.switchLabel}>Switch</Text>
          </Pressable>
        </Link>
      </View>

      <Link href="/streak" asChild>
        <Pressable style={styles.streakCard} accessibilityRole="button" accessibilityLabel="Consistency">
          <Text style={styles.streakNumber}>{streak}</Text>
          <Text style={styles.muted}>day{streak === 1 ? "" : "s"} in a row</Text>
        </Pressable>
      </Link>

      <StepsCard steps={steps} styles={styles} />

      <Section title="Focus" rows={rows.focus} track={track} today={today} toggle={toggleItem} dayKey={dayKey} styles={styles} palette={palette} />
      <Section title="Revision" rows={rows.revision} track={track} today={today} toggle={toggleItem} dayKey={dayKey} styles={styles} palette={palette} />

      <View style={styles.links}>
        {(
          [
            ["/materials", "Materials"],
            ["/phases", "Roadmap"],
            ["/notes", "Notes"],
            ["/search", "Search"],
            ["/settings", "Settings"],
          ] as const
        ).map(([href, label]) => (
          <Link key={href} href={href} asChild>
            <Pressable style={styles.link} accessibilityRole="button">
              <Text style={styles.switchLabel}>{label}</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <Pressable
        style={styles.shareButton}
        accessibilityRole="button"
        onPress={() => void shareTrack(track, today, { done, total })}
      >
        <Text style={styles.switchLabel}>Share where this track stands</Text>
      </Pressable>

      {total === 0 && (
        <Text style={styles.empty}>
          Nothing is planned for {dayKey} on this track yet. Add items to the week in Horizon on the web,
          and they appear here.
        </Text>
      )}
    </ScrollView>
  );
}

/** The pedometer, and what to say when it can't be used. A sensor that is
 *  missing, or refused, must leave the screen usable — the rest of the day's
 *  plan has nothing to do with walking. */
function StepsCard({ steps, styles }: { steps: ReturnType<typeof usePedometer>; styles: ReturnType<typeof makeStyles> }) {
  if (steps.status === "checking" || steps.status === "unavailable") return null;

  if (steps.status === "denied") {
    return (
      <Pressable style={styles.stepsCard} accessibilityRole="button" onPress={steps.request}>
        <Text style={styles.stepsLabel}>Count my steps</Text>
        <Text style={styles.muted}>
          Uses this phone's step counter to fill in the day by itself. Say no and nothing changes —
          everything here still works by hand.
        </Text>
        {steps.detail ? <Text style={styles.stepsFootnote}>{steps.detail}</Text> : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.stepsCard}>
      <View style={styles.stepsRow}>
        <Text style={styles.stepsNumber}>{steps.today.toLocaleString()}</Text>
        <Text style={styles.muted}>steps today</Text>
      </View>
      <Text style={styles.stepsFootnote}>Counted while Horizon is open. Android delivers nothing while it's closed.</Text>
    </View>
  );
}

function Section({
  title,
  rows,
  track,
  today,
  toggle,
  dayKey,
  styles,
  palette,
}: {
  title: string;
  rows: Row[];
  track: TrackState;
  today: string;
  toggle: (item: DayItemRef, completed: boolean) => void;
  dayKey: string;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  if (!rows.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.map((row) => {
        const completed = isItemCompleted(track, today, row.kind, row.id);
        return (
          <Pressable
            key={`${row.kind}:${row.id}`}
            style={styles.row}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: completed }}
            accessibilityLabel={row.title}
            onPress={() =>
              toggle({ dateStr: today, kind: row.kind, id: row.id, title: row.title, description: row.description, dayKey }, !completed)
            }
          >
            <View style={[styles.checkbox, completed && { backgroundColor: palette.success, borderColor: palette.success }]}>
              {completed && <Text style={styles.tick}>✓</Text>}
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, completed && styles.rowTitleDone]}>{row.title}</Text>
              {row.description ? <Text style={styles.rowDescription}>{row.description}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.lg },
    centered: { alignItems: "center", justifyContent: "center" },
    header: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
    headerText: { flex: 1, gap: 2 },
    trackName: { color: palette.foreground, fontSize: 22, fontWeight: "700" },
    muted: { color: palette.mutedForeground, fontSize: 13 },
    switchButton: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    switchLabel: { color: palette.foreground, fontSize: 13, fontWeight: "600" },
    streakCard: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    streakNumber: { color: palette.accent, fontSize: 30, fontWeight: "700" },
    stepsCard: {
      gap: SPACING.xs,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    stepsRow: { flexDirection: "row", alignItems: "baseline", gap: SPACING.sm },
    stepsNumber: { color: palette.success, fontSize: 26, fontWeight: "700" },
    stepsLabel: { color: palette.foreground, fontSize: 15, fontWeight: "600" },
    stepsFootnote: { color: palette.subtleForeground, fontSize: 11, lineHeight: 15 },
    section: { gap: SPACING.sm },
    sectionTitle: {
      color: palette.subtleForeground,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: SPACING.md,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: palette.cardBorder,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    tick: { color: "#fff", fontSize: 13, fontWeight: "800" },
    rowText: { flex: 1, gap: 3 },
    rowTitle: { color: palette.foreground, fontSize: 15, lineHeight: 20 },
    rowTitleDone: { color: palette.mutedForeground, textDecorationLine: "line-through" },
    rowDescription: { color: palette.mutedForeground, fontSize: 13, lineHeight: 18 },
    links: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
    link: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    shareButton: {
      alignItems: "center",
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    empty: { color: palette.mutedForeground, fontSize: 14, lineHeight: 20 },
  });
}
