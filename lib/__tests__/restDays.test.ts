import { describe, it, expect } from "vitest";
import {
  bridges,
  fixedRest,
  isRestDate,
  isRestType,
  marksRestDay,
  restScheduleOf,
  restWeekdays,
  streakWithRest,
  trackStreak,
} from "../restDays";
import { setRestDay } from "../focusTypes";
import { setWeeklyRhythm } from "../trackActions";
import { streakStats } from "../stats";
import type { FocusType, TrackState, WeekDay } from "../types";

// Anchors. 2026-09-28 is a Monday, so the week runs Mon 28 … Sun 2026-10-04.
const MON = "2026-09-28";
const SAT = "2026-10-03";
const SUN = "2026-10-04";

const week = (restOn: string[]): WeekDay[] =>
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) =>
    restOn.includes(name)
      ? { name, type: "free", label: "Free" }
      : { name, type: "study", label: "Study" }
  );

const pool: Record<string, FocusType> = {
  study: { label: "Study", color: "#0ea5e9" },
  free: { label: "Free", color: "#a1a1aa" },
};

const track = (overrides: Partial<TrackState> = {}): TrackState =>
  ({
    meta: { id: "t1", name: "Track", color: "#0ea5e9", templateId: "custom", createdAt: 0 },
    currentPhase: 1,
    startDate: "2026-09-01",
    streakHistory: [],
    lastTasksResetDate: "",
    dailyTasks: {},
    dailyRevisionItems: {},
    phases: [],
    portfolio: [],
    materials: [],
    completedItemsHistory: {},
    weeklyCompletions: {},
    weekSchedule: week(["Sun"]),
    focusTypes: pool,
    ...overrides,
  }) as TrackState;

describe("which days are off", () => {
  it("reads the flag when a type carries one", () => {
    expect(isRestType("anything", { restDay: true })).toBe(true);
    expect(isRestType("free", { restDay: false })).toBe(false);
  });

  it("falls back to the two keys every template ships, for data that predates the flag", () => {
    expect(isRestType("free")).toBe(true);
    expect(isRestType("rest")).toBe(true);
    expect(isRestType("study")).toBe(false);
    // Not guessed from the label: a type nobody has marked is a working day.
    expect(isRestType("recovery", { label: "Recovery", color: "#fff" } as FocusType)).toBe(false);
  });

  it("collects the weekdays a track has off", () => {
    expect([...restWeekdays(track({ weekSchedule: week(["Sat", "Sun"]) }))].sort()).toEqual(["Sat", "Sun"]);
    expect(restWeekdays(track({ weekSchedule: week([]) })).size).toBe(0);
    expect(restWeekdays(null).size).toBe(0);
  });

  it("maps a date onto one", () => {
    const rest = new Set(["Sun"]);
    expect(isRestDate(SUN, rest)).toBe(true);
    expect(isRestDate(SAT, rest)).toBe(false);
    expect(isRestDate("", rest)).toBe(false);
  });

  it("lets a day off be turned back into a working day, and remembers it", () => {
    const next = setRestDay({ focusTypes: pool, weekSchedule: week(["Sun"]) }, "free", false);
    expect(next.focusTypes.free.restDay).toBe(false);
    expect(restWeekdays({ weekSchedule: next.weekSchedule, focusTypes: next.focusTypes }).size).toBe(0);
  });
});

describe("which days off get the mark", () => {
  const rest = new Set(["Sun"]);
  // Sundays either side of a Saturday "today".
  const LAST_SUNDAY = "2026-09-27";
  const NEXT_SUNDAY = "2026-10-04";

  it("marks a day off that has already happened", () => {
    expect(marksRestDay(LAST_SUNDAY, fixedRest(rest), SAT)).toBe(true);
  });

  it("does not mark one that has not", () => {
    // The whole point: a Sunday next week is not a day off, it is a day.
    expect(marksRestDay(NEXT_SUNDAY, fixedRest(rest), SAT)).toBe(false);
    expect(marksRestDay("2026-12-27", fixedRest(rest), SAT)).toBe(false);
  });

  it("marks today, when today is a day off", () => {
    expect(marksRestDay(SUN, fixedRest(rest), SUN)).toBe(true);
  });

  it("does not mark a day before the track existed", () => {
    // `streakCalendar` runs from the *week* a track began in, so up to six
    // real dates before the first day come back with a count of zero.
    expect(marksRestDay(LAST_SUNDAY, fixedRest(rest), SAT, "2026-09-28")).toBe(false);
    expect(marksRestDay(LAST_SUNDAY, fixedRest(rest), SAT, "2026-09-27")).toBe(true);
    expect(marksRestDay(LAST_SUNDAY, fixedRest(rest), SAT, "2026-01-01")).toBe(true);
  });

  it("is never true for a padding cell, or with no idea what day it is", () => {
    expect(marksRestDay("", fixedRest(rest), SAT)).toBe(false);
    expect(marksRestDay(LAST_SUNDAY, fixedRest(rest), "")).toBe(false);
  });

  it("still requires the weekday to be one the week has off", () => {
    expect(marksRestDay("2026-09-26", fixedRest(rest), SAT)).toBe(false); // a Saturday
    expect(marksRestDay(LAST_SUNDAY, fixedRest(new Set()), SAT)).toBe(false);
  });
});

