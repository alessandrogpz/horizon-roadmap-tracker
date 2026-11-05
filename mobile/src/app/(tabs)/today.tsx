// The day: what this track asks of you, and the streak riding on it.
//
// Usually today, but not necessarily. A day can be stepped through in either
// direction, because the common reason to open this app in the evening is to
// tick something from yesterday that never got ticked — and a screen that can
// only ever show today makes that impossible rather than merely awkward.
//
// What stays pinned to the real today: the streak and the daily reset. Those
// are facts about now, not about the day being looked at.
//
// The step counter used to live here and does not any more: it is a panel in
// My Space, which is where it belongs — useful on a fitness track, noise on
// everything else, and not something every track's day should carry.
//
// Every rule here comes from the shared core — which day of the week a date is
// (`dates`), whether an item counts as done (`completions`), how long the
// streak is (`streak`). This screen decides only how it looks and what a tap
// does.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Refreshable } from "../../components/Refreshable";
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
import { trackStreak } from "@shared/restDays";
import { DAYS_SHORT, formatDateYMD, formatDayMonthYear, getWeekNum, parseYMD } from "@shared/dates";
import { dayItems, NEW_ITEM_KIND } from "@shared/dayItems";
import { focusOfDay } from "@shared/focusTypes";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { useMasterMode } from "../../master/MasterMode";
import { MasterToday } from "../../master/MasterToday";
import { useUndo } from "../../components/UndoBar";
import { tap } from "../../feedback/haptics";
import { leading, RADIUS, SPACING, TYPE, type Palette } from "../../theme";
import { centredContent } from "../../layout";
import { usePalette } from "../../theme/ThemeProvider";
import { EditButton, useEditMode } from "../../components/EditToggle";
import { TodaysTodos } from "../../components/TodaysTodos";
import { setTodosOpen, todosOpen } from "../../storage/deviceSettings";
import { Tappable } from "../../components/Tappable";

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
 * Today's items, in one list — the same list, in the same order, that the
 * website's weekly plan and its day editor show, because all three go through
 * `dayItems`. A phone showing a different Tuesday from the laptop would be
 * worse than a phone showing none.
 */
function rowsFor(track: TrackState, dateStr: string): Row[] {
  const dayKey = DAYS_SHORT[parseYMD(dateStr).getDay()];
  const weekNum = track.startDate ? getWeekNum(track.startDate, parseYMD(dateStr)) : 1;
  return dayItems(track, dayKey, weekNum).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    kind: item.kind,
    generated: item.generated,
  }));
}

