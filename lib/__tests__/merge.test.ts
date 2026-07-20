import { describe, it, expect } from "vitest";
import { mergeAppState, mergeMaterials, mergePortfolio } from "../merge";
import { rebuildStreakHistory, addCompletion, removeCompletion } from "../streak";
import type { AppState, Material } from "../types";

const baseState = (overrides: Partial<AppState> = {}): AppState => ({
  currentPhase: 1,
  startDate: "2026-07-01",
  streakHistory: [],
  lastDailyRoutineCheck: "",
  lastTasksResetDate: "",
  dailyFocus: {},
  dailyTasks: {},
  dailyRevisionItems: {},
  phases: [],
  portfolio: [],
  materials: [],
  dailyStudyPoints: {},
  completedItemsHistory: {},
  weeklyCompletions: {},
  studyStreak: [],
  isSynced: true,
  configVersion: 0,
  lastUpdatedDates: {},
  ...overrides,
});

const material = (overrides: Partial<Material> = {}): Material => ({
  id: "m1",
  title: "Linear Algebra",
  category: "Math",
  type: "Book",
  status: "In Progress",
  currentPage: 10,
  totalPages: 100,
  currentSubject: "Vectors",
  link: "",
  ...overrides,
});

describe("mergeAppState day-level progress merge", () => {
  it("adopts remote day when remote edit counter is higher", () => {
    const local = baseState({
      lastUpdatedDates: { "2026-07-10": 1 },
      weeklyCompletions: { "2026-07-10": { tasks: ["a"], revisions: [] } },
      completedItemsHistory: { "2026-07-10": [{ title: "A" }] },
    });
    const remote = baseState({
      lastUpdatedDates: { "2026-07-10": 3 },
      weeklyCompletions: { "2026-07-10": { tasks: ["b"], revisions: ["r1"] } },
      completedItemsHistory: { "2026-07-10": [{ title: "B" }] },
    });

    const { data } = mergeAppState(local, remote);
    expect(data.weeklyCompletions["2026-07-10"]).toEqual({ tasks: ["b"], revisions: ["r1"] });
    expect(data.completedItemsHistory["2026-07-10"]).toEqual([{ title: "B" }]);
  });

  it("keeps local day when local edit counter is higher", () => {
    const local = baseState({
      lastUpdatedDates: { "2026-07-10": 5 },
      weeklyCompletions: { "2026-07-10": { tasks: ["a"], revisions: [] } },
      completedItemsHistory: { "2026-07-10": [{ title: "A" }] },
    });
    const remote = baseState({
      lastUpdatedDates: { "2026-07-10": 2 },
      weeklyCompletions: { "2026-07-10": { tasks: ["b"], revisions: [] } },
      completedItemsHistory: { "2026-07-10": [{ title: "B" }] },
    });

    const { data } = mergeAppState(local, remote);
    expect(data.weeklyCompletions["2026-07-10"]).toEqual({ tasks: ["a"], revisions: [] });
    expect(data.completedItemsHistory["2026-07-10"]).toEqual([{ title: "A" }]);
  });

  it("unions completions on equal counters", () => {
    const local = baseState({
      weeklyCompletions: { "2026-07-10": { tasks: ["a"], revisions: [] } },
      completedItemsHistory: { "2026-07-10": [{ title: "A" }] },
    });
    const remote = baseState({
      weeklyCompletions: { "2026-07-10": { tasks: ["a", "b"], revisions: [] } },
      completedItemsHistory: { "2026-07-10": [{ title: "A" }, { title: "B" }] },
    });

    const { data } = mergeAppState(local, remote);
    expect(data.weeklyCompletions["2026-07-10"].tasks.sort()).toEqual(["a", "b"]);
    expect(data.completedItemsHistory["2026-07-10"].length).toBe(2);
  });

  it("lets deletions win over additions on equal counters", () => {
    const local = baseState({
      weeklyCompletions: { "2026-07-10": { tasks: ["a", "b"], revisions: [] } },
      completedItemsHistory: { "2026-07-10": [{ title: "A" }, { title: "B" }] },
    });
    const remote = baseState({
      weeklyCompletions: { "2026-07-10": { tasks: ["a"], revisions: [] } },
      completedItemsHistory: { "2026-07-10": [{ title: "A" }] },
    });

    const { data } = mergeAppState(local, remote);
    expect(data.weeklyCompletions["2026-07-10"]).toEqual({ tasks: ["a"], revisions: [] });
    expect(data.completedItemsHistory["2026-07-10"]).toEqual([{ title: "A" }]);
  });

  it("rebuilds streakHistory from merged accomplishments without duplicates", () => {
    const local = baseState({
      streakHistory: ["2026-07-10", "2026-07-10", "2026-07-10"],
      completedItemsHistory: { "2026-07-10": [{ title: "A" }], "2026-07-11": [] },
    });
    const remote = baseState({
      completedItemsHistory: { "2026-07-12": [{ title: "C" }] },
    });

    const { data } = mergeAppState(local, remote);
    expect(data.streakHistory.sort()).toEqual(["2026-07-10", "2026-07-12"]);
  });

  it("takes structural config from the side with the higher configVersion", () => {
    const local = baseState({ configVersion: 1, currentPhase: 1, startDate: "2026-07-01" });
    const remote = baseState({ configVersion: 4, currentPhase: 3, startDate: "2026-06-01" });

    const { data, log } = mergeAppState(local, remote);
    expect(data.currentPhase).toBe(3);
    expect(data.startDate).toBe("2026-06-01");
    expect(data.configVersion).toBe(4);
    expect(log.join(" ")).toContain("Remote configuration is newer");
  });

  it("adopts remote daily structure when versions tie but remote reset is newer", () => {
    const local = baseState({
      lastTasksResetDate: "2026-07-10",
      dailyTasks: { Mon: [{ id: "old", title: "Old", completed: false }] },
    });
    const remote = baseState({
      lastTasksResetDate: "2026-07-11",
      dailyTasks: { Mon: [{ id: "new", title: "New", completed: false }] },
    });

    const { data } = mergeAppState(local, remote);
    expect(data.dailyTasks.Mon[0].id).toBe("new");
    expect(data.lastTasksResetDate).toBe("2026-07-11");
  });

  it("marks the result as synced with no unsynced changes", () => {
    const { data } = mergeAppState(baseState({ hasUnsyncedChanges: true }), baseState());
    expect(data.isSynced).toBe(true);
    expect(data.hasUnsyncedChanges).toBe(false);
    expect(data.lastSyncTime).toBeTypeOf("number");
  });
});

