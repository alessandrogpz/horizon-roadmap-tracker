import { describe, it, expect } from "vitest";
import { applyDailyResetIfNeeded } from "../dailyReset";
import { getWeekNum, todayYMD, formatDateYMD } from "../dates";
import type { RotationDef, TrackState } from "../types";

const TODAY = todayYMD();
const yesterday = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDateYMD(d);
})();

const baseTrack = (overrides: Partial<TrackState> = {}): TrackState => ({
  meta: { id: "t1", name: "Track", color: "#0ea5e9", templateId: "custom", createdAt: Date.now() },
  currentPhase: 1,
  startDate: "2026-01-05",
  streakHistory: [],
  lastDailyRoutineCheck: "",
  lastTasksResetDate: "",
  dailyFocus: {},
  dailyTasks: {},
  dailyRevisionItems: {},
  phases: [
    {
      id: 1,
      title: "Phase 1",
      description: "d",
      tasks: [{ id: "task1", title: "Task", completed: true }],
      detailedInfo: { focus: "", deliverable: "", math: "" },
    },
  ],
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

describe("applyDailyResetIfNeeded gating", () => {
  it("does nothing for an unsynced track", () => {
    const track = baseTrack({ isSynced: false, lastTasksResetDate: yesterday });
    const { changed, data } = applyDailyResetIfNeeded(track, TODAY);
    expect(changed).toBe(false);
    expect(data).toBe(track);
  });

  it("does nothing if already reset today", () => {
    const track = baseTrack({ lastTasksResetDate: TODAY });
    const { changed, data } = applyDailyResetIfNeeded(track, TODAY);
    expect(changed).toBe(false);
    expect(data).toBe(track);
  });
});

describe("applyDailyResetIfNeeded — task/phase resets", () => {
  it("resets all phase task completion to false", () => {
    const track = baseTrack({ lastTasksResetDate: yesterday });
    const { data } = applyDailyResetIfNeeded(track, TODAY);
    expect(data.phases[0].tasks[0].completed).toBe(false);
  });

  it("resets dailyTasks and dailyRevisionItems completion flags to false", () => {
    const track = baseTrack({
      lastTasksResetDate: yesterday,
      dailyTasks: { Mon: [{ id: "task_1", title: "Manual task", completed: true }] },
      dailyRevisionItems: { Mon: [{ id: "rev_1", title: "Manual revision", completed: true }] },
    });
    const { data } = applyDailyResetIfNeeded(track, TODAY);
    expect(data.dailyTasks.Mon[0].completed).toBe(false);
    expect(data.dailyRevisionItems.Mon[0].completed).toBe(false);
  });

  it("sets lastTasksResetDate to the given date and reports changed:true", () => {
    const track = baseTrack({ lastTasksResetDate: yesterday });
    const { data, changed } = applyDailyResetIfNeeded(track, TODAY);
    expect(changed).toBe(true);
    expect(data.lastTasksResetDate).toBe(TODAY);
  });

  it("snapshots the previous day's completed item ids into weeklyCompletions", () => {
    const prevDayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(yesterday + "T00:00:00").getDay()];
    const track = baseTrack({
      lastTasksResetDate: yesterday,
      dailyTasks: { [prevDayName]: [{ id: "task_done", title: "Done", completed: true }, { id: "task_open", title: "Open", completed: false }] },
      dailyRevisionItems: { [prevDayName]: [{ id: "rev_done", title: "Done rev", completed: true }] },
    });
    const { data } = applyDailyResetIfNeeded(track, TODAY);
    expect(data.weeklyCompletions[yesterday].tasks).toEqual(["task_done"]);
    expect(data.weeklyCompletions[yesterday].revisions).toEqual(["rev_done"]);
  });
});

describe("applyDailyResetIfNeeded — rotations", () => {
  const patternRotation: RotationDef = {
    id: "algo",
    label: "Weekly Algorithm",
    items: [{ title: "Hash Maps" }, { title: "Two Pointers" }, { title: "Sliding Window" }],
    daysOfWeek: ["Mon", "Wed", "Fri"],
    target: "revision",
    startWeek: 1,
  };

  const readingRotation: RotationDef = {
    id: "reading",
    label: "Weekly Reading",
    items: [{ title: "Tolkien" }, { title: "Asimov" }],
    daysOfWeek: ["Tue", "Thu"],
    target: "focus",
    startWeek: 1,
  };

  it("writes each rotation's current item onto its configured days only", () => {
    const track = baseTrack({ lastTasksResetDate: yesterday, rotations: [patternRotation, readingRotation] });
    const weekNum = getWeekNum(track.startDate);
    const len = patternRotation.items.length;
    const idx = ((weekNum - patternRotation.startWeek) % len + len) % len;
    const expectedPattern = patternRotation.items[idx].title;

    const { data } = applyDailyResetIfNeeded(track, TODAY);

    expect(data.dailyRevisionItems.Mon.map((it) => it.title)).toContain(expectedPattern);
    expect(data.dailyRevisionItems.Wed.map((it) => it.title)).toContain(expectedPattern);
    expect(data.dailyRevisionItems.Fri.map((it) => it.title)).toContain(expectedPattern);
    // Not a pattern day — no revision rotation item.
    expect(data.dailyRevisionItems.Tue?.some((it) => it.id.startsWith("rotation_"))).toBeFalsy();

    const readingLen = readingRotation.items.length;
    const readingIdx = ((weekNum - readingRotation.startWeek) % readingLen + readingLen) % readingLen;
    expect(data.dailyTasks.Tue.map((t) => t.title)).toContain(readingRotation.items[readingIdx].title);
    expect(data.dailyTasks.Thu.map((t) => t.title)).toContain(readingRotation.items[readingIdx].title);
    // Focus rotation shouldn't touch revision items, and vice versa.
    expect(data.dailyTasks.Mon || []).toHaveLength(0);
  });

  it("preserves manually-added items alongside rotation-generated ones", () => {
    const track = baseTrack({
      lastTasksResetDate: yesterday,
      rotations: [patternRotation],
      dailyRevisionItems: { Mon: [{ id: "rev_manual", title: "My own topic", completed: false }] },
    });
    const { data } = applyDailyResetIfNeeded(track, TODAY);
    const titles = data.dailyRevisionItems.Mon.map((it) => it.title);
    expect(titles).toContain("My own topic");
    expect(titles.length).toBe(2); // one rotation item + one manual item
  });

  it("supersedes a stale item left by the pre-multi-rotation id scheme (dsa_auto)", () => {
    const track = baseTrack({
      lastTasksResetDate: yesterday,
      rotations: [patternRotation],
      dailyRevisionItems: { Mon: [{ id: "dsa_auto", title: "Old Pattern Name", completed: false }] },
    });
    const { data } = applyDailyResetIfNeeded(track, TODAY);
    const titles = data.dailyRevisionItems.Mon.map((it) => it.title);
    expect(titles).not.toContain("Old Pattern Name");
    expect(titles.length).toBe(1);
  });

  it("does not touch dailyTasks/dailyRevisionItems rotation logic when there are no rotations", () => {
    const track = baseTrack({
      lastTasksResetDate: yesterday,
      dailyRevisionItems: { Mon: [{ id: "rev_manual", title: "Untouched", completed: true }] },
    });
    const { data } = applyDailyResetIfNeeded(track, TODAY);
    expect(data.dailyRevisionItems.Mon).toEqual([{ id: "rev_manual", title: "Untouched", completed: false }]);
  });

  it("advances rotation items to a new pattern on the following week's reset", () => {
    const weekNum = getWeekNum("2026-01-05");
    const len = patternRotation.items.length;
    const thisWeekIdx = ((weekNum - 1) % len + len) % len;
    const nextWeekIdx = ((weekNum) % len + len) % len;

    // Only meaningful when the two indices actually differ (i.e. not a
    // coincidental multiple of the cycle length apart).
    if (thisWeekIdx === nextWeekIdx) return;

    const shiftedRotation: RotationDef = { ...patternRotation, startWeek: patternRotation.startWeek - 1 };
    const track = baseTrack({ lastTasksResetDate: yesterday, rotations: [shiftedRotation] });
    const { data } = applyDailyResetIfNeeded(track, TODAY);
    expect(data.dailyRevisionItems.Mon[0].title).toBe(patternRotation.items[nextWeekIdx].title);
  });
});
