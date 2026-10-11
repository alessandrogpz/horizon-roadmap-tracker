import { describe, it, expect } from "vitest";
import { computeRotationItem, computeRotationItemsForDay, isRotationItem, rotationItemId, rotationsInPhase, runsInPhase } from "../rotation";
import { DSA_PATTERN_WEEKS } from "../constants";
import type { RotationDef } from "../types";

const algorithmRotation: RotationDef = {
  id: "algo",
  label: "Weekly Algorithm",
  items: DSA_PATTERN_WEEKS.map((w) => ({ title: w.pattern, description: w.problems })),
  daysOfWeek: ["Mon", "Wed", "Fri"],
  target: "revision",
  startWeek: 1,
};

const readingRotation: RotationDef = {
  id: "reading",
  label: "Weekly Reading",
  items: [{ title: "Tolkien" }, { title: "Isaac Asimov" }, { title: "Ursula K. Le Guin" }],
  daysOfWeek: ["Tue", "Thu"],
  target: "focus",
  startWeek: 1,
};

describe("computeRotationItem", () => {
  it("returns the current item on a day the rotation runs", () => {
    const item = computeRotationItem(algorithmRotation, 1, "Mon");
    expect(item?.id).toBe("rotation_algo");
    expect(item?.title).toBe(DSA_PATTERN_WEEKS[0].pattern);
  });

  it("returns null on a day the rotation doesn't run", () => {
    expect(computeRotationItem(algorithmRotation, 1, "Tue")).toBeNull();
  });

  it("advances to the next item as the curriculum week advances", () => {
    const week1 = computeRotationItem(algorithmRotation, 1, "Mon");
    const week2 = computeRotationItem(algorithmRotation, 2, "Mon");
    expect(week1?.title).toBe(DSA_PATTERN_WEEKS[0].pattern);
    expect(week2?.title).toBe(DSA_PATTERN_WEEKS[1].pattern);
  });

  it("wraps around after the last item in the cycle", () => {
    const len = DSA_PATTERN_WEEKS.length;
    const item = computeRotationItem(algorithmRotation, 1 + len, "Mon");
    expect(item?.title).toBe(DSA_PATTERN_WEEKS[0].pattern);
  });

  it("respects a non-default startWeek offset", () => {
    const shifted: RotationDef = { ...algorithmRotation, startWeek: 5 };
    const item = computeRotationItem(shifted, 5, "Mon");
    expect(item?.title).toBe(DSA_PATTERN_WEEKS[0].pattern);
  });

  it("a 3-day-cadence-style rotation (different days, own cycle) advances independently", () => {
    const week1 = computeRotationItem(readingRotation, 1, "Tue");
    const week2 = computeRotationItem(readingRotation, 2, "Tue");
    expect(week1?.title).toBe("Tolkien");
    expect(week2?.title).toBe("Isaac Asimov");
  });
});

describe("computeRotationItemsForDay", () => {
  it("splits multiple rotations by target, only including ones active that day", () => {
    const { revisions, focus } = computeRotationItemsForDay([algorithmRotation, readingRotation], 1, "Tue");
    expect(revisions).toHaveLength(0); // algorithm rotation doesn't run on Tue
    expect(focus).toHaveLength(1);
    expect(focus[0].title).toBe("Tolkien");
  });

  it("returns both a revision and a focus item when two rotations overlap a day", () => {
    const overlapping: RotationDef = { ...readingRotation, id: "overlap", daysOfWeek: ["Mon"] };
    const { revisions, focus } = computeRotationItemsForDay([algorithmRotation, overlapping], 1, "Mon");
    expect(revisions).toHaveLength(1);
    expect(focus).toHaveLength(1);
  });

  it("returns empty arrays for a day with no active rotations", () => {
    const { revisions, focus } = computeRotationItemsForDay([algorithmRotation, readingRotation], 1, "Sat");
    expect(revisions).toHaveLength(0);
    expect(focus).toHaveLength(0);
  });
});