describe("a streak across days off", () => {
  const rest = new Set(["Sun"]);

  it("is unbroken by a day the week has off", () => {
    // Worked Mon–Sat, Sunday off, and it is now Sunday.
    const history = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", SAT];
    expect(streakWithRest(history, SUN, fixedRest(rest))).toBe(6);
    // Without the rule it was six too — the anchor falls back to yesterday —
    // but one more day shows the difference.
    expect(streakWithRest(history, "2026-10-05", fixedRest(rest))).toBe(6);
    expect(streakWithRest(history, "2026-10-05", fixedRest(new Set()))).toBe(0);
  });

  it("does not count the day off as a day of work", () => {
    // Only Saturday worked, then a Sunday off, then Monday.
    expect(streakWithRest([SAT, "2026-10-05"], "2026-10-05", fixedRest(rest))).toBe(2);
  });

  it("still breaks on a working day that was missed", () => {
    // Friday worked, Saturday (a working day) missed, Sunday off.
    expect(streakWithRest(["2026-10-02"], "2026-10-05", fixedRest(rest))).toBe(0);
  });

  it("counts work recorded on a day off", () => {
    expect(streakWithRest([SAT, SUN], SUN, fixedRest(rest))).toBe(2);
  });

  it("terminates when every day of the week is off", () => {
    const every = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    // Nothing older than the first recorded day can extend a run, which is
    // what stops the walk rather than a day that was worked.
    expect(streakWithRest([MON], "2026-12-25", fixedRest(every))).toBe(1);
    expect(streakWithRest([], "2026-12-25", fixedRest(every))).toBe(0);
  });

  it("is what trackStreak reports for a track", () => {
    const history = ["2026-10-02", SAT];
    expect(trackStreak(track({ streakHistory: history }), "2026-10-05")).toBe(2);
    expect(trackStreak(track({ streakHistory: history, weekSchedule: week([]) }), "2026-10-05")).toBe(0);
    expect(trackStreak(null, "2026-10-05")).toBe(0);
  });
});

describe("consecutive, once days off are stepped over", () => {
  const rest = new Set(["Sun"]);

  it("is plain adjacency when there is no gap", () => {
    expect(bridges(SAT, SUN, fixedRest(rest))).toBe(true);
    expect(bridges(SAT, SAT, fixedRest(rest))).toBe(false);
  });

  it("joins two days separated only by days off", () => {
    expect(bridges(SAT, "2026-10-05", fixedRest(rest))).toBe(true);
    expect(bridges("2026-10-02", "2026-10-05", fixedRest(rest))).toBe(false);
  });

  it("does not walk gaps that cannot be bridged", () => {
    // A fortnight contains working days whatever else is in it.
    expect(bridges("2026-09-01", "2026-10-05", fixedRest(rest))).toBe(false);
    expect(bridges("2026-09-01", "2026-10-05", fixedRest(new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])))).toBe(true);
  });

  it("gives the longest run the same rule as the current one", () => {
    const history = ["2026-09-25", "2026-09-26", "2026-09-28"]; // Fri, Sat, Mon
    const resting = streakStats(track({ streakHistory: history, weekSchedule: week(["Sun"]) }), "2026-10-05");
    const working = streakStats(track({ streakHistory: history, weekSchedule: week([]) }), "2026-10-05");
    expect(resting.longest).toBe(3);
    expect(working.longest).toBe(2);
  });

  it("takes an override, for a view that combines several tracks", () => {
    const history = ["2026-09-25", "2026-09-26", "2026-09-28"];
    // The track rests on Sunday; the combined view says nobody does.
    const stats = streakStats(track({ streakHistory: history }), "2026-10-05", fixedRest(new Set()));
    expect(stats.longest).toBe(2);
  });
});

