// Workouts: a push day, a pull day, whatever you have made — and inside one,
// a table per exercise.
//
// The exercises belong to the workout rather than to a date, because a workout
// is a thing you come back to. You do not open this to see what the 12th of
// March was; you open it to do pull day again, and to see what you lifted last
// time you did it. So opening the screen asks which one, and opening one shows
// it exactly as you left it — the same weights, ready to be beaten.
//
// Rows exist before they are done. You arrive knowing roughly what you are
// about to do, the rows are already there with last time's numbers in them,
// and you tick each off as you finish it. A screen that could only record what
// had already happened would have nothing to show you between sets, which is
// exactly when it is in your hand.
//
// Nothing here is joined to the calendar or the week yet.

import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  addWorkout,
  addWorkoutExercise,
  addWorkoutSet,
  removeWorkout,
  removeWorkoutExercise,
  removeWorkoutSet,
  renameWorkout,
  renameWorkoutExercise,
  resetWorkout,
  setsInWorkout,
  updateWorkoutSet,
  workoutById,
  workoutsOf,
  type GymSet,
} from "@shared/gym";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { useGymLog } from "../gym/useGymLog";
import { Refreshable } from "../components/Refreshable";
import { EmptyState } from "../components/EmptyState";
import { ConfirmSheet, type Confirmation } from "../components/ConfirmSheet";
import { settle, tap } from "../feedback/haptics";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { Tappable } from "../components/Tappable";

