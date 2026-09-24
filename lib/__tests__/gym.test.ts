import { describe, expect, it } from "vitest";
import {
  addExercise,
  addSet,
  addToPlan,
  emptyGymLog,
  focusOfDay,
  gymNoteId,
  lastTime,
  parseGymLog,
  plannedFor,
  removeFromPlan,
  removeSet,
  serializeGymLog,
  setCountOf,
  sessionFor,
  volumeOf,
  type GymLog,
} from "../gym";

const log = (): GymLog => {
  let l = emptyGymLog();
  l = addToPlan(l, "push", "Bench press");
  l = addExercise(l, "2026-09-21", "Bench press");
  const id = l.sessions["2026-09-21"].exercises[0].id;
  l = addSet(l, "2026-09-21", id, { reps: 8, weight: 60 });
  l = addSet(l, "2026-09-21", id, { reps: 6, weight: 70 });
  return l;
};

describe("parseGymLog", () => {
  it("round-trips through a note's text", () => {
    const parsed = parseGymLog(serializeGymLog(log()));
    expect(parsed.plans.push).toEqual(["Bench press"]);
    expect(parsed.sessions["2026-09-21"].exercises[0].name).toBe("Bench press");
    expect(parsed.sessions["2026-09-21"].exercises[0].sets).toHaveLength(2);
  });

  // A note is a string anything could have written, and a log that throws
  // would take the panel down with it.
  it("returns an empty log rather than throwing on rubbish", () => {
    expect(parseGymLog("not json").sessions).toEqual({});
    expect(parseGymLog("").sessions).toEqual({});
    expect(parseGymLog(null).sessions).toEqual({});
    expect(parseGymLog("[1,2,3]").sessions).toEqual({});
  });

  it("drops malformed pieces and keeps the rest", () => {
    const raw = JSON.stringify({
      version: 1,
      plans: { push: ["Bench press", 42, "  "], pull: "not a list" },
      sessions: {
        "2026-09-21": {
          exercises: [
            { id: "a", name: "Squat", sets: [{ reps: 5, weight: 100 }, { reps: "many" }] },
            { id: "b", sets: [] },
          ],
        },
      },
    });
    const parsed = parseGymLog(raw);
    expect(parsed.plans.push).toEqual(["Bench press"]);
    expect(parsed.plans.pull).toBeUndefined();
    // The nameless exercise goes; the bad set goes; the good set stays.
    expect(parsed.sessions["2026-09-21"].exercises).toHaveLength(1);
    expect(parsed.sessions["2026-09-21"].exercises[0].sets).toEqual([{ reps: 5, weight: 100 }]);
  });
});

describe("focusOfDay", () => {
  // The track's own rhythm is the single answer to "what is Monday for"; the
  // gym reads it rather than keeping a second copy that could disagree.
  const week = [
    { name: "Mon", type: "push", label: "Push" },
    { name: "Tue", type: "rest", label: "Rest" },
  ];

  it("reads the kind of day out of the week schedule", () => {
    expect(focusOfDay(week, "Mon")).toEqual({ key: "push", label: "Push" });
  });

  it("is null for a day the rhythm says nothing about", () => {
    expect(focusOfDay(week, "Sat")).toBeNull();
    expect(focusOfDay(undefined, "Mon")).toBeNull();
  });
});

describe("the plan", () => {
  it("lists what a kind of day asks for", () => {
    expect(plannedFor(log(), "push")).toEqual(["Bench press"]);
    expect(plannedFor(log(), "legs")).toEqual([]);
    expect(plannedFor(log(), undefined)).toEqual([]);
  });

  it("refuses the same exercise twice, whatever the case", () => {
    const l = addToPlan(addToPlan(emptyGymLog(), "push", "Bench press"), "push", "bench PRESS");
    expect(plannedFor(l, "push")).toEqual(["Bench press"]);
  });

  it("removes by name", () => {
    expect(plannedFor(removeFromPlan(log(), "push", "Bench press"), "push")).toEqual([]);
  });
});

describe("a session's numbers", () => {
  it("counts sets and total load", () => {
    const session = sessionFor(log(), "2026-09-21");
    expect(setCountOf(session)).toBe(2);
    // 8×60 + 6×70 = 900
    expect(volumeOf(session)).toBe(900);
  });

  it("treats bodyweight sets as real sets with no load", () => {
    let l = addExercise(emptyGymLog(), "2026-09-21", "Pull-up");
    const id = l.sessions["2026-09-21"].exercises[0].id;
    l = addSet(l, "2026-09-21", id, { reps: 10 });
    const session = sessionFor(l, "2026-09-21");
    expect(setCountOf(session)).toBe(1);
    expect(volumeOf(session)).toBe(0);
  });

  it("removes a set by position", () => {
    const l = log();
    const id = l.sessions["2026-09-21"].exercises[0].id;
    const after = removeSet(l, "2026-09-21", id, 0);
    expect(after.sessions["2026-09-21"].exercises[0].sets).toEqual([{ reps: 6, weight: 70 }]);
  });
});

describe("lastTime", () => {
  it("finds the most recent earlier session for an exercise", () => {
    let l = log();
    l = addExercise(l, "2026-09-14", "Bench press");
    const older = l.sessions["2026-09-14"].exercises[0].id;
    l = addSet(l, "2026-09-14", older, { reps: 10, weight: 50 });

    const found = lastTime(l, "bench press", "2026-09-28");
    expect(found?.date).toBe("2026-09-21");
    expect(found?.sets).toHaveLength(2);
  });

  it("ignores the day being logged and anything after it", () => {
    expect(lastTime(log(), "Bench press", "2026-09-21")).toBeNull();
  });

  it("ignores an exercise with no sets recorded", () => {
    const l = addExercise(emptyGymLog(), "2026-09-01", "Deadlift");
    expect(lastTime(l, "Deadlift", "2026-09-28")).toBeNull();
  });
});

describe("gymNoteId", () => {
  it("makes an id the server's note pattern accepts", () => {
    const id = gymNoteId("track_987e17f1-c0cf-47ee-b068-bb1ddd11c586");
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,200}$/);
  });
});
