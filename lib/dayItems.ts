// What a day holds: one list.
//
// A day used to carry two, "revision" and "focus", and you had to pick one
// before you could write anything down. The split never survived contact with
// real tracks — a single focus list would hold a book, a tutorial and a
// project, which are three different kinds of work — and the word "focus"
// already meant something else here: a *day's* type, the thing the tag shows
// (Math, Rendering, Reading). Two meanings, one word, on the same card.
//
// So the day's type says what the day is about, and the day keeps one plain
// list of things to do. Nothing is grouped, nothing is labelled, and nothing
// has to be classified before it can be written down.
//
// The two stored arrays survive underneath, because that is what every device
// and the server already hold, and rewriting the storage shape is a migration
// with a sync protocol attached rather than a change of labels. `kind` is how
// an item finds its way back to the array it lives in — completion records,
// renames and deletions are all keyed by it. Nothing shows it.

import { computeRotationItemsForDay, isRotationItem } from "./rotation";
import type { ItemKind } from "./completions";
import type { DayKey, TrackState } from "./types";

export interface DayItem {
  id: string;
  title: string;
  description?: string;
  /** Which stored list this came from. Internal: no screen shows it. */
  kind: ItemKind;
  /**
   * Written by a rotation for this week rather than stored on the day. It can
   * be ticked, but not renamed or removed: there is no stored item to change,
   * and next week it will be something else. The rotation's own editor is
   * what changes these.
   */
  generated: boolean;
}

/**
 * Everything on `dayKey` in curriculum week `weekNum`, in the order it reads.
 *
 * Rotation items are computed from the rotation and the week number rather
 * than read back from storage — a stored rotation item is last week's answer —
 * which is why they are filtered out of the stored lists before the computed
 * ones are added. Every screen that shows a day goes through here, so the
 * phone, the weekly plan and the day editor cannot disagree about what a
 * Tuesday contains.
 */
export function dayItems(track: TrackState, dayKey: DayKey, weekNum: number): DayItem[] {
  const rotations = track.rotations ?? [];
  const computed = rotations.length
    ? computeRotationItemsForDay(rotations, weekNum, dayKey, track.currentPhase)
    : { revisions: [], focus: [] };

  const storedRevisions = track.dailyRevisionItems?.[dayKey] ?? [];
  const storedTasks = track.dailyTasks?.[dayKey] ?? [];
  const manual = <T extends { id: string }>(stored: T[]) =>
    rotations.length ? stored.filter((item) => !isRotationItem(item)) : stored;

  return [
    ...computed.revisions.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      kind: "revision" as const,
      generated: true,
    })),
    ...manual(storedRevisions).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      kind: "revision" as const,
      generated: false,
    })),
    ...computed.focus.map((item) => ({
      id: item.id,
      title: item.title,
      kind: "focus" as const,
      generated: true,
    })),
    ...manual(storedTasks).map((item) => ({
      id: item.id,
      title: item.title,
      kind: "focus" as const,
      generated: false,
    })),
  ];
}

/**
 * Where a newly written item goes.
 *
 * The revision array, because it is the one that can hold a description —
 * `TaskItem` has no such field, and the server's schema for it is strict, so
 * giving tasks one is a server change before it is a client change. Nothing
 * about this is visible: both arrays render as the same list.
 */
export const NEW_ITEM_KIND: ItemKind = "revision";
