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

import type { DateStr, DayKey } from "./types";

/** What a day is for. Deliberately a small fixed set rather than free text:
 *  these are the splits people actually run, and a fixed set is what lets the
 *  panel say "today is pull" without anyone typing it twice. */
export const GYM_FOCUSES = ["push", "pull", "legs", "upper", "lower", "full", "cardio", "rest"] as const;
export type GymFocus = (typeof GYM_FOCUSES)[number];

export const FOCUS_LABEL: Record<GymFocus, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper",
  lower: "Lower",
  full: "Full body",
  cardio: "Cardio",
  rest: "Rest",
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
  /** Overrides the split for this one day, when the plan met reality. */
  focus?: GymFocus;
  exercises: GymExercise[];
}

export interface GymLog {
  version: 1;
  /** Which focus each weekday is for, when the track runs a fixed split. */
  split: Partial<Record<DayKey, GymFocus>>;
  sessions: Record<DateStr, GymSession>;
}

export const emptyGymLog = (): GymLog => ({ version: 1, split: {}, sessions: {} });

/** One note per track. The id has to match the server's `[A-Za-z0-9_-]`
 *  pattern, which track ids already do. */
export const gymNoteId = (trackId: string): string => `gym-${trackId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const asFocus = (value: unknown): GymFocus | undefined =>
  typeof value === "string" && (GYM_FOCUSES as readonly string[]).includes(value)
    ? (value as GymFocus)
    : undefined;

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

  const split: Partial<Record<DayKey, GymFocus>> = {};
  if (isRecord(raw.split)) {
    for (const [day, focus] of Object.entries(raw.split)) {
      const valid = asFocus(focus);
      if (valid) split[day] = valid;
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

      sessions[date] = { ...(asFocus(session.focus) ? { focus: asFocus(session.focus) } : {}), exercises };
    }
  }

  return { version: 1, split, sessions };
}

export const serializeGymLog = (log: GymLog): string => JSON.stringify(log);

/** The focus for a date: whatever the day itself recorded, else the split. */
export function focusFor(log: GymLog, date: DateStr, dayKey: DayKey): GymFocus | undefined {
  return log.sessions[date]?.focus ?? log.split[dayKey];
}

export const sessionFor = (log: GymLog, date: DateStr): GymSession =>
  log.sessions[date] ?? { exercises: [] };

function withSession(log: GymLog, date: DateStr, next: GymSession): GymLog {
  return { ...log, sessions: { ...log.sessions, [date]: next } };
}

export function setSplit(log: GymLog, dayKey: DayKey, focus: GymFocus | undefined): GymLog {
  const split = { ...log.split };
  if (focus) split[dayKey] = focus;
  else delete split[dayKey];
  return { ...log, split };
}

export function setDayFocus(log: GymLog, date: DateStr, focus: GymFocus | undefined): GymLog {
  const session = sessionFor(log, date);
  return withSession(log, date, { ...session, ...(focus ? { focus } : { focus: undefined }) });
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
