import { describe, it, expect } from "vitest";
import { addDayItem, isItemCompleted, removeDayItem, setItemCompletion, updateDayItem } from "../completions";
import type { TrackState } from "../types";

const track = (overrides: Partial<TrackState> = {}): TrackState => ({
  meta: { id: "t1", name: "Track", color: "#0ea5e9", templateId: "custom", createdAt: 0 },
  currentPhase: 1,
  startDate: "2026-07-01",
  streakHistory: [],
  lastTasksResetDate: "",
  dailyTasks: { Mon: [{ id: "task_1", title: "Read", completed: false }] },
  dailyRevisionItems: { Mon: [{ id: "rev_1", title: "Vectors", description: "dot products", completed: false }] },
  phases: [],
  portfolio: [],
  materials: [],
  completedItemsHistory: {},
  weeklyCompletions: {},
  ...overrides,
});

const MON = "2026-07-06";

describe("setItemCompletion", () => {
  it("records the id, the accomplishment and the streak day together", () => {
    const next = setItemCompletion(track(), {
      dateStr: MON, dayKey: "Mon", kind: "revision", id: "rev_1", title: "Vectors", description: "dot products",
    }, true);

    expect(next.weeklyCompletions[MON].revisions).toEqual(["rev_1"]);
    expect(next.completedItemsHistory[MON]).toEqual([{ title: "Vectors", description: "dot products" }]);
    expect(next.streakHistory).toEqual([MON]);
    expect(next.dailyRevisionItems.Mon[0].completed).toBe(true);
  });

  it("unchecking removes all three again", () => {
    const checked = setItemCompletion(track(), { dateStr: MON, dayKey: "Mon", kind: "focus", id: "task_1", title: "Read" }, true);
    const unchecked = setItemCompletion(checked, { dateStr: MON, dayKey: "Mon", kind: "focus", id: "task_1", title: "Read" }, false);

    expect(unchecked.weeklyCompletions[MON].tasks).toEqual([]);
    expect(unchecked.completedItemsHistory[MON]).toEqual([]);
    expect(unchecked.streakHistory).toEqual([]);
    expect(unchecked.dailyTasks.Mon[0].completed).toBe(false);
  });

  it("never mutates the track it was given", () => {
    const before = track({ weeklyCompletions: { [MON]: { tasks: [], revisions: [] } } });
    const snapshot = JSON.parse(JSON.stringify(before));
    setItemCompletion(before, { dateStr: MON, dayKey: "Mon", kind: "revision", id: "rev_1", title: "Vectors" }, true);
    expect(before).toEqual(snapshot);
  });

  it("leaves other dates and the other checklist untouched", () => {
    const seeded = track({
      weeklyCompletions: { "2026-07-05": { tasks: ["other"], revisions: [] }, [MON]: { tasks: ["task_1"], revisions: [] } },
    });
    const next = setItemCompletion(seeded, { dateStr: MON, dayKey: "Mon", kind: "revision", id: "rev_1", title: "Vectors" }, true);

    expect(next.weeklyCompletions["2026-07-05"].tasks).toEqual(["other"]);
    expect(next.weeklyCompletions[MON].tasks).toEqual(["task_1"]);
    expect(next.weeklyCompletions[MON].revisions).toEqual(["rev_1"]);
  });

  it("is idempotent — checking twice records one entry", () => {
    const ref = { dateStr: MON, dayKey: "Mon" as const, kind: "revision" as const, id: "rev_1", title: "Vectors" };
    const once = setItemCompletion(track(), ref, true);
    const twice = setItemCompletion(once, ref, true);
    expect(twice.weeklyCompletions[MON].revisions).toEqual(["rev_1"]);
    expect(twice.completedItemsHistory[MON]).toHaveLength(1);
  });

  it("handles a rotation item with no stored record (no dayKey)", () => {
    const next = setItemCompletion(track(), { dateStr: MON, kind: "revision", id: "rotation_r1", title: "Two Pointers" }, true);
    expect(next.weeklyCompletions[MON].revisions).toEqual(["rotation_r1"]);
    expect(next.completedItemsHistory[MON]).toHaveLength(1);
    // The stored Monday list is untouched — rotation items are recomputed, not stored.
    expect(next.dailyRevisionItems.Mon).toEqual(track().dailyRevisionItems.Mon);
  });
});

describe("isItemCompleted", () => {
  it("reads back what setItemCompletion wrote", () => {
    const next = setItemCompletion(track(), { dateStr: MON, dayKey: "Mon", kind: "focus", id: "task_1", title: "Read" }, true);
    expect(isItemCompleted(next, MON, "focus", "task_1")).toBe(true);
    expect(isItemCompleted(next, MON, "revision", "task_1")).toBe(false);
    expect(isItemCompleted(next, "2026-07-07", "focus", "task_1")).toBe(false);
  });
});

describe("addDayItem / updateDayItem", () => {
  it("appends a revision item with its description", () => {
    const next = addDayItem(track(), "Tue", "revision", { title: "  Matrices  ", description: " transforms " });
    expect(next.dailyRevisionItems.Tue).toHaveLength(1);
    expect(next.dailyRevisionItems.Tue[0]).toMatchObject({ title: "Matrices", description: "transforms", completed: false });
  });

  it("ignores a blank title", () => {
    const before = track();
    expect(addDayItem(before, "Tue", "focus", { title: "   " })).toBe(before);
  });

  it("edits an existing item in place", () => {
    const next = updateDayItem(track(), "Mon", "revision", "rev_1", { title: "Vector spaces" });
    expect(next.dailyRevisionItems.Mon[0].title).toBe("Vector spaces");
    expect(next.dailyRevisionItems.Mon[0].description).toBe("dot products");
  });

  // A description used to be one list's privilege, so a day showing one list
  // could offer the box on some items and silently discard what you typed on
  // the others.
  it("keeps a description on an item in either list", () => {
    const added = addDayItem(track(), "Tue", "focus", { title: "C++ Book", description: "chapter 7" });
    expect(added.dailyTasks.Tue.at(-1)).toMatchObject({ title: "C++ Book", description: "chapter 7" });

    const edited = updateDayItem(added, "Tue", "focus", added.dailyTasks.Tue.at(-1)!.id, { description: "chapter 8" });
    expect(edited.dailyTasks.Tue.at(-1)!.description).toBe("chapter 8");
  });
});

describe("removeDayItem", () => {
  it("drops the item and the completion it had recorded", () => {
    const ref = { dateStr: MON, dayKey: "Mon" as const, kind: "revision" as const, id: "rev_1", title: "Vectors" };
    const checked = setItemCompletion(track(), ref, true);
    const removed = removeDayItem(checked, ref);

    expect(removed.dailyRevisionItems.Mon).toEqual([]);
    expect(removed.weeklyCompletions[MON].revisions).toEqual([]);
    expect(removed.completedItemsHistory[MON]).toEqual([]);
    expect(removed.streakHistory).toEqual([]);
  });

  it("leaves sibling items on the same day alone", () => {
    const twoItems = track({
      dailyTasks: {
        Mon: [
          { id: "task_1", title: "Read", completed: false },
          { id: "task_2", title: "Write", completed: false },
        ],
      },
    });
    const removed = removeDayItem(twoItems, { dateStr: MON, dayKey: "Mon", kind: "focus", id: "task_1", title: "Read" });
    expect(removed.dailyTasks.Mon.map((t) => t.id)).toEqual(["task_2"]);
  });
});
