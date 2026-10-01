import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  masterCalendar,
  masterDeliverables,
  masterHistory,
  masterMaterials,
  masterMonths,
  masterPhases,
  masterProgress,
  masterRestWeekdays,
  masterRoadmaps,
  masterSources,
  masterStart,
  masterStreak,
  masterWeek,
} from "../masterTrack";
import type { CompletedItem, Phase, TrackState, WeekDay } from "../types";

const TODAY = "2026-10-01"; // a Thursday

const phase = (id: number, title: string, recommendedByDay?: number): Phase => ({
  id,
  title,
  description: "",
  tasks: [],
  detailedInfo: { focus: "", deliverable: "", math: "" },
  ...(recommendedByDay === undefined ? {} : { recommendedByDay }),
});

const week = (restOn: string[] = []): WeekDay[] =>
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) =>
    restOn.includes(name)
      ? { name, type: "free", label: "Free" }
      : { name, type: "study", label: "Study" }
  );

const track = (overrides: Partial<TrackState> & { id: string; color: string }): TrackState => {
  const { id, color, ...rest } = overrides;
  return {
    meta: { id, name: id, color, templateId: "custom", createdAt: 0 },
    currentPhase: 1,
    startDate: "2026-01-01",
    streakHistory: [],
    lastTasksResetDate: "",
    dailyTasks: {},
    dailyRevisionItems: {},
    phases: [phase(1, "One", 90)],
    portfolio: [],
    materials: [],
    completedItemsHistory: {},
    weeklyCompletions: {},
    weekSchedule: week(),
    focusTypes: { study: { label: "Study", color: "#fff" }, free: { label: "Free", color: "#999" } },
    ...rest,
  } as TrackState;
};

const history = (entries: Record<string, number>): Record<string, CompletedItem[]> =>
  Object.fromEntries(
    Object.entries(entries).map(([date, n]) => [date, Array.from({ length: n }, (_, i) => `item ${i}`)])
  );

// timelineStats and progressStats read the clock through daysSince.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});
afterEach(() => vi.useRealTimers());

describe("which tracks it is built from", () => {
  const a = track({ id: "a", color: "#0ea5e9" });
  const b = track({ id: "b", color: "#f59e0b" });

  it("is everything, minus whatever has been switched off", () => {
    expect(masterSources([a, b], []).map((t) => t.meta.id)).toEqual(["a", "b"]);
    expect(masterSources([a, b], ["a"]).map((t) => t.meta.id)).toEqual(["b"]);
  });

  it("keeps a track the exclusion list has never heard of, so a new one is in by default", () => {
    expect(masterSources([a, b], ["gone"]).map((t) => t.meta.id)).toEqual(["a", "b"]);
  });

  it("takes the earliest start of all of them", () => {
    expect(masterStart([track({ id: "a", color: "#000", startDate: "2026-04-01" }), track({ id: "b", color: "#111", startDate: "2026-02-01" })])).toBe("2026-02-01");
    expect(masterStart([])).toBe("");
  });
});

