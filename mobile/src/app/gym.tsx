// The gym screen: what today is for, and the sets logged against it.
//
// Built for use with one hand, standing up, between sets — which rules out
// most of what a form normally does. No save button, no modal per set, no
// keyboard for the common case: reps and weight are steppers with sensible
// increments, because typing "8" into a numeric field with sweaty hands is
// worse than tapping + twice.
//
// The weekly split answers "what am I doing today" without being asked; the
// day can override it when the plan meets reality. And every exercise shows
// what it was last time, because that is the question every working set starts
// with and looking it up is the thing a paper notebook is bad at.

import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  addExercise,
  addSet,
  FOCUS_LABEL,
  focusFor,
  GYM_FOCUSES,
  lastTime,
  removeExercise,
  removeSet,
  sessionFor,
  setCountOf,
  setDayFocus,
  setSplit,
  volumeOf,
  type GymFocus,
} from "@shared/gym";
import { DAYS_SHORT, formatDayMonthYear, parseYMD } from "@shared/dates";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { useGymLog } from "../gym/useGymLog";
import { Refreshable } from "../components/Refreshable";
import { EditButton, useEditMode } from "../components/EditToggle";
import { NoTrack } from "../components/NoTrack";
import { tap, warn } from "../feedback/haptics";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export default function GymScreen() {
  const { track, today } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { log, change } = useGymLog(track?.meta.id);
  const { editing, setEditing } = useEditMode();
  const [newExercise, setNewExercise] = useState("");

  const dayKey = DAYS_SHORT[parseYMD(today).getDay()];
  const focus = focusFor(log, today, dayKey);
  const session = sessionFor(log, today);

  const logSet = useCallback(
    (exerciseId: string, reps: number, weight: number) => {
      tap();
      change((current) =>
        addSet(current, today, exerciseId, { reps, ...(weight > 0 ? { weight } : {}) })
      );
    },
    [change, today]
  );

  if (!track) return <NoTrack />;

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Today's focus, big, because it is the one thing you check on the way
          in. Tapping any chip overrides the split for today only. */}
      <View style={styles.headline}>
        <View style={styles.headlineText}>
          <Text style={styles.focus}>{focus ? FOCUS_LABEL[focus] : "No focus set"}</Text>
          <Text style={styles.muted}>{formatDayMonthYear(parseYMD(today))}</Text>
        </View>
        <View style={styles.totals}>
          <Text style={styles.totalValue}>{setCountOf(session)}</Text>
          <Text style={styles.muted}>sets</Text>
        </View>
        {volumeOf(session) > 0 && (
          <View style={styles.totals}>
            <Text style={styles.totalValue}>{describeVolume(volumeOf(session))}</Text>
            <Text style={styles.muted}>lifted</Text>
          </View>
        )}
      </View>

      <View style={styles.chips}>
        {GYM_FOCUSES.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: focus === option }}
            onPress={() => {
              tap();
              change((current) => setDayFocus(current, today, focus === option ? undefined : option));
            }}
            style={[styles.chip, focus === option && { borderColor: palette.accent }]}
          >
            <Text style={[styles.chipLabel, focus === option && { color: palette.foreground }]}>
              {FOCUS_LABEL[option]}
            </Text>
          </Pressable>
        ))}
      </View>

      {session.exercises.map((exercise) => {
        const previous = lastTime(log, exercise.name, today);
        return (
          <View key={exercise.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${exercise.name}`}
                hitSlop={10}
                onPress={() => {
                  warn();
                  change((current) => removeExercise(current, today, exercise.id));
                }}
              >
                <Ionicons name="close" size={18} color={palette.subtleForeground} />
              </Pressable>
            </View>

            {previous && (
              <Text style={styles.lastTime}>
                Last time ({previous.date.slice(5)}):{" "}
                {previous.sets.map((set) => `${set.reps}${set.weight ? `×${set.weight}` : ""}`).join(", ")}
              </Text>
            )}

            {exercise.sets.length > 0 && (
              <View style={styles.setRow}>
                {exercise.sets.map((set, index) => (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={`Set ${index + 1}: ${set.reps} reps${set.weight ? ` at ${set.weight} kilos` : ""}. Tap to remove.`}
                    onPress={() => {
                      warn();
                      change((current) => removeSet(current, today, exercise.id, index));
                    }}
                    style={styles.setPill}
                  >
                    <Text style={styles.setLabel}>
                      {set.reps}
                      {set.weight ? ` × ${set.weight}` : ""}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <SetEntry
              previous={previous?.sets[previous.sets.length - 1]}
              onLog={(reps, weight) => logSet(exercise.id, reps, weight)}
              styles={styles}
              palette={palette}
            />
          </View>
        );
      })}

      <TextInput
        value={newExercise}
        onChangeText={setNewExercise}
        onSubmitEditing={() => {
          const name = newExercise.trim();
          if (!name) return;
          change((current) => addExercise(current, today, name));
          setNewExercise("");
        }}
        placeholder="Add an exercise…"
        placeholderTextColor={palette.subtleForeground}
        returnKeyType="done"
        style={styles.input}
        accessibilityLabel="New exercise"
      />

      {/* The split is a setting, not a daily action, so it sits behind the
          same read-only switch as everything else that changes a plan. */}
      <View style={styles.splitHead}>
        <Text style={styles.sectionTitle}>The weekly split</Text>
        <EditButton editing={editing} onChange={setEditing} what="the weekly split" />
      </View>

      {editing ? (
        DAYS_SHORT.slice(1).concat(DAYS_SHORT[0]).map((day) => (
          <View key={day} style={styles.splitRow}>
            <Text style={styles.splitDay}>{day}</Text>
            <View style={styles.chips}>
              {GYM_FOCUSES.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={`${day}: ${FOCUS_LABEL[option]}`}
                  accessibilityState={{ selected: log.split[day] === option }}
                  onPress={() =>
                    change((current) =>
                      setSplit(current, day, log.split[day] === option ? undefined : option)
                    )
                  }
                  style={[styles.miniChip, log.split[day] === option && { borderColor: palette.accent }]}
                >
                  <Text style={[styles.miniLabel, log.split[day] === option && { color: palette.foreground }]}>
                    {FOCUS_LABEL[option]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.muted}>
          {Object.keys(log.split).length > 0
            ? DAYS_SHORT.slice(1)
                .concat(DAYS_SHORT[0])
                .map((day) => `${day} ${log.split[day] ? FOCUS_LABEL[log.split[day]!] : "—"}`)
                .join(" · ")
            : "No split set. Tap Edit to say what each day is for."}
        </Text>
      )}
    </Refreshable>
  );
}

/**
 * Logging one set.
 *
 * Steppers rather than a keyboard: this is used standing up with one hand, and
 * the numbers move in known increments. It opens on whatever the last set of
 * this exercise was, because the overwhelmingly common case is "same again".
 */
function SetEntry({
  previous,
  onLog,
  styles,
  palette,
}: {
  previous?: { reps: number; weight?: number };
  onLog: (reps: number, weight: number) => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const [reps, setReps] = useState(previous?.reps ?? 8);
  const [weight, setWeight] = useState(previous?.weight ?? 0);

  return (
    <View style={styles.entry}>
      <Stepper label="reps" value={reps} step={1} onChange={setReps} styles={styles} palette={palette} />
      <Stepper label="kg" value={weight} step={2.5} onChange={setWeight} styles={styles} palette={palette} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Log ${reps} reps${weight > 0 ? ` at ${weight} kilos` : ""}`}
        onPress={() => onLog(reps, weight)}
        style={styles.logButton}
      >
        <Text style={styles.logLabel}>Log set</Text>
      </Pressable>
    </View>
  );
}

function Stepper({
  label,
  value,
  step,
  onChange,
  styles,
  palette,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`One less ${label}`}
        hitSlop={8}
        onPress={() => {
          tap();
          onChange(Math.max(0, Number((value - step).toFixed(1))));
        }}
        style={styles.stepButton}
      >
        <Ionicons name="remove" size={16} color={palette.foreground} />
      </Pressable>
      <View style={styles.stepValue}>
        <Text style={styles.stepNumber}>{value}</Text>
        <Text style={styles.stepUnit}>{label}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`One more ${label}`}
        hitSlop={8}
        onPress={() => {
          tap();
          onChange(Number((value + step).toFixed(1)));
        }}
        style={styles.stepButton}
      >
        <Ionicons name="add" size={16} color={palette.foreground} />
      </Pressable>
    </View>
  );
}

