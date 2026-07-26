import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  phaseStats,
  progressStats,
  streakCalendar,
  streakStats,
  timelineStats,
} from "../stats";
import type { Phase, TaskItem, TrackState } from "../types";

const phase = (id: number, recommendedByDay?: number, tasks: TaskItem[] = []): Phase => ({
  id,
  title: `Phase ${id}`,
  description: "",
  tasks,
  detailedInfo: { focus: "", deliverable: "", math: "" },
  ...(recommendedByDay === undefined ? {} : { recommendedByDay }),
});

const track = (overrides: Partial<TrackState> = {}): TrackState => ({
  meta: { id: "t1", name: "Track", color: "#0ea5e9", templateId: "custom", createdAt: 0 },
  currentPhase: 1,
  startDate: "2026-07-01",
  streakHistory: [],
  lastTasksResetDate: "",
  dailyTasks: {},
  dailyRevisionItems: {},
  phases: [phase(1, 90), phase(2, 180), phase(3, 365)],
  portfolio: [],
  materials: [],
  completedItemsHistory: {},
  weeklyCompletions: {},
  ...overrides,
});

// The stats read "today" off the clock (daysSince / dayForDate), so pin it.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-31T12:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("streakStats", () => {
  it("finds the longest run, not just the current one", () => {
    const stats = streakStats(
      track({
        // A 4-day run in the past, then a broken gap, then a live 2-day run.
        streakHistory: [
          "2026-07-10", "2026-07-11", "2026-07-12", "2026-07-13",
          "2026-07-30", "2026-07-31",
        ],
      }),
      "2026-07-31"
    );
    expect(stats.current).toBe(2);
    expect(stats.longest).toBe(4);
    expect(stats.activeDays).toBe(6);
  });

  it("counts only the last 30 days in activeLast30", () => {
    const stats = streakStats(
      track({ streakHistory: ["2026-05-01", "2026-07-20", "2026-07-31"] }),
      "2026-07-31"
    );
    expect(stats.activeLast30).toBe(2);
  });

  it("totals accomplishments across days and lists the most recent first", () => {
    const stats = streakStats(
      track({
        streakHistory: ["2026-07-29", "2026-07-31"],
        completedItemsHistory: {
          "2026-07-29": [{ title: "Ray tracer" }, "C++ Book"],
          "2026-07-31": [{ title: "Two Pointers" }],
        },
      }),
      "2026-07-31"
    );
    expect(stats.totalAccomplishments).toBe(3);
    expect(stats.recent[0]).toEqual({ date: "2026-07-31", titles: ["Two Pointers"] });
    expect(stats.recent[1].titles).toEqual(["Ray tracer", "C++ Book"]);
  });

  it("ignores duplicate dates in the history", () => {
    const stats = streakStats(
      track({ streakHistory: ["2026-07-31", "2026-07-31", "2026-07-30"] }),
      "2026-07-31"
    );
    expect(stats.activeDays).toBe(2);
    expect(stats.current).toBe(2);
  });
});

describe("streakCalendar", () => {
  it("starts on the Sunday before the track and pads to whole weeks", () => {
    // 2026-07-01 is a Wednesday, so the grid opens on Sunday 2026-06-28.
    const cells = streakCalendar(track(), "2026-07-31");
    expect(cells[0].date).toBe("2026-06-28");
    expect(cells.length % 7).toBe(0);
    // Every real day up to today is present; the rest is padding.
    expect(cells.filter((c) => c.date).at(-1)?.date).toBe("2026-07-31");
    expect(cells.filter((c) => !c.date).every((c) => c.count === 0)).toBe(true);
  });

  it("opens on the Monday before the track when weeks start on Monday", () => {
    // 2026-07-01 is a Wednesday: Sunday-first opens 06-28, Monday-first 06-29.
    const cells = streakCalendar(track(), "2026-07-31", "mon");
    expect(cells[0].date).toBe("2026-06-29");
    expect(cells.length % 7).toBe(0);
  });

  it("carries each day's accomplishment count", () => {
    const cells = streakCalendar(
      track({ completedItemsHistory: { "2026-07-04": ["a", "b", "c"] } }),
      "2026-07-31"
    );
    expect(cells.find((c) => c.date === "2026-07-04")?.count).toBe(3);
    expect(cells.find((c) => c.date === "2026-07-05")?.count).toBe(0);
  });
});