export default function WorkoutScreen() {
  const { track } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { log, change } = useGymLog(track?.meta.id);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirmation | null>(null);

  const workouts = workoutsOf(log);
  const open = openId ? workoutById(log, openId) : undefined;

  const create = useCallback(() => {
    tap();
    change((current) => {
      const { log: next, workout } = addWorkout(current, `Workout ${workoutsOf(current).length + 1}`);
      // Straight into the new one: nobody makes a workout in order to look at
      // it in a list.
      setOpenId(workout.id);
      return next;
    });
  }, [change]);

  if (!track) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>No track open.</Text>
      </View>
    );
  }

  if (!open) {
    return (
      <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
        {workouts.length === 0 ? (
          <EmptyState
            title="No workouts yet"
            hint="A workout is a day you repeat — push, pull, legs. Make one and fill it with exercises."
            action="New workout"
            onAct={create}
          />
        ) : (
          <>
            {workouts.map((workout) => (
              <Tappable
                key={workout.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${workout.name}`}
                onPress={() => {
                  tap();
                  setOpenId(workout.id);
                }}
                style={styles.pick}
              >
                <View style={[styles.pickIcon, { backgroundColor: `${palette.accent}22` }]}>
                  <Ionicons name="barbell-outline" size={17} color={palette.accent} />
                </View>
                <View style={styles.pickText}>
                  <Text style={styles.pickName}>{workout.name}</Text>
                  <Text style={styles.muted}>
                    {workout.exercises.length === 0
                      ? "Nothing in it yet"
                      : `${workout.exercises.length} exercise${workout.exercises.length === 1 ? "" : "s"} · ${setsInWorkout(workout)} set${setsInWorkout(workout) === 1 ? "" : "s"}`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={palette.subtleForeground} />
              </Tappable>
            ))}

            <Tappable accessibilityRole="button" onPress={create} style={styles.addExercise}>
              <Ionicons name="add" size={16} color={palette.accent} />
              <Text style={styles.addExerciseLabel}>New workout</Text>
            </Tappable>
          </>
        )}

        <ConfirmSheet confirmation={confirming} onClose={() => setConfirming(null)} />
      </Refreshable>
    );
  }

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.bar}>
        <Tappable
          accessibilityRole="button"
          accessibilityLabel="Back to workouts"
          onPress={() => setOpenId(null)}
          hitSlop={8}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={18} color={palette.foreground} />
        </Tappable>

        <TextInput
          value={open.name}
          onChangeText={(name) => change((current) => renameWorkout(current, open.id, name))}
          placeholder="Workout"
          placeholderTextColor={palette.subtleForeground}
          style={styles.workoutName}
          accessibilityLabel="Workout name"
        />

        <Tappable
          accessibilityRole="button"
          accessibilityLabel="Start this workout again"
          onPress={() =>
            setConfirming({
              title: `Start ${open.name} again?`,
              body: "Every set is unticked. The weights and reps stay where they are.",
              verb: "Start again",
              onConfirm: () => {
                change((current) => resetWorkout(current, open.id));
                settle();
              },
            })
          }
          hitSlop={8}
          style={styles.back}
        >
          <Ionicons name="refresh" size={17} color={palette.mutedForeground} />
        </Tappable>
      </View>

      <Animated.View key={open.id} entering={FadeIn.duration(200)} style={styles.stack}>
        {open.exercises.map((exercise) => (
          <Exercise
            key={exercise.id}
            exercise={exercise}
            onRename={(name) => change((current) => renameWorkoutExercise(current, open.id, exercise.id, name))}
            onAddSet={(set) => change((current) => addWorkoutSet(current, open.id, exercise.id, set))}
            onUpdateSet={(index, patch) =>
              change((current) => updateWorkoutSet(current, open.id, exercise.id, index, patch))
            }
            onRemoveSet={(index) => change((current) => removeWorkoutSet(current, open.id, exercise.id, index))}
            onRemove={() =>
              setConfirming({
                title: `Remove ${exercise.name}?`,
                body: "Its sets go with it. Nothing else in the workout changes.",
                verb: "Remove",
                onConfirm: () => change((current) => removeWorkoutExercise(current, open.id, exercise.id)),
              })
            }
            styles={styles}
            palette={palette}
          />
        ))}

        {open.exercises.length === 0 ? (
          <EmptyState
            title={`Nothing in ${open.name} yet`}
            hint="Add an exercise and its sets appear underneath, ready to tick off."
            action="Add an exercise"
            onAct={() => {
              tap();
              change((current) => addWorkoutExercise(current, open.id, "New exercise"));
            }}
          />
        ) : (
          <Tappable
            accessibilityRole="button"
            onPress={() => {
              tap();
              change((current) => addWorkoutExercise(current, open.id, "New exercise"));
            }}
            style={styles.addExercise}
          >
            <Ionicons name="add" size={16} color={palette.accent} />
            <Text style={styles.addExerciseLabel}>Add exercise</Text>
          </Tappable>
        )}
      </Animated.View>

      <Tappable
        accessibilityRole="button"
        onPress={() =>
          setConfirming({
            title: `Delete ${open.name}?`,
            body: "The workout and everything in it goes. Other workouts are untouched.",
            verb: "Delete",
            onConfirm: () => {
              change((current) => removeWorkout(current, open.id));
              setOpenId(null);
              settle();
            },
          })
        }
        style={styles.cancel}
      >
        <Text style={styles.cancelLabel}>Delete workout</Text>
      </Tappable>

      <ConfirmSheet confirmation={confirming} onClose={() => setConfirming(null)} />
    </Refreshable>
  );
}

/** One exercise: its name, and a row per set. */
function Exercise({
  exercise,
  onRename,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
  onRemove,
  styles,
  palette,
}: {
  exercise: { id: string; name: string; sets: GymSet[] };
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
        <Tappable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${exercise.name}`}
          onPress={onRemove}
          hitSlop={8}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={palette.subtleForeground} />
        </Tappable>
      </View>

      <View style={styles.headRow}>
        <Text style={[styles.headCell, styles.colSet]}>Set</Text>
        {/* No "last time" column: the weights live in the workout itself, so
            what is in the Kg box already is what you left there. A column that
            is empty on every row is a column that says nothing. */}
        <View style={styles.colPrev} />
        <Text style={[styles.headCell, styles.colNum]}>Kg</Text>
        <Text style={[styles.headCell, styles.colNum]}>Reps</Text>
        <View style={styles.colTick} />
      </View>

      {exercise.sets.map((set, index) => (
        <SetRow
          key={index}
          index={index}
          set={set}
          onChange={(patch) => onUpdateSet(index, patch)}
          onRemove={() => onRemoveSet(index)}
          styles={styles}
          palette={palette}
        />
      ))}

      <Tappable
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
      </Tappable>
    </View>
  );
}

/** One set. Reads as a line of a table until it is ticked, then as a record. */
function SetRow({
  index,
  set,
  onChange,
  onRemove,
  styles,
  palette,
}: {
  index: number;
  set: GymSet;
  onChange: (patch: Partial<GymSet>) => void;
  onRemove: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const done = Boolean(set.done);

  return (
    <View style={[styles.row, done && { backgroundColor: `${palette.success}1a` }]}>
      <Text style={[styles.cell, styles.colSet, done && { color: palette.success }]}>{index + 1}</Text>

      <View style={styles.colPrev} />

      <NumberCell
        value={set.weight}
        placeholder={undefined}
        onChange={(weight) => onChange({ weight })}
        label={`Weight for set ${index + 1}`}
        styles={styles}
        palette={palette}
      />
      <NumberCell
        value={set.reps}
        placeholder={undefined}
        onChange={(reps) => onChange({ reps: reps ?? 0 })}
        label={`Reps for set ${index + 1}`}
        styles={styles}
        palette={palette}
      />

      <Tappable
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
      </Tappable>
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

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xl },
    centered: { alignItems: "center", justifyContent: "center" },
    stack: { gap: SPACING.md },
    // Choosing a workout.
    pick: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    pickIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    pickText: { flex: 1, gap: 1 },
    pickName: { ...TYPE.subhead, color: palette.foreground, fontWeight: "700" },
    // Inside one.
    bar: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    back: {
      minWidth: 34,
      minHeight: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    workoutName: { ...TYPE.heading, flex: 1, color: palette.foreground, fontWeight: "700", padding: 0 },
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
    headCell: { ...TYPE.marker, color: palette.subtleForeground, fontWeight: "700" },
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
