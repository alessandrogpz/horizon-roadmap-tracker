import { describe, expect, it } from "vitest";
import {
  DEFAULT_REPS,
  DEFAULT_SETS,
  addExercise,
  addSet,
  addToPlan,
  addWorkout,
  addWorkoutExercise,
  addWorkoutSet,
  clearSession,
  doneCountOf,
  emptyGymLog,
  focusOfDay,
  gymNoteId,
  lastTime,
  parseGymLog,
  planComplete,
  plannedFor,
  removeFromPlan,
  removeSet,
  removeWorkout,
  renameExercise,
  resetWorkout,
  serializeGymLog,
  sessionFor,
  setCountOf,
  setsInWorkout,
  type GymLog,
  updatePlanItem,
  updateSet,
  updateWorkoutSet,
  volumeOf,
  workoutById,
  workoutsOf,
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
    expect(parsed.plans.push).toEqual([{ name: "Bench press", sets: DEFAULT_SETS, reps: DEFAULT_REPS }]);
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
      plans: {
        push: ["Bench press", 42, "  ", { name: "Squat", sets: 5, reps: 5 }],
        pull: "not a list",
      },
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
    // A bare string is how plans were stored before sets and reps existed, so
    // it is upgraded rather than dropped; rubbish still goes.
    expect(parsed.plans.push).toEqual([
      { name: "Bench press", sets: DEFAULT_SETS, reps: DEFAULT_REPS },
      { name: "Squat", sets: 5, reps: 5 },
    ]);
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
  it("lists what a kind of day asks for, with its numbers", () => {
    expect(plannedFor(log(), "push")).toEqual([
      { name: "Bench press", sets: DEFAULT_SETS, reps: DEFAULT_REPS },
    ]);
    expect(plannedFor(log(), "legs")).toEqual([]);
    expect(plannedFor(log(), undefined)).toEqual([]);
  });

  it("changes one line's numbers without moving it", () => {
    let l = addToPlan(log(), "push", "Overhead press");
    l = updatePlanItem(l, "push", "Bench press", { sets: 5, reps: 5 });
    expect(plannedFor(l, "push")).toEqual([
      { name: "Bench press", sets: 5, reps: 5 },
      { name: "Overhead press", sets: DEFAULT_SETS, reps: DEFAULT_REPS },
    ]);
  });

  it("refuses the same exercise twice, whatever the case", () => {
    const l = addToPlan(addToPlan(emptyGymLog(), "push", "Bench press"), "push", "bench PRESS");
    expect(plannedFor(l, "push")).toHaveLength(1);
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

describe("planComplete", () => {
  // What the week's tick is made of: every planned exercise has at least the
  // sets it asked for.
  it("is false until every planned exercise has its sets", () => {
    let l = addToPlan(emptyGymLog(), "push", "Bench press", 2, 10);
    l = addExercise(l, "2026-09-21", "Bench press");
    const id = l.sessions["2026-09-21"].exercises[0].id;

    l = addSet(l, "2026-09-21", id, { reps: 10 });
    expect(planComplete(l, "push", "2026-09-21")).toBe(false);

    l = addSet(l, "2026-09-21", id, { reps: 10 });
    expect(planComplete(l, "push", "2026-09-21")).toBe(true);
  });

  it("is false when there is no plan to complete", () => {
    expect(planComplete(emptyGymLog(), "push", "2026-09-21")).toBe(false);
    expect(planComplete(emptyGymLog(), undefined, "2026-09-21")).toBe(false);
  });

  it("does not care about extra sets or extra exercises", () => {
    let l = addToPlan(emptyGymLog(), "push", "Bench press", 1, 10);
    l = addExercise(l, "2026-09-21", "Bench press");
    const id = l.sessions["2026-09-21"].exercises[0].id;
    l = addSet(l, "2026-09-21", id, { reps: 10 });
    l = addSet(l, "2026-09-21", id, { reps: 10 });
    l = addExercise(l, "2026-09-21", "Something unplanned");
    expect(planComplete(l, "push", "2026-09-21")).toBe(true);
  });
});

describe("a session survives being written and read back", () => {
  it("keeps which sets were ticked", () => {
    let log = addExercise(emptyGymLog(), "2026-09-25", "Squat");
    const id = sessionFor(log, "2026-09-25").exercises[0].id;
    log = addSet(log, "2026-09-25", id, { reps: 5, weight: 40, done: true });
    log = addSet(log, "2026-09-25", id, { reps: 5, weight: 60, done: false });

    // The whole round trip: this is how the log reaches the next launch.
    const reloaded = parseGymLog(serializeGymLog(log));
    expect(sessionFor(reloaded, "2026-09-25").exercises[0].sets).toEqual([
      { reps: 5, weight: 40, done: true },
      { reps: 5, weight: 60, done: false },
    ]);
    expect(doneCountOf(sessionFor(reloaded, "2026-09-25"))).toBe(1);
  });

  it("leaves a set recorded before ticking existed unflagged", () => {
    const older = JSON.stringify({
      version: 1,
      plans: {},
      sessions: { "2026-09-01": { exercises: [{ id: "e1", name: "Bench", sets: [{ reps: 5, weight: 60 }] }] } },
    });
    const set = sessionFor(parseGymLog(older), "2026-09-01").exercises[0].sets[0];
    expect(set.done).toBeUndefined();
    // And so it still counts, rather than vanishing from the history.
    expect(volumeOf(sessionFor(parseGymLog(older), "2026-09-01"))).toBe(300);
  });
});

describe("logging a session set by set", () => {
  const day = "2026-09-25";

  const withSquat = () => {
    let log = addExercise(emptyGymLog(), day, "Squat");
    const id = sessionFor(log, day).exercises[0].id;
    log = addSet(log, day, id, { reps: 5, weight: 40, done: false });
    log = addSet(log, day, id, { reps: 5, weight: 50, done: false });
    return { log, id };
  };

  it("edits one set without touching its neighbours", () => {
    const { log, id } = withSquat();
    const next = updateSet(log, day, id, 1, { weight: 55 });
    expect(sessionFor(next, day).exercises[0].sets).toEqual([
      { reps: 5, weight: 40, done: false },
      { reps: 5, weight: 55, done: false },
    ]);
  });

  it("counts only the sets that were actually done", () => {
    const { log, id } = withSquat();
    expect(doneCountOf(sessionFor(log, day))).toBe(0);
    const next = updateSet(log, day, id, 0, { done: true });
    expect(doneCountOf(sessionFor(next, day))).toBe(1);
  });

  it("leaves unticked sets out of the day's volume", () => {
    const { log, id } = withSquat();
    // Written down but not lifted: nothing has been moved yet.
    expect(volumeOf(sessionFor(log, day))).toBe(0);
    const next = updateSet(log, day, id, 0, { done: true });
    expect(volumeOf(sessionFor(next, day))).toBe(200);
  });

  it("still counts sessions recorded before a set could be ticked", () => {
    let log = addExercise(emptyGymLog(), day, "Squat");
    const id = sessionFor(log, day).exercises[0].id;
    log = addSet(log, day, id, { reps: 5, weight: 40 });
    expect(volumeOf(sessionFor(log, day))).toBe(200);
  });

  it("renames an exercise and keeps its sets", () => {
    const { log, id } = withSquat();
    const next = renameExercise(log, day, id, "Squat (Barbell)");
    expect(sessionFor(next, day).exercises[0].name).toBe("Squat (Barbell)");
    expect(sessionFor(next, day).exercises[0].sets).toHaveLength(2);
  });

  it("clears only the day it is given", () => {
    const { log } = withSquat();
    const other = addExercise(log, "2026-09-24", "Bench");
    const next = clearSession(other, day);
    expect(sessionFor(next, day).exercises).toHaveLength(0);
    expect(sessionFor(next, "2026-09-24").exercises).toHaveLength(1);
  });
});

describe("named workouts", () => {
  const pushDay = () => {
    const { log, workout } = addWorkout(emptyGymLog(), "Push");
    return { log: addWorkoutExercise(log, workout.id, "Bench"), id: workout.id };
  };

  it("keeps each workout's exercises to itself", () => {
    const push = pushDay();
    const made = addWorkout(push.log, "Pull");
    const log = addWorkoutExercise(made.log, made.workout.id, "Row");

    expect(workoutById(log, push.id)?.exercises.map((e) => e.name)).toEqual(["Bench"]);
    expect(workoutById(log, made.workout.id)?.exercises.map((e) => e.name)).toEqual(["Row"]);
  });

  it("holds the weights put into it, so coming back shows what was lifted", () => {
    const { log, id } = pushDay();
    const exerciseId = workoutById(log, id)!.exercises[0].id;
    const withSets = addWorkoutSet(
      addWorkoutSet(log, id, exerciseId, { reps: 5, weight: 60, done: false }),
      id,
      exerciseId,
      { reps: 5, weight: 70, done: false }
    );

    const reloaded = parseGymLog(serializeGymLog(withSets));
    expect(workoutById(reloaded, id)?.exercises[0].sets).toEqual([
      { reps: 5, weight: 60, done: false },
      { reps: 5, weight: 70, done: false },
    ]);
    expect(setsInWorkout(workoutById(reloaded, id)!)).toBe(2);
  });

  it("unticks every set when the workout is done again, keeping the weights", () => {
    const { log, id } = pushDay();
    const exerciseId = workoutById(log, id)!.exercises[0].id;
    let next = addWorkoutSet(log, id, exerciseId, { reps: 5, weight: 60, done: false });
    next = updateWorkoutSet(next, id, exerciseId, 0, { done: true });
    expect(workoutById(next, id)?.exercises[0].sets[0].done).toBe(true);

    const fresh = resetWorkout(next, id);
    expect(workoutById(fresh, id)?.exercises[0].sets[0]).toEqual({ reps: 5, weight: 60, done: false });
  });

  it("removing one leaves the others alone", () => {
    const { log, id } = pushDay();
    const made = addWorkout(log, "Pull");
    const next = removeWorkout(made.log, id);
    expect(workoutsOf(next).map((w) => w.name)).toEqual(["Pull"]);
  });

  it("reads a log written before workouts existed", () => {
    const older = JSON.stringify({ version: 1, plans: {}, sessions: {} });
    expect(workoutsOf(parseGymLog(older))).toEqual([]);
  });
});