export default function TodayScreen() {
  // All tracks is the same tab, read-only, with every track folded in.
  // Returned before anything else so the single-track hooks below do not
  // run for a track nobody is looking at.
  const { master } = useMasterMode();
  if (master) return <MasterToday />;

  const { workspace, track, today, loading, toggleItem, editTrack, restoreWorkspace } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();

  // The day on screen, which starts as today and is reset to it whenever the
  // real date changes underneath (midnight, or coming back from the
  // background) — otherwise a phone left open overnight would quietly keep
  // showing yesterday as though it were today.
  const { editing, setEditing } = useEditMode();
  const { offer } = useUndo();
  const [todosShown, setTodosShown] = useState(() => todosOpen(track?.meta.id));
  useEffect(() => setTodosShown(todosOpen(track?.meta.id)), [track?.meta.id]);
  const [viewing, setViewing] = useState(today);
  useEffect(() => setViewing(today), [today]);

  const step = useCallback((days: number) => {
    setViewing((current) => {
      const date = parseYMD(current);
      date.setDate(date.getDate() + days);
      return formatDateYMD(date);
    });
  }, []);

  const rows = useMemo(() => (track ? rowsFor(track, viewing) : []), [track, viewing]);

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
    (row: Row, key: DayKey, date: string) => {
      const previous = workspace;
      editTrack((t) =>
        removeDayItem(t, { dateStr: date, kind: row.kind, id: row.id, title: row.title, dayKey: key })
      );
      if (previous) offer("Item removed", () => restoreWorkspace(previous));
    },
    [editTrack, offer, restoreWorkspace, workspace]
  );
  const streak = useMemo(() => trackStreak(track, today), [track, today]);

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

  const dayKey = DAYS_SHORT[parseYMD(viewing).getDay()] as DayKey;
  const onToday = viewing === today;
  const done = rows.filter((row) => isItemCompleted(track, viewing, row.kind, row.id)).length;
  const total = rows.length;
  /** What this weekday is for, per the track's rhythm. */
  const kind = focusOfDay(track?.weekSchedule, dayKey);
  // How the day is going and how long the run is, in one line under the date —
  // two numbers do not need two cards.
  const summary =
    (total ? `${done} of ${total} done` : "nothing planned") +
    (streak > 0 ? ` · ${streak} day${streak === 1 ? "" : "s"} in a row` : "");

  return (
    <Refreshable
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.dayBar}>
        <Tappable
          accessibilityRole="button"
          accessibilityLabel="The day before"
          onPress={() => step(-1)}
          style={styles.dayStep}
        >
          <Text style={styles.dayStepLabel}>‹</Text>
        </Tappable>

        <Tappable
          accessibilityRole="button"
          accessibilityLabel={onToday ? "Today" : "Back to today"}
          onPress={() => setViewing(today)}
          style={styles.dayLabelWrap}
        >
          <Text style={styles.dayLabel}>
            {onToday ? "Today" : `${dayKey} ${formatDayMonthYear(parseYMD(viewing))}`}
          </Text>
          {/* The date is always here now. It used to say "Today · Fri", which
              is the one day you do not need naming and the one line that could
              have carried its date. The kind of day comes from the track's own
              rhythm, so this screen and the week agree about what a Friday is
              for without being told twice. */}
          <Text style={styles.dayHint}>
            {onToday
              ? `${formatDayMonthYear(parseYMD(viewing))}${kind ? ` · ${kind.label}` : ""}`
              : "Tap to come back to today"}
          </Text>
          {onToday && <Text style={styles.dayHint}>{summary}</Text>}
        </Tappable>

        <Tappable
          accessibilityRole="button"
          accessibilityLabel="The day after"
          onPress={() => step(1)}
          style={styles.dayStep}
        >
          <Text style={styles.dayStepLabel}>›</Text>
        </Tappable>
      </View>

      {/* Ticking is never behind the switch — it is the thing this screen is
          for. What the switch guards is changing *what the day contains*. */}
      <View style={styles.editRow}>
        <EditButton editing={editing} onChange={setEditing} what={`${dayKey}'s plan`} />
      </View>

      <Section
        rows={rows}
        track={track}
        date={viewing}
        toggle={toggleItem}
        dayKey={dayKey}
        editing={editing}
        onAdd={(title) => addItem(NEW_ITEM_KIND, dayKey, title)}
        onRename={(row, title) => renameItem(row.kind, dayKey, row.id, title)}
        onRemove={(row) => deleteItem(row, dayKey, viewing)}
        styles={styles}
        palette={palette}
      />

      <TodaysTodos
        trackId={track.meta.id}
        editing={editing}
        open={todosShown}
        onOpenChange={(next) => {
          setTodosShown(next);
          setTodosOpen(track.meta.id, next);
        }}
      />

      {/* An empty day says what to do about it and offers to start, rather
          than describing the emptiness and leaving you to work out that Edit
          is the way in. */}
      {total === 0 && !editing && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nothing planned for {dayKey}</Text>
          <Text style={styles.muted}>
            Whatever you add here becomes part of every {dayKey} on this track.
          </Text>
          <Tappable
            accessibilityRole="button"
            onPress={() => setEditing(true)}
            style={styles.primaryButton}
          >
            <Ionicons name="add" size={16} color={palette.background} />
            <Text style={styles.primaryLabel}>Plan this day</Text>
          </Tappable>
        </View>
      )}
    </Refreshable>
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
  rows,
  track,
  date,
  editing,
  toggle,
  dayKey,
  onAdd,
  onRename,
  onRemove,
  styles,
  palette,
}: {
  rows: Row[];
  track: TrackState;
  /** The day being shown, which is not always today. */
  date: string;
  /** Whether the screen is in edit mode. Ticking ignores it. */
  editing: boolean;
  toggle: (item: DayItemRef, completed: boolean) => void;
  /** The weekday a stored item's completion is recorded against. */
  dayKey: string;
  onAdd: (title: string) => void;
  onRename: (row: Row, title: string) => void;
  onRemove: (row: Row) => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState("");

  const save = (row: Row) => {
    const next = draft.trim();
    if (next && next !== row.title) onRename(row, next);
    setRenaming(null);
  };

  // Nothing to show and nothing to add into.
  if (rows.length === 0 && !editing) return null;

  return (
    <View style={styles.section}>

      {rows.map((row) => {
        const completed = isItemCompleted(track, date, row.kind, row.id);

        if (renaming === row.id) {
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
              <Tappable accessibilityRole="button" onPress={() => save(row)} style={styles.rowAction}>
                <Text style={styles.rowActionLabel}>Save</Text>
              </Tappable>
              <Tappable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${row.title}`}
                onPress={() => {
                  setRenaming(null);
                  onRemove(row);
                }}
                style={styles.rowAction}
              >
                <Text style={[styles.rowActionLabel, { color: palette.danger }]}>Remove</Text>
              </Tappable>
            </View>
          );
        }

        return (
          <Tappable
            key={`${row.kind}:${row.id}`}
            style={styles.row}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: completed }}
            accessibilityLabel={row.title}
            accessibilityHint={editing && !row.generated ? "Hold to rename or remove" : undefined}
            onPress={() => {
              tap();
              toggle(
                { dateStr: date, kind: row.kind, id: row.id, title: row.title, description: row.description, dayKey },
                !completed
              );
            }}
            onLongPress={
              !editing || row.generated
                ? undefined
                : () => {
                    setDraft(row.title);
                    setRenaming(row.id);
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
          </Tappable>
        );
      })}

      {editing && (
      <TextInput
        value={adding}
        onChangeText={setAdding}
        onSubmitEditing={() => {
          const text = adding.trim();
          if (!text) return;
          onAdd(text);
          setAdding("");
        }}
        placeholder={`Add to ${dayKey}…`}
        placeholderTextColor={palette.subtleForeground}
        returnKeyType="done"
        style={styles.addInput}
        accessibilityLabel={`Add an item to ${dayKey}`}
      />
      )}
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.lg , ...centredContent },
    centered: { alignItems: "center", justifyContent: "center" },
    muted: { color: palette.mutedForeground, ...TYPE.label},
    footerActions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md },
    footerAction: {
      flex: 1,
      alignItems: "center",
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
    footerLabel: { color: palette.mutedForeground, ...TYPE.caption, fontWeight: "600" },
    dayBar: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    dayStep: {
      width: 40,
      alignItems: "center",
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    dayStepLabel: { color: palette.foreground, ...TYPE.title, lineHeight: leading(TYPE.title.fontSize, 1.2) },
    dayLabelWrap: { flex: 1, alignItems: "center" },
    dayLabel: { color: palette.foreground, ...TYPE.body, fontWeight: "600" },
    dayHint: { color: palette.subtleForeground, ...TYPE.micro},
    editRow: { flexDirection: "row", justifyContent: "flex-end" },
    editInput: {
      flex: 1,
      color: palette.foreground,
      ...TYPE.subhead,
      paddingVertical: SPACING.xs,
    },
    rowAction: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
    rowActionLabel: { color: palette.mutedForeground, ...TYPE.label, fontWeight: "600" },
    addInput: {
      marginTop: SPACING.xs,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: palette.cardBorder,
      color: palette.foreground,
      ...TYPE.body,
    },
    section: { gap: SPACING.sm },
    emptyCard: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
      marginTop: SPACING.sm,
    },
    emptyTitle: { color: palette.foreground, ...TYPE.subhead, fontWeight: "700" },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.xs,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      backgroundColor: palette.accent,
      marginTop: SPACING.xs,
    },
    primaryLabel: { color: palette.background, ...TYPE.body, fontWeight: "700" },
    sectionTitle: {
      color: palette.subtleForeground,
      ...TYPE.marker,
      fontWeight: "700",
      letterSpacing: 1.2,
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
    tick: { color: "#fff", ...TYPE.label, fontWeight: "800" },
    rowText: { flex: 1, gap: 3 },
    rowTitle: { color: palette.foreground, ...TYPE.subhead, lineHeight: leading(TYPE.subhead.fontSize, 1.35) },
    rowTitleDone: { color: palette.mutedForeground, textDecorationLine: "line-through" },
    rowDescription: { color: palette.mutedForeground, ...TYPE.label, lineHeight: leading(TYPE.label.fontSize, 1.4) },
    empty: { color: palette.mutedForeground, ...TYPE.body, lineHeight: leading(TYPE.body.fontSize, 1.45) },
  });
}
