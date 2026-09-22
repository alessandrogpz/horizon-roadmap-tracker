import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { migrateWorkspace } from "../migrations";
import { wrapLegacyAppState } from "../migrations/legacyAppState";
import { blankTrack } from "../templates";
import { rebuildStreakHistory } from "../streak";
import { mergeWorkspace } from "../merge";
import type { TrackState, Workspace } from "../types";
import { assembleWorkspace, clampWorkspace, splitWorkspace, stableStringify } from "../server/sync/model";
import { SyncRequestSchema, WorkspaceSchema } from "../server/sync/schema";

/** The real data fixture (a year of the author's own use), as the app holds it today. */
const realWorkspace = (): Workspace =>
  migrateWorkspace(wrapLegacyAppState(JSON.parse(readFileSync("data/database.json", "utf8")))).workspace;

const blankWorkspace = (): Workspace => {
  const track = blankTrack("My Track", "2026-09-10");
  return migrateWorkspace({ activeTrackId: track.meta.id, tracks: { [track.meta.id]: track } }).workspace;
};

/** What must survive a trip through the database. Days with nothing in them
 *  carry no information, and the sync flags are the device's own.
 *  streakHistory is derived: the app itself rebuilds it from the
 *  accomplishments on every tick and every merge (lib/streak.ts), so the
 *  database doesn't store it. The fixture's copy predates that rule and lists
 *  a few days with no accomplishment; the app drops those at the next change
 *  anyway, so what's compared is the rebuilt streak. */
const essence = (workspace: Workspace) => {
  const tracks = Object.fromEntries(
    Object.entries(workspace.tracks).map(([trackId, track]) => {
      const { isSynced: _isSynced, streakHistory: _streak, ...rest } = track;
      void _isSynced;
      void _streak;
      const nonEmpty = <T,>(map: Record<string, T> | undefined, empty: (v: T) => boolean) =>
        Object.fromEntries(Object.entries(map ?? {}).filter(([, v]) => !empty(v)));
      return [
        trackId,
        {
          ...rest,
          // The merge reads a missing configVersion as 0; the database stores the 0.
          configVersion: track.configVersion ?? 0,
          weeklyCompletions: nonEmpty(track.weeklyCompletions, (v) => !v.tasks.length && !v.revisions.length),
          itemUpdatedAt: nonEmpty(track.itemUpdatedAt, (v) => !Object.keys(v).length),
          completedItemsHistory: nonEmpty(track.completedItemsHistory, (v) => !v.length),
          historyUpdatedAt: nonEmpty(track.historyUpdatedAt, (v) => !Object.keys(v).length),
          streak: rebuildStreakHistory(track.completedItemsHistory ?? {}),
        },
      ];
    })
  );
  return stableStringify({ activeTrackId: workspace.activeTrackId, schemaVersion: workspace.schemaVersion, tracks });
};

const roundTrip = (workspace: Workspace) => {
  const { tracks, days } = splitWorkspace(workspace);
  return assembleWorkspace(tracks, days, workspace.activeTrackId);
};

/** Every key in a document, at any depth. */
const allKeys = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap(allKeys)
    : value && typeof value === "object"
      ? Object.entries(value).flatMap(([k, v]) => [k, ...allKeys(v)])
      : [];

