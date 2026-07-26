import { describe, it, expect } from "vitest";
import {
  addPhase,
  recommendedPhaseId,
  removePhase,
  setMaterialStatus,
  togglePortfolioProject,
  trackTotalDays,
  updateTrackIdentity,
} from "../trackActions";
import type { Phase, TrackState } from "../types";

const phase = (id: number, recommendedByDay?: number): Phase => ({
  id,
  title: `Phase ${id}`,
  description: "",
  tasks: [],
  detailedInfo: { focus: "", deliverable: "", math: "" },
  ...(recommendedByDay === undefined ? {} : { recommendedByDay }),
});

const track = (overrides: Partial<TrackState> = {}): TrackState => ({
  meta: { id: "t1", name: "Track", color: "#0ea5e9", templateId: "custom", createdAt: 0 },
  currentPhase: 1,
  startDate: "2026-07-01",
  streakHistory: [],
  lastTasksResetDate: "",
  dailyTasks: {},
  dailyRevisionItems: {},
  phases: [phase(1, 90), phase(2, 180), phase(3, 365)],
  portfolio: [{ id: "p1", title: "Ray tracer", completed: false }],
  materials: [
    { id: "m1", title: "Linear Algebra", category: "Math", type: "Book", status: "In Progress", currentPage: 10, totalPages: 200, currentSubject: "", link: "" },
  ],
  completedItemsHistory: {},
  weeklyCompletions: {},
  ...overrides,
});

describe("trackTotalDays", () => {
  it("uses the last phase carrying a deadline", () => {
    expect(trackTotalDays(track())).toBe(365);
  });

  it("falls back to a year when no phase sets one", () => {
    expect(trackTotalDays(track({ phases: [phase(1), phase(2)] }))).toBe(365);
  });
});

describe("recommendedPhaseId", () => {
  it("picks the first phase whose deadline hasn't passed", () => {
    expect(recommendedPhaseId(track(), 45)).toBe(1);
    expect(recommendedPhaseId(track(), 120)).toBe(2);
    expect(recommendedPhaseId(track(), 300)).toBe(3);
  });

  it("clamps past the end rather than going undefined", () => {
    expect(recommendedPhaseId(track(), 9999)).toBe(3);
  });

  it("stays on the current phase for tracks with no deadlines at all", () => {
    const noDeadlines = track({ phases: [phase(1), phase(2)], currentPhase: 2 });
    expect(recommendedPhaseId(noDeadlines, 9999)).toBe(2);
  });
});

describe("setMaterialStatus", () => {
  it("completing a material records an accomplishment for the day", () => {
    const next = setMaterialStatus(track(), "m1", "Completed", "2026-07-06");
    expect(next.materials[0].status).toBe("Completed");
    expect(next.completedItemsHistory["2026-07-06"]).toEqual([{ title: "Linear Algebra", description: "" }]);
    expect(next.streakHistory).toEqual(["2026-07-06"]);
  });

  it("un-completing it takes the accomplishment back out", () => {
    const done = setMaterialStatus(track(), "m1", "Completed", "2026-07-06");
    const undone = setMaterialStatus(done, "m1", "In Progress", "2026-07-06");
    expect(undone.completedItemsHistory["2026-07-06"]).toEqual([]);
    expect(undone.streakHistory).toEqual([]);
  });

  it("a status change between two non-Completed values leaves the streak alone", () => {
    const next = setMaterialStatus(track(), "m1", "Not Started", "2026-07-06");
    expect(next.streakHistory).toEqual([]);
    expect(next.completedItemsHistory).toEqual({});
  });

  it("ignores an unknown material id", () => {
    const before = track();
    expect(setMaterialStatus(before, "nope", "Completed", "2026-07-06")).toBe(before);
  });
});

describe("togglePortfolioProject", () => {
  it("round-trips completion and its streak entry", () => {
    const done = togglePortfolioProject(track(), "p1", "2026-07-06");
    expect(done.portfolio[0].completed).toBe(true);
    expect(done.streakHistory).toEqual(["2026-07-06"]);

    const undone = togglePortfolioProject(done, "p1", "2026-07-06");
    expect(undone.portfolio[0].completed).toBe(false);
    expect(undone.streakHistory).toEqual([]);
  });
});

describe("removePhase", () => {
  it("moves the active phase off one that's being deleted", () => {
    const next = removePhase(track({ currentPhase: 2 }), 2);
    expect(next.phases.map((p) => p.id)).toEqual([1, 3]);
    expect(next.currentPhase).toBe(1);
  });

  it("refuses to delete the last remaining phase", () => {
    const single = track({ phases: [phase(1)] });
    expect(removePhase(single, 1)).toBe(single);
  });
});

describe("addPhase", () => {
  it("numbers the new phase past the highest existing id", () => {
    const { track: next, phase: added } = addPhase(track());
    expect(added.id).toBe(4);
    expect(next.phases).toHaveLength(4);
  });
});

describe("updateTrackIdentity", () => {
  it("rescales every deadline proportionally when the horizon changes", () => {
    const next = updateTrackIdentity(track(), {
      name: "Renamed",
      color: "#ff0000",
      startDate: "2026-08-01",
      totalDays: 730,
    });

    expect(next.meta.name).toBe("Renamed");
    expect(next.startDate).toBe("2026-08-01");
    expect(next.phases.map((p) => p.recommendedByDay)).toEqual([180, 360, 730]);
  });

  it("seeds the final phase's deadline when the track had none", () => {
    const next = updateTrackIdentity(track({ phases: [phase(1), phase(2)] }), {
      name: "T",
      color: "#000000",
      startDate: "2026-07-01",
      totalDays: 200,
    });
    expect(next.phases.map((p) => p.recommendedByDay)).toEqual([undefined, 200]);
  });
});