describe("changing the week does not rewrite the past", () => {
  // Thursdays. The week is changed on 2026-10-01, which is one of them.
  const BEFORE = "2026-09-24";
  const CHANGED_ON = "2026-10-01";
  const AFTER = "2026-10-08";

  const withLog = (log: { date: string; days: string[] }[]) =>
    track({ weekSchedule: week([]), restDaysFrom: log });

  it("keeps a day off that already happened when the day becomes a working day", () => {
    // Thursday was off until 1 October; from then it is a working day.
    const t = withLog([
      { date: "2026-01-01", days: ["Thu"] },
      { date: CHANGED_ON, days: [] },
    ]);
    const on = restScheduleOf(t);
    expect([...on(BEFORE)]).toEqual(["Thu"]);
    expect([...on(CHANGED_ON)]).toEqual([]);
    expect([...on(AFTER)]).toEqual([]);

    // Which is what the grid asks.
    expect(marksRestDay(BEFORE, on, AFTER, "2026-01-01")).toBe(true);
    expect(marksRestDay(AFTER, on, AFTER, "2026-01-01")).toBe(false);
  });

  it("and does not invent days off in the past when a day becomes a rest day", () => {
    const t = withLog([
      { date: "2026-01-01", days: [] },
      { date: CHANGED_ON, days: ["Thu"] },
    ]);
    const on = restScheduleOf(t);
    expect(marksRestDay(BEFORE, on, AFTER, "2026-01-01")).toBe(false);
    expect(marksRestDay(AFTER, on, AFTER, "2026-01-01")).toBe(true);
  });

  it("keeps the streak that those past days off were bridging", () => {
    // Worked every day except Thursdays, which were off until 1 October.
    const worked = [
      "2026-09-21", "2026-09-22", "2026-09-23", /* Thu off */ "2026-09-25",
      "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30",
    ];
    const t = withLog([
      { date: "2026-01-01", days: ["Thu"] },
      { date: CHANGED_ON, days: [] },
    ]);
    // The run survives the Thursday it was always meant to survive.
    expect(streakWithRest(worked, "2026-09-30", restScheduleOf(t))).toBe(9);
    // Read under the new week alone — which is what used to happen — it breaks.
    expect(streakWithRest(worked, "2026-09-30", fixedRest(new Set()))).toBe(6);
  });

  it("falls back to the week it has now when nothing was ever logged", () => {
    const on = restScheduleOf(track({ weekSchedule: week(["Sun"]) }));
    expect([...on("2020-01-01")]).toEqual(["Sun"]);
    expect([...on("2030-01-01")]).toEqual(["Sun"]);
  });

  it("reads a date before the first entry as the first entry", () => {
    const on = restScheduleOf(withLog([{ date: "2026-06-01", days: ["Sat"] }]));
    expect([...on("2026-01-01")]).toEqual(["Sat"]);
  });

  it("survives entries arriving out of order, as a merge can leave them", () => {
    const on = restScheduleOf(
      withLog([
        { date: CHANGED_ON, days: [] },
        { date: "2026-01-01", days: ["Thu"] },
      ])
    );
    expect([...on(BEFORE)]).toEqual(["Thu"]);
    expect([...on(AFTER)]).toEqual([]);
  });
});

describe("recording a change to the week", () => {
  const base = track({ weekSchedule: week(["Sun"]) });

  it("writes nothing until the days off actually change", () => {
    // A rename leaves the set alone.
    const renamed = setWeeklyRhythm(
      base,
      week(["Sun"]),
      { ...pool, study: { label: "Deep work", color: "#0ea5e9" } },
      "2026-10-01"
    );
    expect(renamed.restDaysFrom).toBeUndefined();
  });

  it("seeds the week as it was, from the track's start, on the first change", () => {
    const next = setWeeklyRhythm(base, week([]), pool, "2026-10-01");
    expect(next.restDaysFrom).toEqual([
      { date: base.startDate, days: ["Sun"] },
      { date: "2026-10-01", days: [] },
    ]);
  });

  it("appends later changes, and replaces one made the same day", () => {
    const once = setWeeklyRhythm(base, week([]), pool, "2026-10-01");
    const twice = setWeeklyRhythm(once, week(["Sat"]), pool, "2026-10-01");
    expect(twice.restDaysFrom).toEqual([
      { date: base.startDate, days: ["Sun"] },
      { date: "2026-10-01", days: ["Sat"] },
    ]);

    const later = setWeeklyRhythm(twice, week(["Sat", "Sun"]), pool, "2026-11-01");
    expect(later.restDaysFrom).toHaveLength(3);
    expect(later.restDaysFrom?.[2]).toEqual({ date: "2026-11-01", days: ["Sat", "Sun"] });
  });

  it("leaves the week itself exactly as asked", () => {
    const next = setWeeklyRhythm(base, week(["Mon"]), pool, "2026-10-01");
    expect(next.weekSchedule).toEqual(week(["Mon"]));
    expect(next.focusTypes).toEqual(pool);
  });
});
