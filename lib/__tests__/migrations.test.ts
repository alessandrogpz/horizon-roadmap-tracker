import { describe, it, expect } from "vitest";
import { CURRENT_SCHEMA_VERSION, MIGRATIONS, migrateWorkspace } from "../migrations";
import { defaultPanelColumns } from "../modules";
import type { TrackState, Workspace } from "../types";

const track = (overrides: Partial<TrackState> = {}): TrackState => ({
  meta: { id: "t1", name: "Track", color: "#0ea5e9", templateId: "custom", createdAt: 0 },
  currentPhase: 1,
  startDate: "2026-07-01",
  streakHistory: [],
  lastTasksResetDate: "",
  dailyTasks: {},
  dailyRevisionItems: {},
  phases: [],
  portfolio: [],
  materials: [],
  completedItemsHistory: {},
  weeklyCompletions: {},
  ...overrides,
});

const workspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  activeTrackId: "t1",
  tracks: { t1: track() },
  ...overrides,
});

describe("migrateWorkspace", () => {
  it("treats data written before the pipeline existed as version 0 and runs every step", () => {
    const { workspace: migrated, changed } = migrateWorkspace(workspace());
    expect(changed).toBe(true);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // per-track-panel-layout ran: the track now carries its own layout.
    expect(migrated.tracks.t1.panelColumns).toEqual(defaultPanelColumns());
  });

  it("is a no-op on data already at the current version", () => {
    const once = migrateWorkspace(workspace()).workspace;
    const { workspace: twice, changed } = migrateWorkspace(once);
    expect(changed).toBe(false);
    expect(twice).toBe(once);
  });

  it("replaying every step over already-migrated data changes nothing", () => {
    const once = migrateWorkspace(workspace()).workspace;
    const replayed = MIGRATIONS.reduce((ws, m) => m.migrate(ws), once);
    expect(replayed).toEqual(once);
  });

  it("passes through data stamped by a newer app version rather than mangling it", () => {
    const fromFuture = workspace({ schemaVersion: CURRENT_SCHEMA_VERSION + 5 });
    const { workspace: result, changed } = migrateWorkspace(fromFuture);
    expect(changed).toBe(false);
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION + 5);
  });

  it("moves a legacy workspace-level layout onto the track and drops the old copy", () => {
    const legacyLayout = { left: ["weeklyPlan"], right: ["materialsTracker"] };
    const { workspace: migrated } = migrateWorkspace(workspace({ panelColumns: legacyLayout }));

    expect(migrated.tracks.t1.panelColumns).toEqual(legacyLayout);
    expect(migrated.panelColumns).toBeUndefined();
    // Copied, not aliased — two tracks must never share one array.
    expect(migrated.tracks.t1.panelColumns?.left).not.toBe(legacyLayout.left);
  });

  it("splits a legacy rotationConfig into the two rotations it implied", () => {
    const legacy = {
      ...track(),
      rotationConfig: {
        weeks: [{ pattern: "Two Pointers", problems: "3Sum" }],
        appliesToScheduleType: "math",
      },
      dsaStartWeek: 3,
    } as unknown as TrackState;

    const { workspace: migrated } = migrateWorkspace(workspace({ tracks: { t1: legacy } }));
    const rotations = migrated.tracks.t1.rotations;

    expect(rotations).toHaveLength(2);
    expect(rotations?.find((r) => r.id === "legacy_pattern_rotation")?.startWeek).toBe(3);
    expect((migrated.tracks.t1 as unknown as { rotationConfig?: unknown }).rotationConfig).toBeUndefined();
  });

  it("never mutates the workspace it was handed", () => {
    const original = workspace();
    const snapshot = JSON.parse(JSON.stringify(original));
    migrateWorkspace(original);
    expect(original).toEqual(snapshot);
  });
});

describe("MIGRATIONS registry", () => {
  it("has unique, stable ids — the stored schemaVersion indexes into this list", () => {
    const ids = MIGRATIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps CURRENT_SCHEMA_VERSION in step with the list length", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(MIGRATIONS.length);
  });
});
