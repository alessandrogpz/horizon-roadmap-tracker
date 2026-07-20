import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, it, expect } from "vitest";
import { ProductivityDb, wrapLegacyAppState } from "../localDb";
import { LEGACY_TRACK_ID } from "../templates";
import type { AppState } from "../types";

const uniqueDbName = () => `TestProductivityDb_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const realisticLegacyState: AppState = {
  currentPhase: 2,
  startDate: "2026-06-05",
  currentPhaseStartDate: "2026-07-10",
  dsaStartWeek: 6,
  streakHistory: ["2026-06-05", "2026-06-06"],
  lastDailyRoutineCheck: "2026-06-08",
  lastTasksResetDate: "2026-07-17",
  dailyFocus: { math: "", leetcode: "" },
  dailyTasks: {
    Mon: [{ id: "mon_1", title: "Mathematics", completed: false }],
    Tue: [{ id: "tue_1", title: "DSA Pattern Study", completed: true }],
  },
  dailyRevisionItems: {
    Mon: [{ id: "dsa_auto", title: "Two Pointers", description: "problems", completed: false }],
  },
  phases: [
    { id: 1, title: "Phase 1", description: "desc", tasks: [{ id: "t1", title: "Task", completed: false }], detailedInfo: { focus: "f", deliverable: "d", math: "m" } },
  ],
  portfolio: [{ id: "p1", title: "CPU Ray Tracer", completed: false, localPath: "https://github.com/alessandrogpz/ray-tracer" }],
  materials: [{ id: "m1", title: "Linear Algebra", category: "Mathematics", type: "Book", status: "In Progress", currentPage: 87, totalPages: 183, currentSubject: "Rotation", link: "" }],
  dailyStudyPoints: {},
  completedItemsHistory: { "2026-06-09": [{ title: "Data Oriented Design" }] },
  weeklyCompletions: {},
  studyStreak: [],
  isSynced: true,
  hasUnsyncedChanges: false,
  lastSyncTime: 1753000000000,
  configVersion: 3,
  lastUpdatedDates: { "2026-06-09": 1 },
};

describe("Dexie v1 -> v2 multi-track migration", () => {
  it("opens cleanly on a fresh install with no v1 data", async () => {
    const db = new ProductivityDb(uniqueDbName());
    const workspaceRecord = await db.workspace.get("current");
    expect(workspaceRecord).toBeUndefined();
    const legacyRecord = await db.appState.get("current");
    expect(legacyRecord).toBeUndefined();
    db.close();
  });

  it("migrates a realistic v1 appState row into workspace.tracks[LEGACY_TRACK_ID] with full field fidelity", async () => {
    const dbName = uniqueDbName();

    // Seed v1 data using a raw, version(1)-only Dexie instance.
    const seedDb = new Dexie(dbName);
    seedDb.version(1).stores({ appState: "id", notes: "id" });
    await seedDb.open();
    await seedDb.table("appState").put({ id: "current", data: realisticLegacyState });
    seedDb.close();

    // Opening the real versioned class against the same name triggers the v1->v2 upgrade.
    const db = new ProductivityDb(dbName);
    const workspaceRecord = await db.workspace.get("current");
    expect(workspaceRecord).toBeDefined();
    expect(workspaceRecord!.data.activeTrackId).toBe(LEGACY_TRACK_ID);

    const migratedTrack = workspaceRecord!.data.tracks[LEGACY_TRACK_ID];
    expect(migratedTrack).toBeDefined();
    expect(migratedTrack.meta).toEqual({
      id: LEGACY_TRACK_ID,
      name: "Game Engine & Graphics",
      color: "#0ea5e9",
      templateId: "engine-graphics",
      createdAt: expect.any(Number),
    });

    // Every original AppState field (other than the workspace-only ones) round-trips exactly.
    const { hasUnsyncedChanges: _h, lastSyncTime: _l, ...expectedTrackFields } = realisticLegacyState;
    void _h;
    void _l;
    expect(migratedTrack).toMatchObject(expectedTrackFields);

    // Workspace-level bookkeeping carries over too.
    expect(workspaceRecord!.data.isSynced).toBe(true);
    expect(workspaceRecord!.data.hasUnsyncedChanges).toBe(false);
    expect(workspaceRecord!.data.lastSyncTime).toBe(1753000000000);

    // The original v1 row is left untouched as a rollback snapshot.
    const legacyRecord = await db.appState.get("current");
    expect(legacyRecord?.data).toEqual(realisticLegacyState);

    db.close();
  });

  it("is idempotent to call wrapLegacyAppState directly with the same deterministic track id", () => {
    const first = wrapLegacyAppState(realisticLegacyState);
    const second = wrapLegacyAppState(realisticLegacyState);
    expect(first.activeTrackId).toBe(LEGACY_TRACK_ID);
    expect(second.activeTrackId).toBe(LEGACY_TRACK_ID);
    expect(Object.keys(first.tracks)).toEqual([LEGACY_TRACK_ID]);
  });
});
