import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { buildBackupBundle, buildZipFiles, slugify, type BackupBundle } from "../export";
import { createTrack } from "../workspaceRepo";
import { db } from "../localDb";
import { notepadNoteId, todoNoteId } from "../quickNotes";
import type { TrackState } from "../types";

const baseTrack = (id: string, overrides: Partial<TrackState> = {}): TrackState => ({
  meta: { id, name: "Land a PM Role", color: "#0ea5e9", templateId: "custom", createdAt: Date.now() },
  currentPhase: 1,
  startDate: "2026-07-01",
  streakHistory: [],
  lastDailyRoutineCheck: "",
  lastTasksResetDate: "",
  dailyFocus: {},
  dailyTasks: {},
  dailyRevisionItems: {},
  phases: [{ id: 1, title: "Phase 1", description: "d", tasks: [], detailedInfo: { focus: "", deliverable: "", math: "" } }],
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

describe("slugify", () => {
  it("lowercases and dashes non-alphanumeric characters", () => {
    expect(slugify("Weekly Algorithm: Part 1!", "fallback")).toBe("weekly-algorithm-part-1");
  });

  it("falls back for text that has no usable characters", () => {
    expect(slugify("!!!", "abc123")).toBe("abc123");
    expect(slugify("", "abc123")).toBe("abc123");
  });
});

describe("buildBackupBundle", () => {
  it("includes the full workspace and every material note, keyed by materialId", async () => {
    const track = baseTrack("track_export_1", {
      materials: [{ id: "m1", title: "Book", category: "Other", type: "Book", status: "In Progress", currentPage: 1, totalPages: 10, currentSubject: "", link: "" }],
    });
    await createTrack(track);
    await db.notes.put({ id: "m1", content: "# My notes", updatedAt: Date.now() });

    const bundle = await buildBackupBundle();
    expect(bundle.version).toBe(1);
    expect(bundle.workspace.tracks["track_export_1"].meta.name).toBe("Land a PM Role");
    expect(bundle.notes["m1"]).toBe("# My notes");
    expect(new Date(bundle.exportedAt).toString()).not.toBe("Invalid Date");
  });
});

describe("buildZipFiles", () => {
  const makeBundle = (track: TrackState, notes: Record<string, string> = {}): BackupBundle => ({
    exportedAt: new Date().toISOString(),
    version: 1,
    workspace: { activeTrackId: track.meta.id, tracks: { [track.meta.id]: track } },
    notes,
  });

  it("always includes database.json with the full bundle", () => {
    const track = baseTrack("t1");
    const files = buildZipFiles(makeBundle(track));
    expect(files["database.json"]).toBeDefined();
  });

  it("writes each track's notepad and to-do list out under the track's name, when they have content", () => {
    const files = buildZipFiles(makeBundle(baseTrack("t1"), { [notepadNoteId("t1")]: "idea", [todoNoteId("t1")]: "- [ ] thing" }));
    expect(new TextDecoder().decode(files["notepads/land-a-pm-role.md"])).toBe("idea");
    expect(new TextDecoder().decode(files["todos/land-a-pm-role.md"])).toBe("- [ ] thing");

    const empty = buildZipFiles(makeBundle(baseTrack("t1"), { [notepadNoteId("t1")]: "  " }));
    expect(Object.keys(empty).some((p) => p.startsWith("notepads/") || p.startsWith("todos/"))).toBe(false);
  });

  it("adds a roadmap file only when roadmapContent is non-empty", () => {
    const withRoadmap = buildZipFiles(makeBundle(baseTrack("t1", { roadmapContent: "# Plan" })));
    expect(Object.keys(withRoadmap)).toContain("roadmaps/land-a-pm-role.md");

    const withoutRoadmap = buildZipFiles(makeBundle(baseTrack("t1")));
    expect(Object.keys(withoutRoadmap).some((p) => p.startsWith("roadmaps/"))).toBe(false);
  });

  it("adds one .md file per rotation with a non-empty explanation, skipping empty ones", () => {
    const track = baseTrack("t1", {
      rotations: [
        { id: "r1", label: "Weekly Algorithm", items: [{ title: "X" }], daysOfWeek: ["Mon"], target: "revision", startWeek: 1, explanation: "Why this rotation" },
        { id: "r2", label: "Linear Algebra", items: [{ title: "Y" }], daysOfWeek: ["Tue"], target: "revision", startWeek: 1 },
      ],
    });
    const files = buildZipFiles(makeBundle(track));
    const rotationPaths = Object.keys(files).filter((p) => p.startsWith("rotations/"));
    expect(rotationPaths).toHaveLength(1);
    expect(rotationPaths[0]).toContain("weekly-algorithm");
  });

  it("adds a note file per material that has note content", () => {
    const track = baseTrack("t1", {
      materials: [
        { id: "m1", title: "Book One", category: "Other", type: "Book", status: "In Progress", currentPage: 1, totalPages: 10, currentSubject: "", link: "" },
        { id: "m2", title: "Book Two", category: "Other", type: "Book", status: "Not Started", currentPage: 0, totalPages: 10, currentSubject: "", link: "" },
      ],
    });
    const files = buildZipFiles(makeBundle(track, { m1: "notes for book one" }));
    const notePaths = Object.keys(files).filter((p) => p.startsWith("notes/"));
    expect(notePaths).toHaveLength(1);
    expect(notePaths[0]).toContain("book-one");
  });

  it("disambiguates two items that would slugify to the same filename", () => {
    const track = baseTrack("t1", {
      rotations: [
        { id: "aaaaaaaa-1111", label: "Reading", items: [{ title: "X" }], daysOfWeek: ["Mon"], target: "revision", startWeek: 1, explanation: "First" },
        { id: "bbbbbbbb-2222", label: "Reading", items: [{ title: "X" }], daysOfWeek: ["Tue"], target: "revision", startWeek: 1, explanation: "Second" },
      ],
    });
    const files = buildZipFiles(makeBundle(track));
    const rotationPaths = Object.keys(files).filter((p) => p.startsWith("rotations/"));
    expect(rotationPaths).toHaveLength(2);
    expect(new Set(rotationPaths).size).toBe(2);
  });
});
