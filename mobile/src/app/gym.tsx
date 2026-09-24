// The gym screen: today's plan, and the sets logged against it.
//
// It does not decide what today is for — the track's weekly rhythm does, the
// same one Today and the Week overview read. This screen owns the other half:
// which exercises each *kind* of day asks for, and what was actually done.
// Those were one concept split across two editors before, and the two could
// disagree about whether Monday was a push day.
//
// Built for use with one hand, standing up, between sets, which rules out most
// of what a form normally does. No save button, no modal per set, no keyboard
// for the common case: reps and weight are steppers with real increments,
// because typing "8" into a numeric field with chalky hands is worse than
// tapping + twice.
//
// Every exercise shows what it was last time. That is the question every
// working set starts with, and looking it up is what a paper notebook is worst
// at.

import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  addExercise,
  addSet,
  addToPlan,
  applyStarterPlan,
  focusOfDay,
  lastTime,
  plannedFor,
  removeExercise,
  removeFromPlan,
  removeSet,
  sessionFor,
  setCountOf,
  STARTER_SPLIT,
  STARTER_WEEK,
  volumeOf,
} from "@shared/gym";
import { setWeeklyRhythm } from "@shared/trackActions";
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
  const { track, today, editTrack } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { log, change } = useGymLog(track?.meta.id);
  const { editing, setEditing } = useEditMode();
  const [newExercise, setNewExercise] = useState("");

  const dayKey = DAYS_SHORT[parseYMD(today).getDay()];
  const focus = focusOfDay(track?.weekSchedule, dayKey);
  const planned = plannedFor(log, focus?.key);
  const session = sessionFor(log, today);

  /** The starter week writes the track's focus types and rhythm as well as the
   *  exercises, because a plan for "push days" means nothing until the week
   *  says which days those are. */
  const useStarterWeek = useCallback(() => {
    tap();
    editTrack((current) => {
      const focusTypes = { ...(current.focusTypes ?? {}) };
      for (const entry of STARTER_WEEK) {
        if (!focusTypes[entry.key]) focusTypes[entry.key] = { label: entry.label, color: entry.color };
      }
      const week = DAYS_SHORT.slice(1)
        .concat(DAYS_SHORT[0])
        .map((name) => {
          const key = STARTER_SPLIT[name] ?? "rest";
          return { name, type: key, label: focusTypes[key]?.label ?? key };
        });
      return setWeeklyRhythm(current, week, focusTypes);
    });
    change(applyStarterPlan);
  }, [change, editTrack]);

  const logSet = useCallback(
    (exerciseId: string, reps: number, weight: number) => {
      tap();
      change((current) =>
        addSet(current, today, exerciseId, { reps, ...(weight > 0 ? { weight } : {}) })
      );
    },
    [change, today]
  );

  /** A planned exercise becomes a logged one the moment a set goes on it, so
   *  the plan is a starting point rather than a separate list to tick off. */
  const startExercise = useCallback(
    (name: string) => {
      tap();
      change((current) => addExercise(current, today, name));
    },
    [change, today]
  );

  if (!track) return <NoTrack />;

  const started = new Set(session.exercises.map((exercise) => exercise.name.toLowerCase()));
  const todo = planned.filter((name) => !started.has(name.toLowerCase()));

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headline}>
        <View style={styles.headlineText}>
          <Text style={styles.focus}>{focus?.label ?? "No focus set"}</Text>
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

      {/* Offered whenever the track has no gym plan at all — not only when it
          has no week. Every track starts with a week of some kind, so gating
          this on "no week" meant a fitness track never saw it. */}
      {Object.keys(log.plans).length === 0 && (
        <View style={styles.card}>
          <Text style={styles.exerciseName}>Start from a training week</Text>
          <Text style={styles.muted}>
            Sets this track&apos;s week to push / pull / legs with two rest days, and fills each kind
            of day with the exercises to match. It renames the days this track currently has, so it
            suits a track that is about training rather than one already in use for something else.
            Everything is editable afterwards.
          </Text>
          <Pressable accessibilityRole="button" onPress={useStarterWeek} style={styles.logButton}>
            <Text style={styles.logLabel}>Set up a training week</Text>
          </Pressable>
        </View>
      )}

      {/* What today asks for and has not been started. Tapping one begins it. */}
      {todo.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Still to do</Text>
          <View style={styles.chips}>
            {todo.map((name) => (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityLabel={`Start ${name}`}
                onPress={() => startExercise(name)}
                style={styles.chip}
              >
                <Ionicons name="add" size={13} color={palette.mutedForeground} />
                <Text style={styles.chipLabel}>{name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

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
        placeholder="Add something not in the plan…"
        placeholderTextColor={palette.subtleForeground}
        returnKeyType="done"
        style={styles.input}
        accessibilityLabel="New exercise"
      />

      {/* The plan for this kind of day — a setting, so it sits behind the same
          read-only switch as everything else that changes a plan. */}
      {focus && (
        <>
          <View style={styles.splitHead}>
            <Text style={styles.sectionTitle}>What a {focus.label.toLowerCase()} day asks for</Text>
            <EditButton editing={editing} onChange={setEditing} what={`the ${focus.label} plan`} />
          </View>

          {planned.length === 0 && !editing && (
            <Text style={styles.muted}>
              Nothing planned for {focus.label.toLowerCase()} days yet. Tap Edit to add exercises, and
              they will be waiting every {focus.label.toLowerCase()} day.
            </Text>
          )}

          {planned.map((name) => (
            <View key={name} style={styles.planRow}>
              <Text style={styles.planName}>{name}</Text>
              {editing && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${name} from the ${focus.label} plan`}
                  hitSlop={10}
                  onPress={() => change((current) => removeFromPlan(current, focus.key, name))}
                >
                  <Ionicons name="close" size={16} color={palette.subtleForeground} />
                </Pressable>
              )}
            </View>
          ))}

          {editing && (
            <PlanEntry
              onAdd={(name) => change((current) => addToPlan(current, focus.key, name))}
              styles={styles}
              palette={palette}
            />
          )}

          <Text style={styles.footnote}>
            Which days are {focus.label.toLowerCase()} days is set on the Week screen, along with every
            other kind of day this track has.
          </Text>
        </>
      )}
    </Refreshable>
  );
}

/** Adding to the plan, separate from adding to today: one changes every future
 *  push day, the other changes this afternoon. */
function PlanEntry({
  onAdd,
  styles,
  palette,
}: {
  onAdd: (name: string) => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const [draft, setDraft] = useState("");
  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onSubmitEditing={() => {
        const name = draft.trim();
        if (!name) return;
        onAdd(name);
        setDraft("");
      }}
      placeholder="Add to this day's plan…"
      placeholderTextColor={palette.subtleForeground}
      returnKeyType="done"
      style={styles.input}
      accessibilityLabel="Add to the plan"
    />
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
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
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
    planRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: palette.cardBorder,
    },
    planName: { flex: 1, color: palette.foreground, fontSize: 14 },
    footnote: { color: palette.subtleForeground, fontSize: 11, lineHeight: 16, marginTop: SPACING.sm },
    muted: { color: palette.mutedForeground, fontSize: 13, lineHeight: 18 },
  });
}
