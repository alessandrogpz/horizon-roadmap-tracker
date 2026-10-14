// Training: a weekly split, and what was actually lifted on each day.
//
// Where this lives needs explaining. The obvious home is a field on
// `TrackState`, and that is the one place it cannot go: the server validates
// the workspace against a strict schema that refuses documents carrying fields
// it does not know, which is exactly how a retired field once locked a real
// account out of syncing (learning log 13, release 0.21.4). Adding one would
// mean a schema change, a migration and a deploy before a single set could be
// logged.
//
// Notes have none of that. They are `{ id, content, updatedAt }` with a free
// id and half a megabyte of text each, they already sync, and they already
// merge per-note by timestamp. So a track's training log is a note holding
// JSON — `gym-<trackId>` — and the format lives here rather than in the screen
// that draws it, so the website can read the same log the day it grows a gym
// panel.
//
// Half a megabyte is years: a session with eight exercises and thirty sets is
// about 1 KB.
//
// What is deliberately *not* here is which day is a push day. The track's
// weekly rhythm already answers "what is this day for" — that is the whole
// job of `weekSchedule` and `focusTypes` — and a gym split stored separately
// was the same question asked twice, with two editors that could disagree. So
// the rhythm names the days and this names the exercises for each kind of day.
// A fitness track's focus types are Push, Pull, Legs, Rest; the plan below is
// keyed by those same keys.

import type { DateStr } from "./types";

export interface GymSet {
  reps: number;
  /** Kilograms. Optional: bodyweight work has none, and a set with no weight
   *  is a real set rather than a set weighing zero. */
  weight?: number;
  /**
   * Whether the set has actually been done.
   *
   * A session is written before it is performed: the rows are there, carrying
   * last time's numbers, and you tick them off as you go. Without this a row
   * could only mean "done", so there was nowhere to put the three sets you are
   * about to do — and the difference between planned and done is the whole of
   * what a workout screen is for while you are standing in front of the bar.
   */
  done?: boolean;
}

export interface GymExercise {
  id: string;
  name: string;
  sets: GymSet[];
}

export interface GymSession {
  exercises: GymExercise[];
}

/** One line of a plan: what to do, how many sets, how many reps. A name on its
 *  own was not a plan — it said which exercise but nothing about the work, so
 *  the numbers had to be remembered or looked up every single session. */
export interface PlanItem {
  name: string;
  sets: number;
  reps: number;
}

/**
 * A named workout — a push day, a pull day — and the exercises in it.
 *
 * The exercises live here rather than under a date, because this is the thing
 * you come back to: you do not open the app to see what the 12th of March was,
 * you open it to do pull day again and to see what you lifted last time you
 * did. Dates are for history; a workout is for doing.
 */
export interface Workout {
  id: string;
  name: string;
  exercises: GymExercise[];
}

export interface GymLog {
  version: 1;
  /** Focus type key -> what that kind of day asks for. This is the *plan*;
   *  `sessions` is what actually happened. */
  plans: Record<string, PlanItem[]>;
  /** The named workouts, in the order they were made. */
  workouts?: Workout[];
  sessions: Record<DateStr, GymSession>;
}

/**
 * An id nothing else will have.
 *
 * `Date.now()` alone is not enough: two taps inside the same millisecond —
 * which is one tap on a fast phone and a re-render — produced the same id, and
 * two workouts sharing one id are one workout as far as every lookup and every
 * edit is concerned.
 */
const uid = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const emptyGymLog = (): GymLog => ({ version: 1, plans: {}, sessions: {} });

/** One note per track. The id has to match the server's `[A-Za-z0-9_-]`
 *  pattern, which track ids already do. */