/** Kilograms until there are enough of them to be tonnes. Rounding straight to
 *  tonnes turned a hundred-kilo session into "0t", which is worse than no
 *  number at all. */
function describeVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)}kg`;
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xl },
    headline: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
    headlineText: { flex: 1, gap: 2 },
    focus: { color: palette.accent, fontSize: 24, fontWeight: "700" },
    totals: { alignItems: "center", gap: 1 },
    totalValue: { color: palette.foreground, fontSize: 19, fontWeight: "700" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
    chip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    chipLabel: { color: palette.mutedForeground, fontSize: 13, fontWeight: "600" },
    miniChip: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 6,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    miniLabel: { color: palette.mutedForeground, fontSize: 11, fontWeight: "600" },
    card: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    cardHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    exerciseName: { flex: 1, color: palette.foreground, fontSize: 16, fontWeight: "700" },
    lastTime: { color: palette.subtleForeground, fontSize: 12 },
    setRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
    setPill: {
      minHeight: 34,
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.control,
      backgroundColor: palette.surfaceMuted,
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
    setLabel: { color: palette.foreground, fontSize: 13, fontWeight: "600" },
    entry: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.xs },
    stepper: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    stepButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
    stepValue: { alignItems: "center" },
    stepNumber: { color: palette.foreground, fontSize: 16, fontWeight: "700" },
    stepUnit: { color: palette.subtleForeground, fontSize: 10 },
    logButton: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.control,
      backgroundColor: palette.accent,
    },
    logLabel: { color: "#04121c", fontSize: 14, fontWeight: "700" },
    input: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: palette.cardBorder,
      color: palette.foreground,
      fontSize: 15,
    },
    splitHead: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginTop: SPACING.lg },
    sectionTitle: {
      flex: 1,
      color: palette.subtleForeground,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    splitRow: { gap: SPACING.xs, marginBottom: SPACING.sm },
    splitDay: { color: palette.foreground, fontSize: 13, fontWeight: "700" },
    muted: { color: palette.mutedForeground, fontSize: 13, lineHeight: 18 },
  });
}
