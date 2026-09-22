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

      <View style={styles.streakCard}>
        <Text style={styles.streakNumber}>{streak}</Text>
        <Text style={styles.muted}>day{streak === 1 ? "" : "s"} in a row</Text>
      </View>

      <Section title="Focus" rows={rows.focus} track={track} today={today} toggle={toggleItem} dayKey={dayKey} styles={styles} palette={palette} />
      <Section title="Revision" rows={rows.revision} track={track} today={today} toggle={toggleItem} dayKey={dayKey} styles={styles} palette={palette} />

      {total === 0 && (
        <Text style={styles.empty}>
          Nothing is planned for {dayKey} on this track yet. Add items to the week in Horizon on the web,
          and they appear here.
        </Text>
      )}
    </ScrollView>
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
    empty: { color: palette.mutedForeground, fontSize: 14, lineHeight: 20 },
  });
}
