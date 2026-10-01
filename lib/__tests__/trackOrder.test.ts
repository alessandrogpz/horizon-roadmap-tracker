import { describe, it, expect } from "vitest";
import { reorderTracks } from "../trackActions";
import { orderedTracks, visibleTracks } from "../selectors";
import type { TrackState, Workspace } from "../types";

const track = (id: string, createdAt: number, order?: number, archived?: boolean): TrackState =>
  ({
    meta: {
      id,
      name: id,
      color: "#0ea5e9",
      templateId: "custom",
      createdAt,
      ...(order === undefined ? {} : { order }),
      ...(archived === undefined ? {} : { archived }),
    },
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
  }) as TrackState;

const workspace = (...tracks: TrackState[]): Workspace => ({
  activeTrackId: tracks[0]?.meta.id ?? "",
  tracks: Object.fromEntries(tracks.map((t) => [t.meta.id, t])),
});

const names = (tracks: TrackState[]) => tracks.map((t) => t.meta.id);

describe("the order of the track list", () => {
  it("falls back to the order they were made in", () => {
    // Deliberately inserted newest-first, so insertion order cannot be what
    // is being read.
    const ws = workspace(track("c", 300), track("a", 100), track("b", 200));
    expect(names(orderedTracks(ws))).toEqual(["a", "b", "c"]);
  });

  it("follows the stored positions once there are any", () => {
    const ws = workspace(track("a", 100, 2), track("b", 200, 0), track("c", 300, 1));
    expect(names(orderedTracks(ws))).toEqual(["b", "c", "a"]);
  });

  it("puts a track made after the last reorder at the end, where a new track belongs", () => {
    const ws = workspace(track("a", 100, 1), track("b", 200, 0), track("new", 900));
    expect(names(orderedTracks(ws))).toEqual(["b", "a", "new"]);
  });

  it("leaves archived tracks out, the same as the unordered list", () => {
    const ws = workspace(track("a", 100, 1), track("gone", 200, 0, true));
    expect(names(orderedTracks(ws))).toEqual(["a"]);
    expect(names(visibleTracks(ws))).toEqual(["a"]);
  });
});

describe("reordering", () => {
  it("writes a position onto every track named, not only the ones that moved", () => {
    const ws = workspace(track("a", 100), track("b", 200), track("c", 300));
    const next = reorderTracks(ws.tracks, ["c", "a", "b"]);
    expect(next.c.meta.order).toBe(0);
    expect(next.a.meta.order).toBe(1);
    expect(next.b.meta.order).toBe(2);
    expect(names(orderedTracks({ ...ws, tracks: next }))).toEqual(["c", "a", "b"]);
  });

  it("leaves a track whose position is already right untouched, so nothing re-saves it", () => {
    const ws = workspace(track("a", 100, 0), track("b", 200, 1));
    const next = reorderTracks(ws.tracks, ["a", "b"]);
    expect(next.a).toBe(ws.tracks.a);
    expect(next.b).toBe(ws.tracks.b);
  });

  it("ignores ids it does not have, and leaves tracks it was not given alone", () => {
    const ws = workspace(track("a", 100, 5), track("b", 200, 6));
    const next = reorderTracks(ws.tracks, ["b", "ghost"]);
    expect(next.b.meta.order).toBe(0);
    expect(next.a.meta.order).toBe(5);
    expect(Object.keys(next).sort()).toEqual(["a", "b"]);
  });
});