describe("timelineStats", () => {
  it("derives the horizon from the last phase threshold", () => {
    const stats = timelineStats(track());
    expect(stats.totalDays).toBe(365);
    expect(stats.daysPassed).toBe(31); // 1 July is day 1
    expect(stats.daysRemaining).toBe(334);
    expect(Math.round(stats.progressPct)).toBe(8);
  });

  it("gives each phase a window that starts the day after the previous one ends", () => {
    const stats = timelineStats(track());
    expect(stats.windows.map((w) => [w.startDay, w.endDay])).toEqual([
      [1, 90],
      [91, 180],
      [181, 365],
    ]);
    expect(stats.windows.map((w) => w.state)).toEqual(["current", "upcoming", "upcoming"]);
  });

  it("marks passed phases done", () => {
    const stats = timelineStats(track({ currentPhase: 3 }));
    expect(stats.windows.map((w) => w.state)).toEqual(["done", "done", "current"]);
  });

  it("leaves the window open for phases with no threshold", () => {
    const stats = timelineStats(track({ phases: [phase(1, 30), phase(2)] }));
    expect(stats.windows[1].endDay).toBeUndefined();
    expect(stats.windows[1].endDate).toBeUndefined();
  });
});

describe("phaseStats", () => {
  it("counts days within the phase, not the track", () => {
    const stats = phaseStats(track({ currentPhaseStartDate: "2026-07-25" }), "2026-07-31");
    expect(stats.dayInPhase).toBe(7);
  });

  it("reports task progress and the days left in the window", () => {
    const stats = phaseStats(
      track({
        phases: [
          phase(1, 90, [
            { id: "t1", title: "One", completed: true },
            { id: "t2", title: "Two", completed: false },
          ]),
        ],
      }),
      "2026-07-31"
    );
    expect(stats.tasksDone).toBe(1);
    expect(stats.tasksTotal).toBe(2);
    expect(stats.daysLeft).toBe(59); // day 31 of a window ending on day 90
    expect(stats.phaseLength).toBe(90);
  });

  it("flags how many phases behind the schedule says you are", () => {
    // Day 31 of a track whose phase 1 was due by day 10.
    const behind = phaseStats(track({ phases: [phase(1, 10), phase(2, 40)] }), "2026-07-31");
    expect(behind.behindBy).toBe(1);
    expect(behind.recommendedPhase?.id).toBe(2);

    const onTrack = phaseStats(track(), "2026-07-31");
    expect(onTrack.behindBy).toBe(0);
  });

  it("returns a null phase for a track with none", () => {
    expect(phaseStats(track({ phases: [] }), "2026-07-31").phase).toBeNull();
  });
});

describe("progressStats", () => {
  it("averages only the dimensions that hold items", () => {
    const stats = progressStats(
      track({
        currentPhase: 2, // one phase behind it is done
        phases: [
          phase(1, 90, [{ id: "t1", title: "One", completed: true }]),
          phase(2, 180, [{ id: "t2", title: "Two", completed: false }]),
        ],
        portfolio: [],
        materials: [],
      })
    );
    // Phases 1/2 = 50%, tasks 1/2 = 50%; empty portfolio and materials sit out.
    expect(Math.round(stats.workPct)).toBe(50);
    expect(stats.breakdown.find((b) => b.label === "Deliverables")?.total).toBe(0);
  });

  it("counts only materials explicitly marked completed", () => {
    const stats = progressStats(
      track({
        materials: [
          { id: "m1", title: "A", category: "", type: "", status: "Completed", currentPage: 0, totalPages: 0, currentSubject: "", link: "" },
          { id: "m2", title: "B", category: "", type: "", status: "In Progress", currentPage: 0, totalPages: 0, currentSubject: "", link: "" },
        ],
      })
    );
    expect(stats.breakdown.find((b) => b.label === "Materials")).toMatchObject({ done: 1, total: 2 });
  });

  it("reads pace as work done minus time spent", () => {
    const stats = progressStats(track({ portfolio: [{ id: "p1", title: "X", completed: true }] }));
    expect(stats.paceDelta).toBeCloseTo(stats.workPct - stats.timePct);
    expect(stats.paceDelta).toBeGreaterThan(0); // 100% of the only work, 8% of the time
  });
});