describe("isRotationItem / rotationItemId", () => {
  it("identifies items produced by a rotation via the id prefix", () => {
    expect(isRotationItem({ id: rotationItemId(algorithmRotation) })).toBe(true);
    expect(isRotationItem({ id: "rev_12345" })).toBe(false);
  });

  it("also recognizes the pre-multi-rotation legacy ids, so old synced data cleanly supersedes", () => {
    expect(isRotationItem({ id: "dsa_auto" })).toBe(true);
    expect(isRotationItem({ id: "math_revision" })).toBe(true);
  });
});

describe("rotations scoped to a phase", () => {
  const everyPhase: RotationDef = { ...readingRotation, id: "standing" };
  const first: RotationDef = { ...readingRotation, id: "p1", label: "Phase one topics", phase: 1 };
  const second: RotationDef = { ...readingRotation, id: "p2", label: "Phase two topics", phase: 2 };
  const all = [everyPhase, first, second];

  it("runs a rotation with no phase in every one", () => {
    expect(rotationsInPhase(all, 1).map((r) => r.id)).toEqual(["standing", "p1"]);
    expect(rotationsInPhase(all, 2).map((r) => r.id)).toEqual(["standing", "p2"]);
    expect(rotationsInPhase(all, 7).map((r) => r.id)).toEqual(["standing"]);
  });

  it("returns everything when the caller has no phase to hand", () => {
    // The question the old code asked. A caller without a phase must not be
    // silently filtered down to nothing.
    expect(rotationsInPhase(all).map((r) => r.id)).toEqual(["standing", "p1", "p2"]);
  });

  it("keeps a scoped rotation off the day until its phase is current", () => {
    const onPhaseOne = computeRotationItemsForDay(all, 1, "Tue", 1);
    const onPhaseTwo = computeRotationItemsForDay(all, 1, "Tue", 2);
    expect(onPhaseOne.focus).toHaveLength(2); // the standing one, and phase one's
    expect(onPhaseTwo.focus).toHaveLength(2); // the standing one, and phase two's
    expect(onPhaseOne.focus.map((i) => i.id)).toContain(rotationItemId(first));
    expect(onPhaseOne.focus.map((i) => i.id)).not.toContain(rotationItemId(second));
  });

  it("still turns the cycle on the week number inside its phase", () => {
    // Scoping decides which rotation runs, not how fast it turns: three items
    // across six weeks still come round twice.
    const week = (n: number) => computeRotationItemsForDay([first], n, "Tue", 1).focus[0]?.title;
    expect([1, 2, 3, 4].map(week)).toEqual(["Tolkien", "Isaac Asimov", "Ursula K. Le Guin", "Tolkien"]);
  });

  it("leaves rotations written before scoping exactly as they were", () => {
    expect(computeRotationItemsForDay([readingRotation], 1, "Tue", 3).focus).toHaveLength(1);
  });
});

describe("runsInPhase", () => {
  const scoped = (phase?: number): RotationDef => ({
    id: "r1",
    label: "Weekly Algorithm",
    items: [{ title: "Hash Map Patterns" }],
    daysOfWeek: ["Tue"],
    target: "revision",
    startWeek: 1,
    ...(phase === undefined ? {} : { phase }),
  });

  it("runs an unscoped rotation in any phase", () => {
    expect(runsInPhase(scoped(), 1)).toBe(true);
    expect(runsInPhase(scoped(), 4)).toBe(true);
  });

  it("runs a scoped rotation only in its own phase", () => {
    expect(runsInPhase(scoped(2), 2)).toBe(true);
    expect(runsInPhase(scoped(2), 1)).toBe(false);
  });

  it("runs everything when there is no phase to compare against", () => {
    expect(runsInPhase(scoped(2), undefined)).toBe(true);
  });

  it("agrees with rotationsInPhase", () => {
    const list = [scoped(), scoped(1), scoped(2)];
    for (const phase of [1, 2, 3]) {
      expect(rotationsInPhase(list, phase)).toEqual(list.filter((r) => runsInPhase(r, phase)));
    }
  });
});
