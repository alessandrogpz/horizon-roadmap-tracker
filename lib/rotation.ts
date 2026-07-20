import type { RevisionItem, RotationConfig, WeekDay } from "./types";

/** True if this revision item is one of the app's own auto-generated
 *  rotation entries (as opposed to one the user added manually). */
export function isAutoRevisionItem(item: RevisionItem | undefined): boolean {
  return !!item && (item.id === "dsa_auto" || item.id === "math_revision");
}

/**
 * Computes what the rotation-driven revision item would be for `dayName`
 * in curriculum week `weekNum`, given a track's rotation config and weekly
 * schedule. Pure — reads no stored state, so it can preview any past or
 * future week, not just whichever one was last written by the daily reset.
 * Returns null on rest days (Sun) or when there's nothing to rotate.
 */
export function computeAutoRevisionItem(
  rotation: RotationConfig,
  weekSchedule: WeekDay[],
  weekNum: number,
  dsaStartWeek: number,
  dayName: string
): RevisionItem | null {
  if (dayName === "Sun") return null;
  const len = rotation.weeks.length;
  if (len === 0) return null;

  const idx = (((weekNum - dsaStartWeek) % len) + len) % len;
  const pattern = rotation.weeks[idx];
  if (!pattern) return null;

  const isRotationDay = weekSchedule.some((d) => d.name === dayName && d.type === rotation.appliesToScheduleType);
  return isRotationDay
    ? { id: "dsa_auto", title: pattern.pattern, description: pattern.problems, completed: false }
    : { id: "math_revision", title: "Linear Algebra", description: "Practice vector spaces, transforms, and equations", completed: false };
}
