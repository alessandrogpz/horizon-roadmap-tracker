// A workout, logged set by set while it happens.
//
// The screen is a table per exercise: one row per set, carrying what was
// lifted last time, the weight and reps for this one, and a tick. Rows exist
// before they are done — that is the point. You arrive knowing roughly what
// you are about to do, the rows are already there with last time's numbers in
// them, and you tick each one off as you finish it. A screen that could only
// record what had already happened would have nothing to show you between
// sets, which is exactly when it is in your hand.
//
// Nothing here is joined to the calendar or the week yet. It logs today, and
// today is whatever day it is.

import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatDayMonthYear, parseYMD } from "@shared/dates";
import {
  addExercise,
  addSet,
  clearSession,
  doneCountOf,
  lastTime,
  removeExercise,
  removeSet,
  renameExercise,
  sessionFor,
  updateSet,
  volumeOf,
  type GymSet,
} from "@shared/gym";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { useGymLog } from "../gym/useGymLog";
import { Refreshable } from "../components/Refreshable";
import { EmptyState } from "../components/EmptyState";
import { ConfirmSheet, type Confirmation } from "../components/ConfirmSheet";
import { StatTile } from "../components/StatTile";
import { settle, tap } from "../feedback/haptics";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export default function WorkoutScreen() {
  const { track, today } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { log, change } = useGymLog(track?.meta.id);
  const [confirming, setConfirming] = useState<Confirmation | null>(null);

  const session = useMemo(() => sessionFor(log, today), [log, today]);
  const done = doneCountOf(session);
  const volume = volumeOf(session);

  const onAddExercise = useCallback(() => {
    tap();
    change((current) => addExercise(current, today, "New exercise"));
  }, [change, today]);

  if (!track) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>No track open.</Text>
      </View>
    );
  }

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.tiles}>
        <StatTile compact label="Date" value={parseYMD(today).getDate()} unit={monthOf(today)} icon="calendar-outline" />
        <StatTile compact label="Sets done" value={done} icon="checkmark-circle-outline" tint={palette.success} />
        <StatTile compact label="Volume" value={volume} unit="kg" icon="barbell-outline" />
      </View>

      {session.exercises.map((exercise) => (
        <Exercise
          key={exercise.id}
          exercise={exercise}
          previous={lastTime(log, exercise.name, today)}
          onRename={(name) => change((current) => renameExercise(current, today, exercise.id, name))}
          onAddSet={(set) => change((current) => addSet(current, today, exercise.id, set))}
          onUpdateSet={(index, patch) =>
            change((current) => updateSet(current, today, exercise.id, index, patch))
          }
          onRemoveSet={(index) => change((current) => removeSet(current, today, exercise.id, index))}
          onRemove={() =>
            setConfirming({
              title: `Remove ${exercise.name}?`,
              body: "Its sets go with it. Nothing else in the workout changes.",
              verb: "Remove",
              onConfirm: () => change((current) => removeExercise(current, today, exercise.id)),
            })
          }
          styles={styles}
          palette={palette}
        />
      ))}

      {session.exercises.length === 0 ? (
        <EmptyState
          title="Nothing logged today"
          hint="Add the first exercise and its sets appear underneath, ready to tick off."
          action="Add an exercise"
          onAct={onAddExercise}
        />
      ) : (
        <Pressable accessibilityRole="button" onPress={onAddExercise} style={styles.addExercise}>
          <Ionicons name="add" size={16} color={palette.accent} />
          <Text style={styles.addExerciseLabel}>Add exercise</Text>
        </Pressable>
      )}

      {session.exercises.length > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            setConfirming({
              title: "Cancel this workout?",
              body: "Everything logged today goes. Other days are untouched.",
              verb: "Cancel workout",
              onConfirm: () => {
                change((current) => clearSession(current, today));
                settle();
              },
            })
          }
          style={styles.cancel}
        >
          <Text style={styles.cancelLabel}>Cancel workout</Text>
        </Pressable>
      )}

      <ConfirmSheet confirmation={confirming} onClose={() => setConfirming(null)} />
    </Refreshable>
  );
}

