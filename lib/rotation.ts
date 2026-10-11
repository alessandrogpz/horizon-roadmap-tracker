import type { RevisionItem, RotationDef, TaskItem } from "./types";

/** True if this item was written by a rotation (as opposed to one the user
 *  added manually) — every rotation-generated item's id is namespaced. Also
 *  recognizes the pre-multi-rotation ids ("dsa_auto"/"math_revision") so
 *  already-synced data cleanly supersedes instead of leaving a stale
 *  duplicate the first time a day recomputes after this upgrade. */
export function isRotationItem(item: { id: string } | undefined): boolean {
  return !!item && (item.id.startsWith("rotation_") || item.id === "dsa_auto" || item.id === "math_revision");
}

export function rotationItemId(rotation: RotationDef): string {
  return `rotation_${rotation.id}`;
}

/**
 * Computes what `rotation`'s current item would be for `dayName` in
 * curriculum week `weekNum` — null if this rotation doesn't run on that day
 * or has no items. Pure — reads no stored state, so it can preview any past
 * or future week, not just whichever one was last written by the daily
 * reset.
 */
export function computeRotationItem(
  rotation: RotationDef,
  weekNum: number,
  dayName: string
): RevisionItem | null {
  if (!rotation.daysOfWeek.includes(dayName)) return null;
  const len = rotation.items.length;
  if (len === 0) return null;

  const idx = (((weekNum - rotation.startWeek) % len) + len) % len;
  const item = rotation.items[idx];
  if (!item) return null;

  return { id: rotationItemId(rotation), title: item.title, description: item.description, completed: false };
}

/**
 * The rotations that run during a given phase.
 *
 * A rotation with no `phase` runs in all of them — the shape every rotation
 * had before scoping existed, and the right default for a standing habit.
 * Passing no `currentPhase` asks the question the old code asked and gets
 * every rotation back, so a caller with no phase to hand is never silently
 * filtered down to nothing.
 */
export function rotationsInPhase(rotations: RotationDef[], currentPhase?: number): RotationDef[] {
  if (currentPhase === undefined) return rotations;
  return rotations.filter((rotation) => rotation.phase === undefined || rotation.phase === currentPhase);
}

/**
 * Computes every applicable rotation's item for `dayName` in week
 * `weekNum`, split by target bucket (revision vs. focus).
 *
 * `currentPhase` narrows it to the rotations belonging to the phase the track
 * is on. The week number still drives the cycle within that phase, so a
 * three-item rotation across a six-week phase comes round twice — scoping
 * decides *which* rotation runs, not how fast it turns.
 */
export function computeRotationItemsForDay(
  rotations: RotationDef[],
  weekNum: number,
  dayName: string,
  currentPhase?: number
): { revisions: RevisionItem[]; focus: TaskItem[] } {
  const revisions: RevisionItem[] = [];
  const focus: TaskItem[] = [];

  for (const rotation of rotationsInPhase(rotations, currentPhase)) {
    const item = computeRotationItem(rotation, weekNum, dayName);
    if (!item) continue;
    if (rotation.target === "focus") {
      focus.push({ id: item.id, title: item.title, completed: false });
    } else {
      revisions.push(item);
    }
  }

  return { revisions, focus };
}
