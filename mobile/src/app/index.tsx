// Today: what this track asks of you on this day, and the streak riding on it.
//
// Every rule here comes from the shared core — which day of the week today is
// (`dates`), whether an item counts as done (`completions`), how long the
// streak is (`streak`). This screen decides only how it looks and what a tap
// does.

import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DayKey, TrackState } from "@shared/types";
import {
  addDayItem,
  isItemCompleted,
  removeDayItem,
  updateDayItem,
  type DayItemRef,
  type ItemKind,
} from "@shared/completions";
import { currentStreakLength } from "@shared/streak";
import { DAYS_SHORT, getWeekNum, parseYMD } from "@shared/dates";
import { computeRotationItemsForDay, isRotationItem } from "@shared/rotation";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { usePedometer } from "../steps/usePedometer";
import { shareTrack } from "../share/shareTrack";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

interface Row {
  id: string;
  title: string;
  description?: string;
  kind: ItemKind;
  /** Computed by a rotation for this week rather than stored on the day. It can
   *  be ticked but not renamed or removed: there is no stored item to change,
   *  and next week it will be something else. Editing the rotation's list on
   *  the Week screen is what changes these. */
  generated?: boolean;
}

/**
 * Today's items: what the week's rhythm stores for this weekday, plus whatever
 * the track's rotations put there for *this* week.
 *
 * Rotations cycle — "Linear Algebra this week, OpenGL next" — so their items
 * are computed from the rotation's definition and the week number, never read
 * back from storage. A stored rotation item is last week's answer, which is why
 * they are filtered out before the computed ones are added. This is the rule
 * the website's weekly plan follows, from the same shared functions; a phone
 * showing a different revision topic from the laptop would be worse than a
 * phone showing none.
 */
function rowsFor(track: TrackState, dateStr: string): { focus: Row[]; revision: Row[] } {
  const dayKey = DAYS_SHORT[parseYMD(dateStr).getDay()];
  const storedFocus = track.dailyTasks?.[dayKey] ?? [];
  const storedRevision = track.dailyRevisionItems?.[dayKey] ?? [];

  const rotations = track.rotations ?? [];
  const weekNum = track.startDate ? getWeekNum(track.startDate, parseYMD(dateStr)) : 1;
  const computed = rotations.length ? computeRotationItemsForDay(rotations, weekNum, dayKey) : { focus: [], revisions: [] };

  const focus = rotations.length ? [...computed.focus, ...storedFocus.filter((it) => !isRotationItem(it))] : storedFocus;
  const revision = rotations.length
    ? [...computed.revisions, ...storedRevision.filter((it) => !isRotationItem(it))]
    : storedRevision;

  const generated = new Set([...computed.focus, ...computed.revisions].map((item) => item.id));
  return {
    focus: focus.map((item) => ({
      id: item.id,
      title: item.title,
      kind: "focus" as const,
      generated: generated.has(item.id),
    })),
    revision: revision.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      kind: "revision" as const,
      generated: generated.has(item.id),
    })),
  };
}