describe("the days, across tracks", () => {
  const a = track({
    id: "a",
    color: "#0ea5e9",
    startDate: "2026-09-01",
    completedItemsHistory: history({ "2026-09-28": 2, "2026-09-30": 1 }),
  });
  const b = track({
    id: "b",
    color: "#f59e0b",
    startDate: "2026-09-25",
    completedItemsHistory: history({ "2026-09-28": 3, "2026-09-29": 1 }),
  });

  it("gives a day one part per track that did something, and the total", () => {
    const days = masterCalendar([a, b], 2026, TODAY);
    const shared = days.find((d) => d.date === "2026-09-28")!;
    expect(shared.count).toBe(5);
    expect(shared.parts.map((p) => [p.trackId, p.count])).toEqual([
      ["a", 2],
      ["b", 3],
    ]);

    const only = days.find((d) => d.date === "2026-09-30")!;
    expect(only.parts.map((p) => p.trackId)).toEqual(["a"]);
  });

  it("leaves a day with nothing on it empty rather than listing silent tracks", () => {
    const quiet = masterCalendar([a, b], 2026, TODAY).find((d) => d.date === "2026-09-27")!;
    expect(quiet.count).toBe(0);
    expect(quiet.parts).toEqual([]);
  });

  it("does not count a track against days before it existed", () => {
    // 2026-09-10 is inside a's life and before b's. Neither did anything, but
    // the point is that b is not even a candidate.
    const days = masterCalendar([a, b], 2026, TODAY);
    const before = days.find((d) => d.date === "2026-09-10")!;
    expect(before.parts).toEqual([]);
  });

  it("hangs every row on the same calendar, so a month's cells line up", () => {
    const one = masterCalendar([a], 2026, TODAY);
    const both = masterCalendar([a, b], 2026, TODAY);
    expect(one.length).toBe(both.length);
  });

  it("breaks the same year into months", () => {
    const months = masterMonths([a, b], 2026, TODAY);
    expect(months.map((m) => m.label)).toEqual(["Sep 2026", "Oct 2026"]);
    const sept = months[0];
    // A September block starts on the weekday the 1st fell on, so the leading
    // cells are nulls rather than days.
    expect(sept.cells.filter((c) => c === null).length).toBeGreaterThan(0);
    expect(sept.cells.find((c) => c?.date === "2026-09-28")?.count).toBe(5);
  });
});

describe("the run of days", () => {
  it("counts a day on which any track did something", () => {
    const a = track({ id: "a", color: "#000", startDate: "2026-09-01", completedItemsHistory: history({ "2026-09-29": 1, "2026-10-01": 1 }) });
    const b = track({ id: "b", color: "#111", startDate: "2026-09-01", completedItemsHistory: history({ "2026-09-30": 1 }) });
    expect(masterHistory([a, b])).toEqual(["2026-09-29", "2026-09-30", "2026-10-01"]);
    expect(masterStreak([a, b], TODAY).current).toBe(3);
    // On its own, a has a gap on the 30th.
    expect(masterStreak([a], TODAY).current).toBe(1);
  });

  it("only excuses a day both tracks have off", () => {
    const a = track({ id: "a", color: "#000", weekSchedule: week(["Sun"]) });
    const b = track({ id: "b", color: "#111", weekSchedule: week(["Sun", "Sat"]) });
    expect([...masterRestWeekdays([a, b])]).toEqual(["Sun"]);
    expect(masterRestWeekdays([]).size).toBe(0);
  });

  it("adds up every accomplishment, not just the days they fell on", () => {
    const a = track({ id: "a", color: "#000", completedItemsHistory: history({ "2026-09-29": 3 }) });
    const b = track({ id: "b", color: "#111", completedItemsHistory: history({ "2026-09-29": 2 }) });
    const stats = masterStreak([a, b], TODAY);
    expect(stats.totalAccomplishments).toBe(5);
    expect(stats.activeDays).toBe(1);
  });
});

describe("how far along all of it is", () => {
  it("weights each track by how long it is, not by how many there are", () => {
    // One long track barely started, one short one nearly done. A plain mean
    // would call that half-way; weighted by length it is nothing like it.
    const long = track({ id: "long", color: "#000", startDate: "2026-09-01", phases: [phase(1, "One", 1000)] });
    const short = track({ id: "short", color: "#111", startDate: "2026-09-01", phases: [phase(1, "One", 40)] });
    const weighted = masterProgress([long, short]);
    const plain = (masterProgress([long]).timePct + masterProgress([short]).timePct) / 2;
    expect(weighted.timePct).toBeLessThan(plain);
    expect(weighted.totalDays).toBe(1040);
    expect(weighted.count).toBe(2);
  });

  it("is nothing at all with nothing selected", () => {
    expect(masterProgress([])).toEqual({ timePct: 0, workPct: 0, paceDelta: 0, totalDays: 0, count: 0 });
  });
});