/** One exercise: its name, and a row per set. */
function Exercise({
  exercise,
  previous,
  onRename,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
  onRemove,
  styles,
  palette,
}: {
  exercise: { id: string; name: string; sets: GymSet[] };
  previous: { date: string; sets: GymSet[] } | null;
  onRename: (name: string) => void;
  onAddSet: (set: GymSet) => void;
  onUpdateSet: (index: number, patch: Partial<GymSet>) => void;
  onRemoveSet: (index: number) => void;
  onRemove: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <TextInput
          value={exercise.name}
          onChangeText={onRename}
          placeholder="Exercise"
          placeholderTextColor={palette.subtleForeground}
          style={styles.name}
          accessibilityLabel="Exercise name"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${exercise.name}`}
          onPress={onRemove}
          hitSlop={8}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={palette.subtleForeground} />
        </Pressable>
      </View>

      <View style={styles.headRow}>
        <Text style={[styles.headCell, styles.colSet]}>Set</Text>
        <Text style={[styles.headCell, styles.colPrev]}>Previous</Text>
        <Text style={[styles.headCell, styles.colNum]}>Kg</Text>
        <Text style={[styles.headCell, styles.colNum]}>Reps</Text>
        <View style={styles.colTick} />
      </View>

      {exercise.sets.map((set, index) => (
        <SetRow
          key={index}
          index={index}
          set={set}
          // Last time's matching set, so a row opens on the question every set
          // starts with: what did I do before?
          previous={previous?.sets[index]}
          onChange={(patch) => onUpdateSet(index, patch)}
          onRemove={() => onRemoveSet(index)}
          styles={styles}
          palette={palette}
        />
      ))}

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tap();
          // The next set starts where the last one left off, which is what it
          // usually is — and is in any case a better guess than empty.
          const last = exercise.sets[exercise.sets.length - 1];
          onAddSet({ reps: last?.reps ?? 8, weight: last?.weight, done: false });
        }}
        style={styles.addSet}
      >
        <Ionicons name="add" size={15} color={palette.mutedForeground} />
        <Text style={styles.addSetLabel}>Add set</Text>
      </Pressable>
    </View>
  );
}

/** One set. Reads as a line of a table until it is ticked, then as a record. */
function SetRow({
  index,
  set,
  previous,
  onChange,
  onRemove,
  styles,
  palette,
}: {
  index: number;
  set: GymSet;
  previous?: GymSet;
  onChange: (patch: Partial<GymSet>) => void;
  onRemove: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const done = Boolean(set.done);

  return (
    <View style={[styles.row, done && { backgroundColor: `${palette.success}1a` }]}>
      <Text style={[styles.cell, styles.colSet, done && { color: palette.success }]}>{index + 1}</Text>

      <Text style={[styles.cell, styles.colPrev, styles.prev]} numberOfLines={1}>
        {previous ? `${previous.weight ?? 0} kg × ${previous.reps}` : "—"}
      </Text>

      <NumberCell
        value={set.weight}
        placeholder={previous?.weight}
        onChange={(weight) => onChange({ weight })}
        label={`Weight for set ${index + 1}`}
        styles={styles}
        palette={palette}
      />
      <NumberCell
        value={set.reps}
        placeholder={previous?.reps}
        onChange={(reps) => onChange({ reps: reps ?? 0 })}
        label={`Reps for set ${index + 1}`}
        styles={styles}
        palette={palette}
      />

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`Set ${index + 1} done`}
        onPress={() => {
          tap();
          onChange({ done: !done });
        }}
        onLongPress={onRemove}
        delayLongPress={400}
        style={[styles.tick, done && { backgroundColor: palette.success, borderColor: palette.success }]}
      >
        <Ionicons name="checkmark" size={16} color={done ? palette.background : palette.subtleForeground} />
      </Pressable>
    </View>
  );
}

/** A number you type into a table cell. Empty rather than zero when unset: a
 *  set with no weight yet is not a set of nothing. */
function NumberCell({
  value,
  placeholder,
  onChange,
  label,
  styles,
  palette,
}: {
  value: number | undefined;
  placeholder: number | undefined;
  onChange: (value: number | undefined) => void;
  label: string;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  return (
    <TextInput
      value={value === undefined ? "" : String(value)}
      onChangeText={(text) => {
        const cleaned = text.replace(/[^0-9.]/g, "");
        onChange(cleaned === "" ? undefined : Number(cleaned));
      }}
      placeholder={placeholder === undefined ? "–" : String(placeholder)}
      placeholderTextColor={palette.subtleForeground}
      keyboardType="decimal-pad"
      selectTextOnFocus
      style={[styles.cell, styles.colNum, styles.input]}
      accessibilityLabel={label}
    />
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthOf = (date: string) => MONTHS[parseYMD(date).getMonth()];

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xl },
    centered: { alignItems: "center", justifyContent: "center" },
    tiles: { flexDirection: "row", gap: SPACING.sm },
    card: {
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
      overflow: "hidden",
    },
    cardHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    name: { ...TYPE.subhead, flex: 1, color: palette.accent, fontWeight: "700", padding: 0 },
    headRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.xs,
    },
    headCell: { ...TYPE.eyebrow, color: palette.subtleForeground, fontWeight: "700" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
    },
    cell: { ...TYPE.label, color: palette.foreground, fontWeight: "600" },
    // The columns. Fixed rather than flexed, so every row in every exercise
    // lines up with the header and with each other.
    colSet: { width: 26 },
    colPrev: { flex: 1 },
    colNum: { width: 54, textAlign: "center" },
    colTick: { width: 34 },
    prev: { color: palette.subtleForeground, fontWeight: "400" },
    input: {
      paddingVertical: 5,
      borderRadius: RADIUS.control,
      backgroundColor: palette.surfaceMuted,
    },
    tick: {
      width: 34,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    addSet: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.xs,
      paddingVertical: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: palette.cardBorder,
      marginTop: SPACING.xs,
    },
    addSetLabel: { ...TYPE.label, color: palette.mutedForeground, fontWeight: "600" },
    addExercise: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.xs,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: palette.cardBorder,
    },
    addExerciseLabel: { ...TYPE.label, color: palette.accent, fontWeight: "700" },
    cancel: { alignItems: "center", paddingVertical: SPACING.md },
    cancelLabel: { ...TYPE.label, color: palette.danger, fontWeight: "700" },
    muted: { ...TYPE.body, color: palette.mutedForeground },
  });
}
