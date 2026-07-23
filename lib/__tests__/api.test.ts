import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { fetchWorkspace, updateWorkspace, createTrack } from "../api";
import { db } from "../localDb";
import type { TrackState, Workspace } from "../types";

const baseTrack = (id: string): TrackState => ({
  meta: { id, name: "Track", color: "#0ea5e9", templateId: "custom", createdAt: Date.now() },
  currentPhase: 1,
  startDate: "2026-07-01",
  streakHistory: [],
  lastDailyRoutineCheck: "",
  lastTasksResetDate: "",
  dailyFocus: {},
  dailyTasks: {},
  dailyRevisionItems: {},
  phases: [
    { id: 1, title: "Phase 1", description: "d", tasks: [], detailedInfo: { focus: "", deliverable: "", math: "" } },
  ],
  portfolio: [],
  materials: [{ id: "m1", title: "Book", category: "Other", type: "Book", status: "Not Started", currentPage: 0, totalPages: 100, currentSubject: "", link: "" }],
  dailyStudyPoints: {},
  completedItemsHistory: {},
  weeklyCompletions: {},
  studyStreak: [],
  isSynced: true,
  configVersion: 0,
  itemUpdatedAt: {},
  historyUpdatedAt: {},
});

describe("updateWorkspace config-change detection", () => {
  it("detects an in-place edit to an existing phase's content, not just add/remove", async () => {
    const track = baseTrack("track_test_phase_edit");
    await createTrack(track);

    const before = await fetchWorkspace();
    expect(before.tracks[track.meta.id].configVersion).toBe(0);

    const editedTrack: TrackState = {
      ...before.tracks[track.meta.id],
      phases: before.tracks[track.meta.id].phases.map((p) => ({ ...p, title: "Renamed Phase", recommendedByDay: 42 })),
    };
    await updateWorkspace({ ...before, tracks: { ...before.tracks, [track.meta.id]: editedTrack } });

    const after = await fetchWorkspace();
    expect(after.tracks[track.meta.id].phases[0].title).toBe("Renamed Phase");
    expect(after.tracks[track.meta.id].phases[0].recommendedByDay).toBe(42);
    expect(after.tracks[track.meta.id].configVersion).toBe(1);
    expect(after.hasUnsyncedChanges).toBe(true);
  });

  it("detects an in-place edit to an existing material's content, not just add/remove", async () => {
    const track = baseTrack("track_test_material_edit");
    await createTrack(track);

    const before = await fetchWorkspace();
    const editedTrack: TrackState = {
      ...before.tracks[track.meta.id],
      materials: before.tracks[track.meta.id].materials.map((m) => ({ ...m, status: "Completed" })),
    };
    await updateWorkspace({ ...before, tracks: { ...before.tracks, [track.meta.id]: editedTrack } });

    const after = await fetchWorkspace();
    expect(after.tracks[track.meta.id].materials[0].status).toBe("Completed");
    expect(after.tracks[track.meta.id].configVersion).toBe(1);
  });

  it("does not bump configVersion when nothing structural changed", async () => {
    const track = baseTrack("track_test_noop");
    await createTrack(track);

    const before = await fetchWorkspace();
    await updateWorkspace({ ...before, tracks: { ...before.tracks, [track.meta.id]: before.tracks[track.meta.id] } });

    const after = await fetchWorkspace();
    expect(after.tracks[track.meta.id].configVersion).toBe(0);
  });

  it("detects a rename/color change (meta), so it can't be silently lost in a merge", async () => {
    const track = baseTrack("track_test_meta_edit");
    await createTrack(track);

    const before = await fetchWorkspace();
    const editedTrack: TrackState = {
      ...before.tracks[track.meta.id],
      meta: { ...before.tracks[track.meta.id].meta, name: "Renamed Track", color: "#ff0000" },
    };
    await updateWorkspace({ ...before, tracks: { ...before.tracks, [track.meta.id]: editedTrack } });

    const after = await fetchWorkspace();
    expect(after.tracks[track.meta.id].meta.name).toBe("Renamed Track");
    expect(after.tracks[track.meta.id].configVersion).toBe(1);
  });

  it("detects archiving a track (meta.archived), so soft-deletes propagate through sync", async () => {
    const track = baseTrack("track_test_archive_edit");
    await createTrack(track);

    const before = await fetchWorkspace();
    const archivedTrack: TrackState = {
      ...before.tracks[track.meta.id],
      meta: { ...before.tracks[track.meta.id].meta, archived: true },
    };
    await updateWorkspace({ ...before, tracks: { ...before.tracks, [track.meta.id]: archivedTrack } });

    const after = await fetchWorkspace();
    expect(after.tracks[track.meta.id].meta.archived).toBe(true);
    expect(after.tracks[track.meta.id].configVersion).toBe(1);
  });
});

describe("legacy rotationConfig -> rotations migration", () => {
  it("splits an already-synced legacy rotationConfig into pattern + interleave rotations on load", async () => {
    const track = baseTrack("track_test_legacy_rotation");
    const legacyTrack = {
      ...track,
      rotationConfig: {
        weeks: [{ pattern: "Two Pointers", problems: "3Sum" }, { pattern: "Sliding Window", problems: "Min Window" }],
        appliesToScheduleType: "math",
      },
      dsaStartWeek: 3,
    };
    const workspace: Workspace = { activeTrackId: track.meta.id, tracks: { [track.meta.id]: legacyTrack as unknown as TrackState } };
    await db.workspace.put({ id: "current", data: workspace });

    const loaded = await fetchWorkspace();
    const migrated = loaded.tracks[track.meta.id];

    expect(migrated.rotations).toHaveLength(2);
    const pattern = migrated.rotations!.find((r) => r.id === "legacy_pattern_rotation");
    expect(pattern?.daysOfWeek).toEqual(["Mon", "Wed", "Fri"]);
    expect(pattern?.startWeek).toBe(3);
    expect(pattern?.items.map((i) => i.title)).toEqual(["Two Pointers", "Sliding Window"]);
    const interleave = migrated.rotations!.find((r) => r.id === "legacy_math_interleave");
    expect(interleave?.daysOfWeek).toEqual(["Tue", "Thu", "Sat"]);

    expect((migrated as unknown as { rotationConfig?: unknown }).rotationConfig).toBeUndefined();
    expect((migrated as unknown as { dsaStartWeek?: unknown }).dsaStartWeek).toBeUndefined();

    // The migration persists so it only runs once.
    const reloaded = await fetchWorkspace();
    expect(reloaded.tracks[track.meta.id].rotations).toHaveLength(2);
  });

  it("leaves tracks without a legacy rotationConfig untouched", async () => {
    const track = baseTrack("track_test_no_legacy_rotation");
    await createTrack(track);
    const loaded = await fetchWorkspace();
    expect(loaded.tracks[track.meta.id].rotations).toBeUndefined();
  });
});
