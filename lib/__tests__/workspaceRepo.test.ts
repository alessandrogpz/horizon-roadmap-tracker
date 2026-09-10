import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { fetchWorkspace, updateWorkspace, createTrack, ensureStarterTrack } from "../workspaceRepo";
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

  it("reports whether the save left unsynced changes, for the header's sync status", async () => {
    await db.workspace.clear(); // earlier tests in this block leave the flag set
    const track = baseTrack("track_test_unsynced_flag");
    await createTrack(track);

    const before = await fetchWorkspace();
    const unchanged = await updateWorkspace({ ...before });
    expect(unchanged.hasUnsyncedChanges).toBe(false);

    const renamed: TrackState = { ...before.tracks[track.meta.id], meta: { ...before.tracks[track.meta.id].meta, name: "Renamed" } };
    const edited = await updateWorkspace({ ...before, tracks: { ...before.tracks, [track.meta.id]: renamed } });
    expect(edited.hasUnsyncedChanges).toBe(true);
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

  it("detects a focus-type edit, which the old hand-kept field list missed entirely", async () => {
    const track = baseTrack("track_test_focus_types");
    await createTrack(track);

    const before = await fetchWorkspace();
    const editedTrack: TrackState = {
      ...before.tracks[track.meta.id],
      focusTypes: { study: { label: "Study", color: "#ff0000" } },
    };
    await updateWorkspace({ ...before, tracks: { ...before.tracks, [track.meta.id]: editedTrack } });

    const after = await fetchWorkspace();
    expect(after.tracks[track.meta.id].configVersion).toBe(1);
  });

  it("does not bump configVersion for progress-only changes (a ticked checkbox)", async () => {
    const track = baseTrack("track_test_progress_only");
    await createTrack(track);

    const before = await fetchWorkspace();
    const editedTrack: TrackState = {
      ...before.tracks[track.meta.id],
      weeklyCompletions: { "2026-07-06": { tasks: ["task_1"], revisions: [] } },
      completedItemsHistory: { "2026-07-06": [{ title: "Read" }] },
      streakHistory: ["2026-07-06"],
      dailyTasks: { Mon: [{ id: "task_1", title: "Read", completed: true }] },
    };
    await updateWorkspace({ ...before, tracks: { ...before.tracks, [track.meta.id]: editedTrack } });

    const after = await fetchWorkspace();
    // The progress landed, but structural config didn't "win" a future merge
    // just because a box was ticked here more recently.
    expect(after.tracks[track.meta.id].weeklyCompletions["2026-07-06"].tasks).toEqual(["task_1"]);
    expect(after.tracks[track.meta.id].configVersion).toBe(0);
    expect(after.hasUnsyncedChanges).toBe(true);
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

describe("starter track", () => {
  beforeEach(async () => {
    await db.workspace.clear();
  });

  it("gives a fresh install one ready-to-use track, and leaves isSynced unset", async () => {
    const ws = await ensureStarterTrack("2026-09-10");
    const tracks = Object.values(ws.tracks);
    expect(tracks).toHaveLength(1);
    expect(ws.activeTrackId).toBe(tracks[0].meta.id);
    expect(tracks[0].meta.name).toBe("My Track");
    expect(tracks[0].lastTasksResetDate).toBe("2026-09-10"); // today's plan already laid out
    // Unset, so a first Drive sync replaces the untouched starter instead of
    // merging it into the tracks already in Drive.
    expect((await fetchWorkspace()).isSynced).toBeUndefined();
  });

  it("never adds a second one, even when asked twice at once", async () => {
    await Promise.all([ensureStarterTrack("2026-09-10"), ensureStarterTrack("2026-09-10")]);
    expect(Object.keys((await fetchWorkspace()).tracks)).toHaveLength(1);
  });

  it("leaves a workspace that already has a visible track alone", async () => {
    await createTrack(baseTrack("track_existing"));
    const ws = await ensureStarterTrack("2026-09-10");
    expect(Object.keys(ws.tracks)).toEqual(["track_existing"]);
  });

  it("adds one when every track is archived", async () => {
    const archived = baseTrack("track_archived");
    await createTrack({ ...archived, meta: { ...archived.meta, archived: true } });
    const ws = await ensureStarterTrack("2026-09-10");
    expect(Object.keys(ws.tracks)).toHaveLength(2);
    expect(ws.tracks[ws.activeTrackId].meta.archived).toBeFalsy();
  });

  it("a daily-reset save alone doesn't set isSynced", async () => {
    const starter = await ensureStarterTrack("2026-09-10");
    await updateWorkspace({ ...starter, isReset: true });
    expect((await fetchWorkspace()).isSynced).toBeUndefined();
  });

  it("the first real edit sets isSynced, and a later save from a stale copy can't unset it", async () => {
    const starter = await ensureStarterTrack("2026-09-10");
    const track = starter.tracks[starter.activeTrackId];
    const renamed = { ...track, meta: { ...track.meta, name: "Renamed" } };
    await updateWorkspace({ ...starter, tracks: { [track.meta.id]: renamed } });
    expect((await fetchWorkspace()).isSynced).toBe(true);

    // `starter` still says unset: it predates the write, like the provider's
    // in-memory copy does. Saving it again must not carry that into storage.
    await updateWorkspace({ ...starter, tracks: { [track.meta.id]: renamed }, isReset: true });
    expect((await fetchWorkspace()).isSynced).toBe(true);
  });
});
