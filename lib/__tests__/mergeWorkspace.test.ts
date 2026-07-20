import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { mergeWorkspace } from "../merge";
import { wrapLegacyAppState, LEGACY_TRACK_ID } from "../localDb";
import type { AppState, TrackMeta, TrackState, Workspace } from "../types";

const baseTrackFields = (overrides: Partial<AppState> = {}): AppState => ({
  currentPhase: 1,
  startDate: "2026-07-01",
  dsaStartWeek: 1,
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

const meta = (overrides: Partial<TrackMeta> = {}): TrackMeta => ({
  id: "track_a",
  name: "Track A",
  color: "#0ea5e9",
  templateId: "blank",
  createdAt: 1700000000000,
  ...overrides,
});

const track = (metaOverrides: Partial<TrackMeta> = {}, fieldOverrides: Partial<AppState> = {}): TrackState => ({
  ...baseTrackFields(fieldOverrides),
  meta: meta(metaOverrides),
});

const workspace = (tracks: TrackState[], overrides: Partial<Workspace> = {}): Workspace => ({
  activeTrackId: tracks[0]?.meta.id || "",
  tracks: Object.fromEntries(tracks.map((t) => [t.meta.id, t])),
  ...overrides,
});

describe("mergeWorkspace", () => {
  it("merges a track present on both sides using the per-track day-level merge", () => {
    const local = workspace([
      track({ id: "track_a" }, {
        configVersion: 1,
        lastUpdatedDates: { "2026-07-10": 1 },
        weeklyCompletions: { "2026-07-10": { tasks: ["a"], revisions: [] } },
      }),
    ]);
    const remote = workspace([
      track({ id: "track_a" }, {
        configVersion: 1,
        lastUpdatedDates: { "2026-07-10": 3 },
        weeklyCompletions: { "2026-07-10": { tasks: ["b"], revisions: [] } },
      }),
    ]);

    const { data, log } = mergeWorkspace(local, remote);
    expect(data.tracks.track_a.weeklyCompletions["2026-07-10"]).toEqual({ tasks: ["b"], revisions: [] });
    expect(log.join(" ")).toContain('Track "Track A"');
  });

  it("keeps a track that exists only locally, never treating it as deleted", () => {
    const local = workspace([track({ id: "track_a" }), track({ id: "track_b", name: "Fitness" })]);
    const remote = workspace([track({ id: "track_a" })]);

    const { data, log } = mergeWorkspace(local, remote);
    expect(Object.keys(data.tracks).sort()).toEqual(["track_a", "track_b"]);
    expect(log.join(" ")).toContain("local-only, kept as-is");
  });

  it("adopts a track that exists only remotely (new track synced from another device)", () => {
    const local = workspace([track({ id: "track_a" })]);
    const remote = workspace([track({ id: "track_a" }), track({ id: "track_c", name: "Learning" })]);

    const { data, log } = mergeWorkspace(local, remote);
    expect(Object.keys(data.tracks).sort()).toEqual(["track_a", "track_c"]);
    expect(log.join(" ")).toContain("adopted from remote (new track)");
  });

  it("keeps the local active track id when it still exists after the merge", () => {
    const local = workspace([track({ id: "track_a" }), track({ id: "track_b" })], { activeTrackId: "track_b" });
    const remote = workspace([track({ id: "track_a" }), track({ id: "track_b" })], { activeTrackId: "track_a" });

    const { data } = mergeWorkspace(local, remote);
    expect(data.activeTrackId).toBe("track_b");
  });

  it("falls back to a surviving track id when the local active track no longer exists", () => {
    const local = workspace([track({ id: "track_b" })], { activeTrackId: "track_b" });
    const remote = workspace([track({ id: "track_a" })], { activeTrackId: "track_a" });

    const { data } = mergeWorkspace(local, remote);
    expect(Object.keys(data.tracks)).toContain(data.activeTrackId);
  });

  it("marks the merged workspace as synced with no unsynced changes", () => {
    const local = workspace([track()]);
    const remote = workspace([track()]);
    const { data } = mergeWorkspace(local, remote);
    expect(data.isSynced).toBe(true);
    expect(data.hasUnsyncedChanges).toBe(false);
    expect(data.lastSyncTime).toBeTypeOf("number");
  });
});

describe("legacy Drive database.json upgrade", () => {
  it("upgrades the repo's real data/database.json into a single-track Workspace", () => {
    const raw = fs.readFileSync(path.join(__dirname, "../../data/database.json"), "utf8");
    const legacy = JSON.parse(raw) as AppState;

    const upgraded = wrapLegacyAppState(legacy);

    expect(upgraded.activeTrackId).toBe(LEGACY_TRACK_ID);
    expect(Object.keys(upgraded.tracks)).toEqual([LEGACY_TRACK_ID]);

    const migratedTrack = upgraded.tracks[LEGACY_TRACK_ID];
    expect(migratedTrack.phases.length).toBe(legacy.phases.length);
    expect(migratedTrack.materials.map((m) => m.id).sort()).toEqual(legacy.materials.map((m) => m.id).sort());
    expect(migratedTrack.portfolio.map((p) => p.id).sort()).toEqual(legacy.portfolio.map((p) => p.id).sort());
    expect(migratedTrack.startDate).toBe(legacy.startDate);
    expect(migratedTrack.completedItemsHistory).toEqual(legacy.completedItemsHistory);
  });

  it("a legacy-upgraded local workspace and a legacy-upgraded remote workspace merge into one track, not two", () => {
    const raw = fs.readFileSync(path.join(__dirname, "../../data/database.json"), "utf8");
    const legacy = JSON.parse(raw) as AppState;

    // Simulates: this device already migrated its local Dexie DB (isSynced true),
    // while the Drive file is still the old flat shape from before the upgrade.
    const local = wrapLegacyAppState(legacy);
    const remote = wrapLegacyAppState(legacy);

    const { data } = mergeWorkspace(local, remote);
    expect(Object.keys(data.tracks)).toEqual([LEGACY_TRACK_ID]);
  });
});