export default function TodayScreen() {
  const { track, today, loading, toggleItem, editTrack } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();

  const rows = useMemo(() => (track ? rowsFor(track, today) : { focus: [], revision: [] }), [track, today]);

  // A day's own items live under its weekday, not its date: "what Tuesdays are
  // for" rather than "what happened on the 24th". Adding one here adds it to
  // every Tuesday, which is what the website does and what the week view
  // shows.
  const addItem = useCallback(
    (kind: ItemKind, key: DayKey, title: string) => editTrack((t) => addDayItem(t, key, kind, { title })),
    [editTrack]
  );

  const renameItem = useCallback(
    (kind: ItemKind, key: DayKey, id: string, title: string) =>
      editTrack((t) => updateDayItem(t, key, kind, id, { title })),
    [editTrack]
  );

  const deleteItem = useCallback(
    (row: Row, key: DayKey, date: string) =>
      editTrack((t) =>
        removeDayItem(t, { dateStr: date, kind: row.kind, id: row.id, title: row.title, dayKey: key })
      ),
    [editTrack]
  );
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

  const dayKey = DAYS_SHORT[parseYMD(today).getDay()] as DayKey;
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

      {(["focus", "revision"] as const).map((kind) => (
        <Section
          key={kind}
          title={kind === "focus" ? "Focus" : "Revision"}
          kind={kind}
          rows={kind === "focus" ? rows.focus : rows.revision}
          track={track}
          today={today}
          toggle={toggleItem}
          dayKey={dayKey}
          onAdd={(title) => addItem(kind, dayKey, title)}
          onRename={(id, title) => renameItem(kind, dayKey, id, title)}
          onRemove={(row) => deleteItem(row, dayKey, today)}
          styles={styles}
          palette={palette}
        />
      ))}

      <View style={styles.links}>
        {(
          [
            ["/materials", "Materials"],
            ["/phases", "Phases"],
            ["/roadmap", "Roadmap"],
            ["/rhythm", "Week"],
            ["/portfolio", "Deliverables"],
            ["/notes", "Notes"],
            ["/timer", "Focus"],
            ["/search", "Search"],
            ["/insights", "History"],
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
          Nothing is planned for {dayKey} on this track yet — add something above, and it becomes part of
          every {dayKey}.
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

/**
 * One of the day's two checklists.
 *
 * Tapping a row ticks it; holding one opens it for renaming or removal. A long
 * press rather than a visible button because ticking is what happens a dozen
 * times a day and editing is what happens once a week — the common action gets
 * the whole row, and the rare one does not clutter it.
 *
 * Rotation items are ticked like any other but cannot be edited here: nothing
 * is stored to edit. They come from the rotation's list, and that is where they
 * change.
 */
function Section({
  title,
  kind,
  rows,
  track,
  today,
  toggle,
  dayKey,
  onAdd,
  onRename,
  onRemove,
  styles,
  palette,
}: {
  title: string;
  kind: ItemKind;
  rows: Row[];
  track: TrackState;
  today: string;
  toggle: (item: DayItemRef, completed: boolean) => void;
  dayKey: string;
  onAdd: (title: string) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (row: Row) => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState("");

  const save = (row: Row) => {
    const next = draft.trim();
    if (next && next !== row.title) onRename(row.id, next);
    setEditing(null);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {rows.map((row) => {
        const completed = isItemCompleted(track, today, row.kind, row.id);

        if (editing === row.id) {
          return (
            <View key={`${row.kind}:${row.id}`} style={styles.row}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => save(row)}
                autoFocus
                style={styles.editInput}
                accessibilityLabel={`Rename ${row.title}`}
              />
              <Pressable accessibilityRole="button" onPress={() => save(row)} style={styles.rowAction}>
                <Text style={styles.rowActionLabel}>Save</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${row.title}`}
                onPress={() => {
                  setEditing(null);
                  onRemove(row);
                }}
                style={styles.rowAction}
              >
                <Text style={[styles.rowActionLabel, { color: palette.danger }]}>Remove</Text>
              </Pressable>
            </View>
          );
        }

        return (
          <Pressable
            key={`${row.kind}:${row.id}`}
            style={styles.row}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: completed }}
            accessibilityLabel={row.title}
            accessibilityHint={row.generated ? undefined : "Hold to rename or remove"}
            onPress={() =>
              toggle({ dateStr: today, kind: row.kind, id: row.id, title: row.title, description: row.description, dayKey }, !completed)
            }
            onLongPress={
              row.generated
                ? undefined
                : () => {
                    setDraft(row.title);
                    setEditing(row.id);
                  }
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

      <TextInput
        value={adding}
        onChangeText={setAdding}
        onSubmitEditing={() => {
          const text = adding.trim();
          if (!text) return;
          onAdd(text);
          setAdding("");
        }}
        placeholder={kind === "focus" ? `Add to ${dayKey}'s focus…` : `Add something to revise…`}
        placeholderTextColor={palette.subtleForeground}
        returnKeyType="done"
        style={styles.addInput}
        accessibilityLabel={`Add a ${kind} item to ${dayKey}`}
      />
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
    editInput: {
      flex: 1,
      color: palette.foreground,
      fontSize: 15,
      paddingVertical: SPACING.xs,
    },
    rowAction: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
    rowActionLabel: { color: palette.mutedForeground, fontSize: 13, fontWeight: "600" },
    addInput: {
      marginTop: SPACING.xs,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: palette.cardBorder,
      color: palette.foreground,
      fontSize: 14,
    },
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
