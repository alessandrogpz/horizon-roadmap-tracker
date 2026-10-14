// The pool of focus types a track's week is built from, and the bookkeeping
// that keeps the week consistent with it.
//
// A focus type is "what a day is for" — Study, Rest, Build, whatever the track
// calls them. `weekSchedule` does not reference them by key alone: each day
// carries a copy of the label, because the week is rendered from the day and a
// lookup per cell is not worth the indirection. That copy is the reason this
// file exists. Renaming a type has to rewrite every day that uses it, and
// deleting one has to move its days somewhere that exists, or the week ends up
// pointing at a type that is gone.
//
// That logic lived inside a React component until the phone needed it too.
// Both platforms call these now, so a type renamed on a laptop and one renamed
// on a phone leave the week in the same state.

import type { DayKey, FocusType, WeekDay } from "./types";

export interface FocusPool {
  focusTypes: Record<string, FocusType>;
  weekSchedule: WeekDay[];
}

/** The stored key for a label: lowercase, letters and digits only. Derived
 *  rather than generated so the same label always means the same type. */
export function focusTypeKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Adds a type. Two labels that reduce to the same key would collide, so the
 * first one wins and the duplicate is ignored — silently, because the user can
 * see the existing type sitting in the list.
 */
export function addFocusType(pool: FocusPool, label: string, color: string): FocusPool {
  const trimmed = label.trim();
  const key = focusTypeKey(trimmed);
  if (!key || pool.focusTypes[key]) return pool;
  return {
    focusTypes: { ...pool.focusTypes, [key]: { label: trimmed, color } },
    weekSchedule: pool.weekSchedule,
  };
}

/** Renames a type, and every day showing the old name with it. The key does
 *  not change: it is the identity, and rewriting it would orphan the days. */
export function renameFocusType(pool: FocusPool, key: string, label: string): FocusPool {
  const existing = pool.focusTypes[key];
  if (!existing) return pool;
  return {
    focusTypes: { ...pool.focusTypes, [key]: { ...existing, label } },
    weekSchedule: pool.weekSchedule.map((day) => (day.type === key ? { ...day, label } : day)),
  };
}

export function recolorFocusType(pool: FocusPool, key: string, color: string): FocusPool {
  const existing = pool.focusTypes[key];
  if (!existing) return pool;
  return { ...pool, focusTypes: { ...pool.focusTypes, [key]: { ...existing, color } } };
}

/** Marks a type as a day off, or stops it being one. Always writes the flag,
 *  even when it agrees with the default for that key, so that turning `free`
 *  into a working day survives a reload rather than falling back to the
 *  guess `isRestType` makes for types that predate the flag. */
export function setRestDay(pool: FocusPool, key: string, restDay: boolean): FocusPool {
  const existing = pool.focusTypes[key];
  if (!existing) return pool;
  return { ...pool, focusTypes: { ...pool.focusTypes, [key]: { ...existing, restDay } } };
}

/**
 * Removes a type and re-points its days at whatever is left.
 *
 * Refuses to remove the last one: a week whose days point at nothing is worse
 * than a week with one kind of day. The fallback is simply the first remaining
 * type — there is no better guess, and leaving the days dangling is not an
 * option.
 */
export function removeFocusType(pool: FocusPool, key: string): FocusPool {
  if (!pool.focusTypes[key] || Object.keys(pool.focusTypes).length <= 1) return pool;

  const focusTypes = { ...pool.focusTypes };
  delete focusTypes[key];

  const fallbackType = Object.keys(focusTypes)[0];
  const fallbackLabel = focusTypes[fallbackType]?.label ?? "Free";

  return {
    focusTypes,
    weekSchedule: pool.weekSchedule.map((day) =>
      day.type === key ? { ...day, type: fallbackType, label: fallbackLabel } : day
    ),
  };
}

/**
 * What a given weekday is for, as the track's rhythm has it.
 *
 * It lived in `lib/gym.ts` until a training day was the only thing that asked
 * the question. It is not gym logic — it reads `weekSchedule` and nothing else
 * — and leaving it there made every screen that wanted a day's type import
 * from the gym module, which made the gym look entangled with the rest of the
 * app when the only thing shared was this.
 */
export function focusOfDay(
  weekSchedule: { name: string; type: string; label: string }[] | undefined,
  dayKey: DayKey
): { key: string; label: string } | null {
  const day = (weekSchedule ?? []).find((entry) => entry.name === dayKey);
  return day ? { key: day.type, label: day.label } : null;
}
