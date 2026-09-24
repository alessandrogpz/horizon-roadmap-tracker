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

import type { DateStr, DayKey } from "./types";

/** A ready-made week for a track that is about training, offered rather than
 *  assumed: these become the track's own focus types, so the Week screen edits
 *  them like any other track's days. */
export const STARTER_WEEK: { key: string; label: string; color: string }[] = [
  { key: "push", label: "Push", color: "#ef4444" },
  { key: "pull", label: "Pull", color: "#0ea5e9" },
  { key: "legs", label: "Legs", color: "#a855f7" },
  { key: "cardio", label: "Cardio", color: "#f59e0b" },
  { key: "rest", label: "Rest", color: "#64748b" },
];

/** Mon..Sun for the starter week. Two rest days, and legs away from push. */
export const STARTER_SPLIT: Record<string, string> = {
  Mon: "push",
  Tue: "pull",
  Wed: "legs",
  Thu: "rest",
  Fri: "push",
  Sat: "cardio",
  Sun: "rest",
};

/** What a starter week actually asks of you, per kind of day. */
export const STARTER_PLAN: Record<string, string[]> = {
  push: ["Bench press", "Overhead press", "Incline dumbbell press", "Triceps pushdown"],
  pull: ["Deadlift", "Pull-up", "Barbell row", "Face pull", "Biceps curl"],
  legs: ["Back squat", "Romanian deadlift", "Leg press", "Calf raise"],
  cardio: ["Run", "Row"],
  rest: [],
};

export interface GymSet {
  reps: number;
  /** Kilograms. Optional: bodyweight work has none, and a set with no weight
   *  is a real set rather than a set weighing zero. */
  weight?: number;
}

export interface GymExercise {
  id: string;
  name: string;
  sets: GymSet[];
}

export interface GymSession {
  exercises: GymExercise[];
}

export interface GymLog {
  version: 1;
  /** Focus type key -> the exercises that kind of day asks for. This is the
   *  *plan*; `sessions` is what actually happened. */
  plans: Record<string, string[]>;
  sessions: Record<DateStr, GymSession>;
}

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

  const plans: Record<string, string[]> = {};
  if (isRecord(raw.plans)) {
    for (const [focus, names] of Object.entries(raw.plans)) {
      if (!Array.isArray(names)) continue;
      plans[focus] = names.filter((name): name is string => typeof name === "string" && !!name.trim());
    }
  }

  const sessions: Record<DateStr, GymSession> = {};
  if (isRecord(raw.sessions)) {
    for (const [date, session] of Object.entries(raw.sessions)) {
      if (!isRecord(session)) continue;
      const exercises: GymExercise[] = [];

      if (Array.isArray(session.exercises)) {
        for (const exercise of session.exercises) {
          if (!isRecord(exercise) || typeof exercise.name !== "string") continue;
          const sets: GymSet[] = [];
          if (Array.isArray(exercise.sets)) {
            for (const set of exercise.sets) {
              if (!isRecord(set) || typeof set.reps !== "number") continue;
              sets.push({
                reps: Math.max(0, Math.round(set.reps)),
                ...(typeof set.weight === "number" ? { weight: set.weight } : {}),
              });
            }
          }
          exercises.push({
            id: typeof exercise.id === "string" ? exercise.id : `ex_${exercises.length}`,
            name: exercise.name,
            sets,
          });
        }
      }

      sessions[date] = { exercises };
    }
  }

  return { version: 1, plans, sessions };
}

export const serializeGymLog = (log: GymLog): string => JSON.stringify(log);

/**
 * What kind of day this is, according to the track's own weekly rhythm.
 *
 * Takes the schedule rather than the log on purpose: the rhythm is the single
 * answer to "what is Monday for", shared by Today, the week overview and this.
 * A gym that kept its own copy would be a second answer that could disagree.
 */
export function focusOfDay(
  weekSchedule: { name: string; type: string; label: string }[] | undefined,
  dayKey: DayKey
): { key: string; label: string } | null {
  const day = (weekSchedule ?? []).find((entry) => entry.name === dayKey);
  return day ? { key: day.type, label: day.label } : null;
}

/** The exercises this kind of day asks for. */
export const plannedFor = (log: GymLog, focusKey: string | undefined): string[] =>
  focusKey ? (log.plans[focusKey] ?? []) : [];

export function setPlan(log: GymLog, focusKey: string, names: string[]): GymLog {
  return {
    ...log,
    plans: { ...log.plans, [focusKey]: names.map((name) => name.trim()).filter(Boolean) },
  };
}

export function addToPlan(log: GymLog, focusKey: string, name: string): GymLog {
  const trimmed = name.trim();
  if (!trimmed) return log;
  const current = plannedFor(log, focusKey);
  // Same exercise twice in one day's plan is a mistake every time.
  if (current.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) return log;
  return setPlan(log, focusKey, [...current, trimmed]);
}

export const removeFromPlan = (log: GymLog, focusKey: string, name: string): GymLog =>
  setPlan(
    log,
    focusKey,
    plannedFor(log, focusKey).filter((existing) => existing !== name)
  );

/** Seeds the exercises for a starter week, leaving anything already planned
 *  alone — running this twice should not double anyone's session. */
export function applyStarterPlan(log: GymLog): GymLog {
  const plans = { ...log.plans };
  for (const [focus, names] of Object.entries(STARTER_PLAN)) {
    if (!plans[focus]?.length) plans[focus] = [...names];
  }
  return { ...log, plans };
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
    exercises: [...session.exercises, { id: `ex_${Date.now()}`, name: trimmed, sets: [] }],
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

/** Total kilograms moved in a session: the one number that says whether today
 *  was heavier than last time, across different exercises and rep ranges. */
export function volumeOf(session: GymSession): number {
  return session.exercises.reduce(
    (total, exercise) =>
      total + exercise.sets.reduce((sum, set) => sum + set.reps * (set.weight ?? 0), 0),
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
