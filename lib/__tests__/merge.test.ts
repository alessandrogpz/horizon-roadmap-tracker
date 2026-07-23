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
  itemUpdatedAt: {},
  historyUpdatedAt: {},
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

describe("mergeAppState per-item progress merge", () => {
  it("keeps both devices' completions when they check different items on the same day (no whole-day clobber)", () => {
    // Regression test: this is the exact cross-device scenario that used to
    // lose data — desktop checks item "a", phone (never having pulled
    // desktop's change) independently checks item "b" on the same day.
    // Whole-day LWW would let whichever side merges second wipe out the
    // other's checkbox; per-item LWW must keep both.
    const local = baseState({
      itemUpdatedAt: { "2026-07-10": { "t:a": 1000 } },
      weeklyCompletions: { "2026-07-10": { tasks: ["a"], revisions: [] } },
    });
    const remote = baseState({
      itemUpdatedAt: { "2026-07-10": { "t:b": 2000 } },
      weeklyCompletions: { "2026-07-10": { tasks: ["b"], revisions: [] } },
    });

    const { data } = mergeAppState(local, remote);
    expect(data.weeklyCompletions["2026-07-10"].tasks.sort()).toEqual(["a", "b"]);
  });

  it("uses the newer per-item timestamp when both sides toggled the same item", () => {
    const local = baseState({
      itemUpdatedAt: { "2026-07-10": { "t:a": 5000 } },
      weeklyCompletions: { "2026-07-10": { tasks: ["a"], revisions: [] } },
    });
    const remote = baseState({
      // Remote unchecked "a" more recently than local checked it: remote wins.
      itemUpdatedAt: { "2026-07-10": { "t:a": 9000 } },
      weeklyCompletions: { "2026-07-10": { tasks: [], revisions: [] } },
    });

    const { data } = mergeAppState(local, remote);
    expect(data.weeklyCompletions["2026-07-10"].tasks).toEqual([]);
  });

  it("keeps a locally-newer item edit instead of reverting to a stale remote value", () => {
    const local = baseState({
      itemUpdatedAt: { "2026-07-10": { "t:a": 9000 } },
      weeklyCompletions: { "2026-07-10": { tasks: ["a"], revisions: [] } },
    });
    const remote = baseState({
      itemUpdatedAt: { "2026-07-10": { "t:a": 5000 } },
      weeklyCompletions: { "2026-07-10": { tasks: [], revisions: [] } },
    });

    const { data } = mergeAppState(local, remote);
    expect(data.weeklyCompletions["2026-07-10"].tasks).toEqual(["a"]);
  });

  it("unions completions when neither side has a timestamp (legacy fallback)", () => {
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

  it("lets a newer-timestamped removal win over an older addition, while an untouched item still unions in", () => {
    const local = baseState({
      itemUpdatedAt: { "2026-07-10": { "t:a": 1000 } },
      weeklyCompletions: { "2026-07-10": { tasks: ["a", "b"], revisions: [] } },
    });
    const remote = baseState({
      // Remote unchecked "a" after local checked it, so remote wins that item.
      // "b" was never toggled on either side, so it has no timestamp and unions in.
      itemUpdatedAt: { "2026-07-10": { "t:a": 2000 } },
      weeklyCompletions: { "2026-07-10": { tasks: [], revisions: [] } },
    });

    const { data } = mergeAppState(local, remote);
    expect(data.weeklyCompletions["2026-07-10"].tasks.sort()).toEqual(["b"]);
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

  it("adopts remote scalar fields on conflict when neither side has an updatedAt (legacy fallback)", () => {
    const merged = mergeMaterials(
      [material({ status: "In Progress", currentPage: 10 })],
      [material({ status: "Completed", currentPage: 50 })]
    );
    expect(merged[0].status).toBe("Completed");
    expect(merged[0].currentPage).toBe(50);
  });

  it("keeps a more recent local edit instead of reverting to a stale remote value", () => {
    // Regression test: editing totalPages/currentSubject locally and syncing
    // used to silently revert to the remote (older) values because the merge
    // favored remote fields regardless of which side was actually newer.
    const local = [material({ totalPages: 320, currentSubject: "Linear Algebra", updatedAt: 2000 })];
    const remote = [material({ totalPages: 250, currentSubject: "Calculus", updatedAt: 1000 })];
    const merged = mergeMaterials(local, remote);
    expect(merged[0].totalPages).toBe(320);
    expect(merged[0].currentSubject).toBe("Linear Algebra");
  });

  it("adopts the remote edit when it is newer than the local record", () => {
    const local = [material({ totalPages: 250, currentSubject: "Calculus", updatedAt: 1000 })];
    const remote = [material({ totalPages: 320, currentSubject: "Linear Algebra", updatedAt: 2000 })];
    const merged = mergeMaterials(local, remote);
    expect(merged[0].totalPages).toBe(320);
    expect(merged[0].currentSubject).toBe("Linear Algebra");
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
