import { describe, it, expect } from "vitest";
import { rescalePhaseDeadlines } from "../phases";
import type { Phase } from "../types";

const phase = (id: number, recommendedByDay?: number): Phase => ({
  id,
  title: `Phase ${id}`,
  description: "",
  tasks: [{ id: `p${id}_t1`, title: "Task", completed: false }],
  detailedInfo: { focus: "", deliverable: "", math: "" },
  recommendedByDay,
});

const days = (phases: Phase[]) => phases.map((p) => p.recommendedByDay);

describe("rescalePhaseDeadlines", () => {
  it("stretches deadlines onto a longer horizon, keeping the content", () => {
    const before = [phase(1, 30), phase(2, 60), phase(3, 90)];
    const after = rescalePhaseDeadlines(before, 90, 180);

    expect(days(after)).toEqual([60, 120, 180]);
    // The point of rescaling rather than rebuilding: nothing else moves.
    expect(after[0].title).toBe("Phase 1");
    expect(after[0].tasks).toHaveLength(1);
  });

  it("compresses onto a shorter horizon", () => {
    const after = rescalePhaseDeadlines([phase(1, 60), phase(2, 120), phase(3, 180)], 180, 90);
    expect(days(after)).toEqual([30, 60, 90]);
  });

  it("always lands the final phase exactly on the new horizon", () => {
    // Rounding would otherwise leave the last phase a day or two short, which
    // means the phase-timing banner never resolves.
    for (const next of [7, 33, 101, 395]) {
      const after = rescalePhaseDeadlines([phase(1, 30), phase(2, 65), phase(3, 90)], 90, next);
      expect(after[after.length - 1].recommendedByDay).toBe(next);
    }
  });

  it("keeps deadlines strictly increasing even when heavily compressed", () => {
    // 395 → 5 days collapses everything onto day 1 before repair.
    const after = rescalePhaseDeadlines(
      [phase(1, 90), phase(2, 180), phase(3, 270), phase(4, 395)],
      395,
      5,
    );
    const values = days(after) as number[];
    expect(values[values.length - 1]).toBe(5);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
    expect(values.every((v) => v >= 1)).toBe(true);
  });

  it("never produces a day-zero deadline", () => {
    const after = rescalePhaseDeadlines([phase(1, 1), phase(2, 90)], 90, 10);
    expect(after.every((p) => (p.recommendedByDay ?? 1) >= 1)).toBe(true);
  });

  it("leaves phases without a deadline alone", () => {
    // A track that never set these doesn't show the timing banner; inventing
    // values here would switch it on uninvited.
    const after = rescalePhaseDeadlines([phase(1), phase(2)], 90, 180);
    expect(days(after)).toEqual([undefined, undefined]);
  });

  it("is a no-op when the duration is unchanged or nonsensical", () => {
    const before = [phase(1, 45), phase(2, 90)];
    expect(rescalePhaseDeadlines(before, 90, 90)).toBe(before);
    expect(rescalePhaseDeadlines(before, 90, 0)).toBe(before);
    expect(rescalePhaseDeadlines(before, 0, 90)).toBe(before);
  });
});
