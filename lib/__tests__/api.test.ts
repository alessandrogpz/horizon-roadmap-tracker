import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { fetchWorkspace, updateWorkspace, createTrack } from "../api";
import type { TrackState } from "../types";

const baseTrack = (id: string): TrackState => ({
  meta: { id, name: "Track", color: "#0ea5e9", templateId: "custom", createdAt: Date.now() },
  currentPhase: 1,
  startDate: "2026-07-01",
  dsaStartWeek: 1,
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
  lastUpdatedDates: {},
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
});
