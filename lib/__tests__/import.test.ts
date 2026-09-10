import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { InvalidBackupError, parseBackup, readBackupFile, summarizeBackup } from "../import";
import type { BackupBundle } from "../export";
import type { TrackState } from "../types";

const track = (id: string, name: string, overrides: Partial<TrackState> = {}): TrackState => ({
  meta: { id, name, color: "#0ea5e9", templateId: "custom", createdAt: 0 },
  currentPhase: 1,
  startDate: "2026-01-01",
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

const bundle = (): BackupBundle => ({
  exportedAt: "2026-07-26T10:00:00.000Z",
  version: 1,
  workspace: {
    activeTrackId: "t1",
    tracks: {
      t1: track("t1", "Engine", {
        completedItemsHistory: { "2026-07-01": ["Ray tracer"], "2026-07-02": [] },
      }),
      t2: track("t2", "Marathon", {
        completedItemsHistory: { "2026-07-01": ["Long run"], "2026-07-03": ["Intervals"] },
      }),
    },
  },
  notes: { m1: "# Notes", m2: "more" },
});

describe("parseBackup", () => {
  it("round-trips a real bundle", () => {
    const parsed = parseBackup(JSON.stringify(bundle()));
    expect(Object.keys(parsed.workspace.tracks)).toEqual(["t1", "t2"]);
    expect(parsed.notes.m1).toBe("# Notes");
    expect(parsed.exportedAt).toBe("2026-07-26T10:00:00.000Z");
  });

  it("tolerates a bundle with no notes", () => {
    const raw = bundle() as Partial<BackupBundle>;
    delete raw.notes;
    expect(parseBackup(JSON.stringify(raw)).notes).toEqual({});
  });

  it("rejects text that isn't JSON", () => {
    expect(() => parseBackup("not json at all")).toThrow(InvalidBackupError);
  });

  it("rejects a note that isn't text, or whose id the app would never make (T7)", () => {
    const withNotes = (notes: unknown) => JSON.stringify({ ...bundle(), notes });
    expect(() => parseBackup(withNotes({ m1: { $ne: null } }))).toThrow(InvalidBackupError);
    expect(() => parseBackup(withNotes({ m1: 42 }))).toThrow(InvalidBackupError);
    expect(() => parseBackup(withNotes({ "../../etc/passwd": "x" }))).toThrow(InvalidBackupError);
    expect(() => parseBackup(withNotes({ "notepad_track_1": "fine", m_2: "" }))).not.toThrow();
  });

  it("rejects JSON that isn't a backup", () => {
    expect(() => parseBackup('{"hello":"world"}')).toThrow(/no workspace/i);
  });

  it("rejects a backup with no tracks", () => {
    expect(() => parseBackup('{"workspace":{"activeTrackId":"x","tracks":{}}}')).toThrow(/no tracks/i);
  });

  it("rejects a track missing its identity", () => {
    const raw = bundle();
    (raw.workspace.tracks as Record<string, unknown>).t2 = { phases: [] };
    expect(() => parseBackup(JSON.stringify(raw))).toThrow(/malformed/i);
  });
});

describe("readBackupFile", () => {
  const asFile = (name: string, data: BlobPart) => new File([data], name);

  it("reads the .json export", async () => {
    const parsed = await readBackupFile(asFile("backup.json", JSON.stringify(bundle())));
    expect(parsed.workspace.activeTrackId).toBe("t1");
  });

  it("reads database.json out of the .zip export", async () => {
    const zipped = zipSync({
      "database.json": strToU8(JSON.stringify(bundle())),
      "roadmaps/engine.md": strToU8("# Engine"),
    });
    const parsed = await readBackupFile(asFile("backup.zip", zipped as BlobPart));
    expect(Object.keys(parsed.workspace.tracks)).toHaveLength(2);
  });

  it("rejects a zip with no database.json", async () => {
    const zipped = zipSync({ "notes/a.md": strToU8("hi") });
    await expect(readBackupFile(asFile("backup.zip", zipped as BlobPart))).rejects.toThrow(
      /no database\.json/i
    );
  });
});

describe("summarizeBackup", () => {
  it("counts tracks, notes and distinct active days across tracks", () => {
    const summary = summarizeBackup(bundle());
    expect(summary.trackCount).toBe(2);
    expect(summary.trackNames).toEqual(["Engine", "Marathon"]);
    expect(summary.noteCount).toBe(2);
    // 07-01 counted once despite two tracks; 07-02 has no items; 07-03 counts.
    expect(summary.activeDays).toBe(2);
  });
});