describe("the phases of every track, on one timeline", () => {
  it("is ordered by when a phase opens, not by which track it belongs to", () => {
    const a = track({ id: "a", color: "#000", startDate: "2026-01-01", phases: [phase(1, "A1", 60), phase(2, "A2", 200)] });
    const b = track({ id: "b", color: "#111", startDate: "2026-03-01", phases: [phase(1, "B1", 90)] });
    const windows = masterPhases([a, b]);
    // a's second phase opens on day 61 — 2 March — which is after b's first,
    // so the two tracks interleave. That is the whole point of the ordering.
    expect(windows.map((w) => `${w.track.id}:${w.phase.title}`)).toEqual(["a:A1", "b:B1", "a:A2"]);
    expect(windows.map((w) => w.startDate.getTime())).toEqual([...windows.map((w) => w.startDate.getTime())].sort((x, y) => x - y));
  });

  it("says which one each track is actually on", () => {
    const a = track({ id: "a", color: "#000", currentPhase: 2, phases: [phase(1, "A1", 60), phase(2, "A2", 200)] });
    expect(masterPhases([a]).map((w) => w.state)).toEqual(["done", "current"]);
  });
});

describe("the week, across tracks", () => {
  it("asks each track what its own week number is", () => {
    // Two tracks whose rotations are the same list but whose starts differ by
    // a week, so the same weekday lands on different items.
    const items = [{ title: "First" }, { title: "Second" }];
    const a = track({
      id: "a",
      color: "#000",
      startDate: "2026-01-05",
      rotations: [{ id: "r", label: "Topic", items, daysOfWeek: ["Thu"], target: "revision", startWeek: 1 }],
    });
    const b = track({
      id: "b",
      color: "#111",
      startDate: "2026-01-12",
      rotations: [{ id: "r", label: "Topic", items, daysOfWeek: ["Thu"], target: "revision", startWeek: 1 }],
    });
    const thursday = masterWeek([a, b], 0).find((d) => d.name === "Thu")!;
    expect(thursday.entries).toHaveLength(2);
    expect(thursday.entries[0].rotations[0].label).toBe("Topic");
    // One week apart in start date means one step apart in the cycle.
    expect(thursday.entries[0].rotations[0].title).not.toBe(thursday.entries[1].rotations[0].title);
  });

  it("carries what each track calls the day, and whether it has it off", () => {
    const a = track({ id: "a", color: "#000", weekSchedule: week(["Sun"]) });
    const sunday = masterWeek([a], 0).find((d) => d.name === "Sun")!;
    expect(sunday.entries[0].label).toBe("Free");
    expect(sunday.entries[0].rest).toBe(true);
    const monday = masterWeek([a], 0).find((d) => d.name === "Mon")!;
    expect(monday.entries[0].rest).toBe(false);
  });

  it("gives every day a real date, so the week can be stepped through", () => {
    const days = masterWeek([track({ id: "a", color: "#000" })], 0);
    expect(days).toHaveLength(7);
    expect(days.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))).toBe(true);
    const next = masterWeek([track({ id: "a", color: "#000" })], 1);
    expect(next[0].date > days[0].date).toBe(true);
  });
});

describe("the lists", () => {
  const a = track({
    id: "a",
    color: "#0ea5e9",
    portfolio: [
      { id: "p1", title: "Done thing", completed: true },
      { id: "p2", title: "Open thing", completed: false },
    ],
    materials: [
      { id: "m1", title: "A book", category: "", type: "", status: "Reading", currentPage: 0, totalPages: 0, currentSubject: "", link: "" },
      { id: "m2", title: "Archived", category: "", type: "", status: "Reading", currentPage: 0, totalPages: 0, currentSubject: "", link: "", archived: true },
    ],
    roadmapContent: "# A's plan",
  });
  const b = track({
    id: "b",
    color: "#f59e0b",
    portfolio: [{ id: "p3", title: "B thing", completed: false }],
    roadmapContent: "   ",
  });

  it("puts what is still open first, and says which track each belongs to", () => {
    const rows = masterDeliverables([a, b]);
    expect(rows.map((r) => r.item.title)).toEqual(["Open thing", "B thing", "Done thing"]);
    expect(rows[0].track.id).toBe("a");
  });

  it("leaves archived materials out, the same as a track's own panel", () => {
    expect(masterMaterials([a, b]).map((r) => r.item.id)).toEqual(["m1"]);
  });

  it("only collects roadmaps with something written in them", () => {
    expect(masterRoadmaps([a, b]).map((r) => r.track.id)).toEqual(["a"]);
  });
});