export const gymNoteId = (trackId: string): string => `gym-${trackId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/**
 * Reads a log out of a note's text.
 *
 * Total on failure: a note is a string that anything could have written, and
 * a training log that throws would take the panel — and, before the error
 * boundary, the home screen — with it. An unreadable log is an empty one.
 */
export function parseGymLog(content: string | undefined | null): GymLog {
  if (!content?.trim()) return emptyGymLog();

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return emptyGymLog();
  }
  if (!isRecord(raw)) return emptyGymLog();

  const plans: Record<string, PlanItem[]> = {};
  if (isRecord(raw.plans)) {
    for (const [focus, items] of Object.entries(raw.plans)) {
      if (!Array.isArray(items)) continue;
      const parsed: PlanItem[] = [];
      for (const item of items) {
        // Plans were a list of names before sets and reps existed. An older
        // note — or one written by a version of the app still on another
        // phone — must keep working, so a bare string becomes a plan item with
        // sensible numbers rather than being dropped.
        if (typeof item === "string" && item.trim()) {
          parsed.push({ name: item.trim(), sets: DEFAULT_SETS, reps: DEFAULT_REPS });
        } else if (isRecord(item) && typeof item.name === "string" && item.name.trim()) {
          parsed.push({
            name: item.name.trim(),
            sets: typeof item.sets === "number" ? Math.max(1, Math.round(item.sets)) : DEFAULT_SETS,
            reps: typeof item.reps === "number" ? Math.max(1, Math.round(item.reps)) : DEFAULT_REPS,
          });
        }
      }
      plans[focus] = parsed;
    }
  }

  const sessions: Record<DateStr, GymSession> = {};
  if (isRecord(raw.sessions)) {
    for (const [date, session] of Object.entries(raw.sessions)) {
      if (!isRecord(session)) continue;
      sessions[date] = { exercises: parseExercises(session.exercises) };
    }
  }

  const workouts: Workout[] = [];
  if (Array.isArray(raw.workouts)) {
    for (const workout of raw.workouts) {
      if (!isRecord(workout) || typeof workout.name !== "string") continue;
      workouts.push({
        id: typeof workout.id === "string" ? workout.id : `wo_${workouts.length}`,
        name: workout.name,
        exercises: parseExercises(workout.exercises),
      });
    }
  }

  return { version: 1, plans, sessions, workouts };
}

/** Exercises and their sets, wherever they are read from — a dated session or
 *  a named workout. Written once so the two cannot drift, which is how the
 *  `done` flag came to be dropped on the way back in. */
function parseExercises(raw: unknown): GymExercise[] {
  const exercises: GymExercise[] = [];
  if (!Array.isArray(raw)) return exercises;

  for (const exercise of raw) {
    if (!isRecord(exercise) || typeof exercise.name !== "string") continue;
    const sets: GymSet[] = [];
    if (Array.isArray(exercise.sets)) {
      for (const set of exercise.sets) {
        if (!isRecord(set) || typeof set.reps !== "number") continue;
        sets.push({
          reps: Math.max(0, Math.round(set.reps)),
          ...(typeof set.weight === "number" ? { weight: set.weight } : {}),
          // Carried rather than defaulted. A set written before ticking
          // existed has no flag, and must not be read as "not done" — that
          // would empty out every session ever recorded.
          ...(typeof set.done === "boolean" ? { done: set.done } : {}),
        });
      }
    }
    exercises.push({
      id: typeof exercise.id === "string" ? exercise.id : `ex_${exercises.length}`,
      name: exercise.name,
      sets,
    });
  }
  return exercises;
}

export const serializeGymLog = (log: GymLog): string => JSON.stringify(log);

/** Three sets of ten: the shape most plans start from, and a better guess than
 *  nothing when an older note only recorded a name. */
export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = 10;

/** What this kind of day asks for. */
export const plannedFor = (log: GymLog, focusKey: string | undefined): PlanItem[] =>
  focusKey ? (log.plans[focusKey] ?? []) : [];

export function setPlan(log: GymLog, focusKey: string, items: PlanItem[]): GymLog {
  return { ...log, plans: { ...log.plans, [focusKey]: items } };
}

export function addToPlan(
  log: GymLog,
  focusKey: string,
  name: string,
  sets = DEFAULT_SETS,
  reps = DEFAULT_REPS
): GymLog {
  const trimmed = name.trim();
  if (!trimmed) return log;
  const current = plannedFor(log, focusKey);
  // The same exercise twice in one day's plan is a mistake every time.
  if (current.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) return log;
  return setPlan(log, focusKey, [...current, { name: trimmed, sets, reps }]);
}

export const removeFromPlan = (log: GymLog, focusKey: string, name: string): GymLog =>
  setPlan(log, focusKey, plannedFor(log, focusKey).filter((item) => item.name !== name));

/** Changes the numbers on one line of the plan, leaving its place alone. */
export function updatePlanItem(
  log: GymLog,
  focusKey: string,
  name: string,
  fields: Partial<Omit<PlanItem, "name">>
): GymLog {
  return setPlan(
    log,
    focusKey,
    plannedFor(log, focusKey).map((item) =>
      item.name === name
        ? {
            ...item,
            ...(fields.sets !== undefined ? { sets: Math.max(1, Math.round(fields.sets)) } : {}),
            ...(fields.reps !== undefined ? { reps: Math.max(1, Math.round(fields.reps)) } : {}),
          }
        : item
    )
  );
}

/** Whether this day's planned work is finished: every planned exercise has at
 *  least as many sets logged as it asked for. What the week needs to show a
 *  tick, and nothing more. */
export function planComplete(log: GymLog, focusKey: string | undefined, date: DateStr): boolean {
  const plan = plannedFor(log, focusKey);
  if (plan.length === 0) return false;
  const session = sessionFor(log, date);
  return plan.every((item) => {
    const logged = session.exercises.find(
      (exercise) => exercise.name.toLowerCase() === item.name.toLowerCase()
    );
    return (logged?.sets.length ?? 0) >= item.sets;
  });
}

export const sessionFor = (log: GymLog, date: DateStr): GymSession =>
  log.sessions[date] ?? { exercises: [] };

function withSession(log: GymLog, date: DateStr, next: GymSession): GymLog {
  return { ...log, sessions: { ...log.sessions, [date]: next } };
}

export function addExercise(log: GymLog, date: DateStr, name: string): GymLog {
  const trimmed = name.trim();
  if (!trimmed) return log;
  const session = sessionFor(log, date);
  return withSession(log, date, {
    ...session,
    exercises: [...session.exercises, { id: uid("ex"), name: trimmed, sets: [] }],
  });
}

export function removeExercise(log: GymLog, date: DateStr, exerciseId: string): GymLog {
  const session = sessionFor(log, date);
  return withSession(log, date, {
    ...session,
    exercises: session.exercises.filter((exercise) => exercise.id !== exerciseId),
  });
}

export function addSet(log: GymLog, date: DateStr, exerciseId: string, set: GymSet): GymLog {
  const session = sessionFor(log, date);
  return withSession(log, date, {
    ...session,
    exercises: session.exercises.map((exercise) =>
      exercise.id === exerciseId ? { ...exercise, sets: [...exercise.sets, set] } : exercise
    ),
  });
}

export function removeSet(log: GymLog, date: DateStr, exerciseId: string, index: number): GymLog {
  const session = sessionFor(log, date);
  return withSession(log, date, {
    ...session,
    exercises: session.exercises.map((exercise) =>
      exercise.id === exerciseId
        ? { ...exercise, sets: exercise.sets.filter((_, i) => i !== index) }
        : exercise
    ),
  });
}

export const workoutsOf = (log: GymLog): Workout[] => log.workouts ?? [];

export const workoutById = (log: GymLog, id: string): Workout | undefined =>
  workoutsOf(log).find((workout) => workout.id === id);

export function addWorkout(log: GymLog, name: string): { log: GymLog; workout: Workout } {
  const workout: Workout = { id: uid("wo"), name, exercises: [] };
  return { log: { ...log, workouts: [...workoutsOf(log), workout] }, workout };
}

export const renameWorkout = (log: GymLog, id: string, name: string): GymLog => ({
  ...log,
  workouts: workoutsOf(log).map((workout) => (workout.id === id ? { ...workout, name } : workout)),
});

export const removeWorkout = (log: GymLog, id: string): GymLog => ({
  ...log,
  workouts: workoutsOf(log).filter((workout) => workout.id !== id),
});

/** Every change inside a workout goes through here, so there is one place that
 *  knows how a workout is put back. */
function withWorkout(log: GymLog, id: string, change: (workout: Workout) => Workout): GymLog {
  return {
    ...log,
    workouts: workoutsOf(log).map((workout) => (workout.id === id ? change(workout) : workout)),
  };
}

export function addWorkoutExercise(log: GymLog, id: string, name: string): GymLog {
  return withWorkout(log, id, (workout) => ({
    ...workout,
    exercises: [...workout.exercises, { id: uid("ex"), name, sets: [] }],
  }));
}

export const removeWorkoutExercise = (log: GymLog, id: string, exerciseId: string): GymLog =>
  withWorkout(log, id, (workout) => ({
    ...workout,
    exercises: workout.exercises.filter((exercise) => exercise.id !== exerciseId),
  }));

export const renameWorkoutExercise = (log: GymLog, id: string, exerciseId: string, name: string): GymLog =>
  withWorkout(log, id, (workout) => ({
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.id === exerciseId ? { ...exercise, name } : exercise
    ),
  }));

export const addWorkoutSet = (log: GymLog, id: string, exerciseId: string, set: GymSet): GymLog =>
  withWorkout(log, id, (workout) => ({
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.id === exerciseId ? { ...exercise, sets: [...exercise.sets, set] } : exercise
    ),
  }));

export const removeWorkoutSet = (log: GymLog, id: string, exerciseId: string, index: number): GymLog =>
  withWorkout(log, id, (workout) => ({
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.id === exerciseId
        ? { ...exercise, sets: exercise.sets.filter((_, i) => i !== index) }
        : exercise
    ),
  }));

export const updateWorkoutSet = (
  log: GymLog,
  id: string,
  exerciseId: string,
  index: number,
  change: Partial<GymSet>
): GymLog =>
  withWorkout(log, id, (workout) => ({
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.id === exerciseId
        ? { ...exercise, sets: exercise.sets.map((set, i) => (i === index ? { ...set, ...change } : set)) }
        : exercise
    ),
  }));

/** Unticks every set, ready to be done again. What a workout is for is being
 *  repeated, and the weights you left in it are the point of coming back. */
export const resetWorkout = (log: GymLog, id: string): GymLog =>
  withWorkout(log, id, (workout) => ({
    ...workout,
    exercises: workout.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...set, done: false })),
    })),
  }));

export const setsInWorkout = (workout: Workout): number =>
  workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

/** Changes one set in place — the weight typed into a row, the reps, or the
 *  tick against it. */
export function updateSet(
  log: GymLog,
  date: DateStr,
  exerciseId: string,
  index: number,
  change: Partial<GymSet>
): GymLog {
  const session = sessionFor(log, date);
  return withSession(log, date, {
    ...session,
    exercises: session.exercises.map((exercise) =>
      exercise.id === exerciseId
        ? {
            ...exercise,
            sets: exercise.sets.map((set, i) => (i === index ? { ...set, ...change } : set)),
          }
        : exercise
    ),
  });
}

/** Renames an exercise, leaving its sets alone. */
export function renameExercise(
  log: GymLog,
  date: DateStr,
  exerciseId: string,
  name: string
): GymLog {
  const session = sessionFor(log, date);
  return withSession(log, date, {
    ...session,
    exercises: session.exercises.map((exercise) =>
      exercise.id === exerciseId ? { ...exercise, name } : exercise
    ),
  });
}

/** Throws the day's session away. Only the day: the plan and every other
 *  session are untouched, because abandoning today is not abandoning the
 *  training. */
export function clearSession(log: GymLog, date: DateStr): GymLog {
  const sessions = { ...log.sessions };
  delete sessions[date];
  return { ...log, sessions };
}

/** Sets actually done, as against sets merely written down. */
export const doneCountOf = (session: GymSession): number =>
  session.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.done).length,
    0
  );

/** Total kilograms moved in a session: the one number that says whether today
 *  was heavier than last time, across different exercises and rep ranges. */
export function volumeOf(session: GymSession): number {
  return session.exercises.reduce(
    (total, exercise) =>
      total +
      exercise.sets.reduce(
        // Sets written down but not yet ticked have not been lifted, so they
        // weigh nothing towards the day's total. Older sessions, recorded
        // before a set could be ticked, carry no flag and all count.
        (sum, set) => sum + (set.done === false ? 0 : set.reps * (set.weight ?? 0)),
        0
      ),
    0
  );
}

export const setCountOf = (session: GymSession): number =>
  session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

/** The most recent earlier date that logged this exercise, and what was done —
 *  "what did I lift last time" being the question every set starts with. */
export function lastTime(
  log: GymLog,
  exerciseName: string,
  before: DateStr
): { date: DateStr; sets: GymSet[] } | null {
  const name = exerciseName.trim().toLowerCase();
  const dates = Object.keys(log.sessions)
    .filter((date) => date < before)
    .sort()
    .reverse();

  for (const date of dates) {
    const match = log.sessions[date].exercises.find(
      (exercise) => exercise.name.trim().toLowerCase() === name && exercise.sets.length > 0
    );
    if (match) return { date, sets: match.sets };
  }
  return null;
}