describe("splitWorkspace / assembleWorkspace", () => {
  it("keep every fact in the real data fixture", () => {
    const real = realWorkspace();
    expect(Object.keys(real.tracks)).toHaveLength(1);
    expect(essence(roundTrip(real))).toBe(essence(real));
  });

  it("keep a new blank track exactly", () => {
    const blank = blankWorkspace();
    expect(essence(roundTrip(blank))).toBe(essence(blank));
  });

  it("keep unticked boxes, untimestamped legacy ticks, and plain-string accomplishments", () => {
    const base = blankWorkspace();
    const [trackId] = Object.keys(base.tracks);
    const track: TrackState = {
      ...base.tracks[trackId],
      weeklyCompletions: { "2026-09-01": { tasks: ["a", "legacy"], revisions: ["r1"] } },
      itemUpdatedAt: { "2026-09-01": { "t:a": 100, "t:b": 200, "r:r1": 300, "r:r2": 400 } }, // b and r2: unticked later
      completedItemsHistory: {
        "2026-09-01": ["Old plain entry", { title: "Read ch. 3" }, { title: "$5 budget", description: "tracked" }],
      },
      historyUpdatedAt: { "2026-09-01": { "Read ch. 3": 500, "Removed later": 600 } },
    };
    const workspace = { ...base, tracks: { [trackId]: track } };
    expect(essence(roundTrip(workspace))).toBe(essence(workspace));

    const { days } = splitWorkspace(workspace);
    expect(days[0].tasks).toEqual([
      { id: "a", done: true, updatedAt: 100 },
      { id: "legacy", done: true, updatedAt: 0 },
      { id: "b", done: false, updatedAt: 200 },
    ]);
    expect(days[0].accomplishments.find((a) => a.title === "Removed later")).toEqual({ title: "Removed later", done: false, updatedAt: 600 });
  });

  it("never turn a title into a field name: dots and dollars stay values", () => {
    const base = blankWorkspace();
    const [trackId] = Object.keys(base.tracks);
    const workspace = {
      ...base,
      tracks: {
        [trackId]: {
          ...base.tracks[trackId],
          completedItemsHistory: { "2026-09-01": [{ title: "Read ch. 3" }, { title: "$where" }] },
          historyUpdatedAt: { "2026-09-01": { "Read ch. 3": 1, $where: 2 } },
        },
      },
    };
    const { tracks, days } = splitWorkspace(workspace);
    const keys = allKeys([...tracks, ...days]);
    expect(keys.filter((k) => k.includes(".") || k.startsWith("$"))).toEqual([]);
    expect(days[0].accomplishments.map((a) => a.title)).toEqual(["Read ch. 3", "$where"]);
  });

  it("keep merged data valid, and leave the device's sync flags out of the documents", () => {
    // mergeAppState stamps hasUnsyncedChanges and lastSyncTime onto every track.
    const merged = mergeWorkspace(realWorkspace(), realWorkspace()).data;
    expect(WorkspaceSchema.safeParse(merged).error).toBeUndefined();
    const [track] = splitWorkspace(merged).tracks;
    expect(track).not.toHaveProperty("lastSyncTime");
    expect(track).not.toHaveProperty("hasUnsyncedChanges");
    expect(track).not.toHaveProperty("isSynced");
  });

  it("don't store days with nothing in them", () => {
    const base = blankWorkspace();
    const [trackId] = Object.keys(base.tracks);
    const workspace = {
      ...base,
      tracks: { [trackId]: { ...base.tracks[trackId], weeklyCompletions: { "2026-09-01": { tasks: [], revisions: [] } } } },
    };
    expect(splitWorkspace(workspace).days).toEqual([]);
  });
});

describe("clampWorkspace (T3)", () => {
  it("pulls future timestamps back to now plus the allowance, and leaves the past alone", () => {
    const base = blankWorkspace();
    const [trackId] = Object.keys(base.tracks);
    const now = 1_800_000_000_000;
    const dayLater = now + 24 * 60 * 60 * 1000;
    const workspace = {
      ...base,
      tracks: {
        [trackId]: {
          ...base.tracks[trackId],
          itemUpdatedAt: { "2026-09-01": { "t:a": dayLater, "t:b": now - 1000 } },
          historyUpdatedAt: { "2026-09-01": { Done: dayLater } },
          materials: [{ id: "m1", title: "Book", category: "", type: "", status: "", currentPage: 0, totalPages: 0, currentSubject: "", link: "", updatedAt: dayLater }],
        },
      },
    };
    const clamped = clampWorkspace(workspace, now, 60_000).tracks[trackId];
    expect(clamped.itemUpdatedAt).toEqual({ "2026-09-01": { "t:a": now + 60_000, "t:b": now - 1000 } });
    expect(clamped.historyUpdatedAt).toEqual({ "2026-09-01": { Done: now + 60_000 } });
    expect(clamped.materials[0].updatedAt).toBe(now + 60_000);
  });
});

