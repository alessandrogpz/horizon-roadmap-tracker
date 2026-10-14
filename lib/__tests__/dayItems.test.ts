import { describe, it, expect } from "vitest";
import { dayItems, NEW_ITEM_KIND } from "../dayItems";
import type { RotationDef, TrackState } from "../types";

const rotation: RotationDef = {
  id: "algo",
  label: "Weekly Algorithm",
  items: [{ title: "Hash Map Patterns", description: "Two Sum" }, { title: "Two Pointers" }],
  daysOfWeek: ["Tue"],
  target: "revision",
  startWeek: 1,
};

const track = (over: Partial<TrackState> = {}): TrackState =>
  ({
    meta: { id: "t1", name: "Track", color: "#fff", templateId: "custom", createdAt: 0 },
    startDate: "2026-01-05",
    dailyTasks: {},
    dailyRevisionItems: {},
    ...over,
  }) as TrackState;

describe("a day's one list", () => {
  it("is empty when the day holds nothing", () => {
    expect(dayItems(track(), "Tue", 1)).toEqual([]);
  });

  it("merges both stored lists into one", () => {
    const t = track({
      dailyRevisionItems: { Tue: [{ id: "rev_1", title: "Linear Algebra", description: "ch. 3", completed: false }] },
      dailyTasks: { Tue: [{ id: "task_1", title: "Ray Tracer", completed: false }] },
    } as Partial<TrackState>);

    expect(dayItems(t, "Tue", 1).map((i) => i.title)).toEqual(["Linear Algebra", "Ray Tracer"]);
  });

  it("keeps each item's stored list, so completion can find it again", () => {
    const t = track({
      dailyRevisionItems: { Tue: [{ id: "rev_1", title: "Linear Algebra", completed: false }] },
      dailyTasks: { Tue: [{ id: "task_1", title: "Ray Tracer", completed: false }] },
    } as Partial<TrackState>);

    expect(dayItems(t, "Tue", 1).map((i) => i.kind)).toEqual(["revision", "focus"]);
  });

  it("puts this week's rotation item at the top, and marks it generated", () => {
    const t = track({
      rotations: [rotation],
      dailyRevisionItems: { Tue: [{ id: "rev_1", title: "Linear Algebra", completed: false }] },
    } as Partial<TrackState>);

    const items = dayItems(t, "Tue", 1);
    expect(items.map((i) => i.title)).toEqual(["Hash Map Patterns", "Linear Algebra"]);
    expect(items.map((i) => i.generated)).toEqual([true, false]);
    expect(items[0].description).toBe("Two Sum");
  });

  it("turns the rotation with the week rather than repeating it", () => {
    const t = track({ rotations: [rotation] } as Partial<TrackState>);
    expect(dayItems(t, "Tue", 2)[0].title).toBe("Two Pointers");
    expect(dayItems(t, "Tue", 3)[0].title).toBe("Hash Map Patterns");
  });

  it("shows nothing on a day the rotation does not run", () => {
    const t = track({ rotations: [rotation] } as Partial<TrackState>);
    expect(dayItems(t, "Wed", 1)).toEqual([]);
  });

  it("drops a stored copy of a rotation item, which is last week's answer", () => {
    const t = track({
      rotations: [rotation],
      dailyRevisionItems: {
        Tue: [
          { id: "rotation_algo", title: "Two Pointers", completed: false },
          { id: "rev_1", title: "Linear Algebra", completed: false },
        ],
      },
    } as Partial<TrackState>);

    expect(dayItems(t, "Tue", 1).map((i) => i.title)).toEqual(["Hash Map Patterns", "Linear Algebra"]);
  });

  it("leaves a rotation scoped to another phase out", () => {
    const t = track({
      currentPhase: 2,
      rotations: [{ ...rotation, phase: 3 }],
    } as Partial<TrackState>);

    expect(dayItems(t, "Tue", 1)).toEqual([]);
  });

  it("writes new items where a description can be stored", () => {
    expect(NEW_ITEM_KIND).toBe("revision");
  });
});