describe("mergeMaterials", () => {
  it("prefers a real URL over a local path for the link field", () => {
    const local = [material({ link: "~/books/la.pdf" })];
    const remote = [material({ link: "https://example.com/la" })];
    expect(mergeMaterials(local, remote)[0].link).toBe("https://example.com/la");

    const local2 = [material({ link: "https://example.com/la" })];
    const remote2 = [material({ link: "~/books/la.pdf" })];
    expect(mergeMaterials(local2, remote2)[0].link).toBe("https://example.com/la");
  });

  it("keeps local-only and remote-only materials", () => {
    const merged = mergeMaterials([material({ id: "m1" })], [material({ id: "m2" })]);
    expect(merged.map((m) => m.id).sort()).toEqual(["m1", "m2"]);
  });

  it("adopts remote scalar fields on conflict", () => {
    const merged = mergeMaterials(
      [material({ status: "In Progress", currentPage: 10 })],
      [material({ status: "Completed", currentPage: 50 })]
    );
    expect(merged[0].status).toBe("Completed");
    expect(merged[0].currentPage).toBe(50);
  });
});

describe("mergePortfolio", () => {
  it("keeps whichever side has a repo URL", () => {
    const merged = mergePortfolio(
      [{ id: "p1", title: "Ray Tracer", completed: false }],
      [{ id: "p1", title: "Ray Tracer", completed: true, repoUrl: "https://github.com/x/y" }]
    );
    expect(merged[0].repoUrl).toBe("https://github.com/x/y");
    expect(merged[0].completed).toBe(true);
  });
});

describe("streak helpers", () => {
  it("addCompletion records once per title and marks the date", () => {
    const state = baseState();
    const first = addCompletion(state, "2026-07-19", "Task A");
    const second = addCompletion({ ...state, ...first }, "2026-07-19", "Task A");
    expect(second.completedItemsHistory["2026-07-19"].length).toBe(1);
    expect(second.streakHistory).toEqual(["2026-07-19"]);
  });

  it("removeCompletion keeps the date while other items remain", () => {
    let state = baseState();
    state = { ...state, ...addCompletion(state, "2026-07-19", "Task A") };
    state = { ...state, ...addCompletion(state, "2026-07-19", "Task B") };

    const afterRemove = removeCompletion(state, "2026-07-19", "Task A");
    expect(afterRemove.streakHistory).toEqual(["2026-07-19"]);

    const afterRemoveAll = removeCompletion({ ...state, ...afterRemove }, "2026-07-19", "Task B");
    expect(afterRemoveAll.streakHistory).toEqual([]);
  });

  it("rebuildStreakHistory only includes dates with accomplishments", () => {
    expect(rebuildStreakHistory({ a: [{ title: "x" }], b: [], c: ["y"] }).sort()).toEqual(["a", "c"]);
  });
});