describe("stableStringify", () => {
  it("ignores key order and undefined values", () => {
    expect(stableStringify({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } })).toBe(
      stableStringify({ a: { d: [1, { x: 1, y: 2 }] }, b: 1 })
    );
  });
});

describe("the sync request schema", () => {
  const request = (workspace: unknown, notes: unknown[] = []) => SyncRequestSchema.safeParse({ workspace, notes });

  it("accepts the real data and a new blank track", () => {
    expect(WorkspaceSchema.safeParse(realWorkspace()).error).toBeUndefined();
    expect(WorkspaceSchema.safeParse(blankWorkspace()).error).toBeUndefined();
    expect(request(realWorkspace(), [{ id: "notepad_track_x", content: "hi", updatedAt: 1 }]).success).toBe(true);
  });

  const withTrack = (change: (track: Record<string, unknown>) => Record<string, unknown>) => {
    const workspace = blankWorkspace();
    const [trackId] = Object.keys(workspace.tracks);
    return { ...workspace, tracks: { [trackId]: change({ ...workspace.tracks[trackId] }) } };
  };

  // Found on the day this went live (0.21.4): the author's oldest track still
  // carried `lastUpdatedDates`, retired long before the changelog began. Strict
  // objects refuse what they don't list, so every sync from that device failed
  // with "Malformed request." The fixture above predates the field, which is
  // exactly why nothing here caught it.
  it("accepts a retired field an old track still carries, and keeps it (0.21.4)", () => {
    const lastUpdatedDates = { "2026-07-19": 1784473045926, "2026-07-20": 1 };
    const workspace = withTrack((track) => ({ ...track, lastUpdatedDates })) as unknown as Workspace;
    expect(request(workspace).success).toBe(true);

    const [trackId] = Object.keys(workspace.tracks);
    expect(roundTrip(workspace).tracks[trackId].lastUpdatedDates).toEqual(lastUpdatedDates);
  });

  it("refuses a field it doesn't know, such as a smuggled userId (T2)", () => {
    expect(request(withTrack((t) => ({ ...t, userId: "someone-else" }))).success).toBe(false);
    expect(request({ ...blankWorkspace(), userId: "someone-else" }).success).toBe(false);
    expect(SyncRequestSchema.safeParse({ workspace: blankWorkspace(), notes: [], userId: "x" }).success).toBe(false);
  });

  it("refuses operator or path keys where keys become field names (T1)", () => {
    expect(request(withTrack((t) => ({ ...t, focusTypes: { $where: { label: "x", color: "#000" } } }))).success).toBe(false);
    expect(request(withTrack((t) => ({ ...t, focusTypes: { "a.b": { label: "x", color: "#000" } } }))).success).toBe(false);
  });

  it("refuses an operator where a value belongs (T1)", () => {
    expect(request(blankWorkspace(), [{ id: "n1", content: { $ne: null }, updatedAt: 1 }]).success).toBe(false);
    expect(request(blankWorkspace(), [{ id: { $gt: "" }, content: "x", updatedAt: 1 }]).success).toBe(false);
  });

  it("refuses malformed dates, ids and oversized text (D1)", () => {
    expect(request(withTrack((t) => ({ ...t, weeklyCompletions: { yesterday: { tasks: [], revisions: [] } } }))).success).toBe(false);
    expect(request(blankWorkspace(), [{ id: "../../etc/passwd", content: "x", updatedAt: 1 }]).success).toBe(false);
    expect(request(withTrack((t) => ({ ...t, roadmapContent: "x".repeat(500_001) }))).success).toBe(false);
  });
});
