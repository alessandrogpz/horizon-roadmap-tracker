import { describe, expect, it } from "vitest";
import {
  addExercise,
  addSet,
  emptyGymLog,
  focusFor,
  gymNoteId,
  lastTime,
  parseGymLog,
  removeSet,
  serializeGymLog,
  setCountOf,
  setDayFocus,
  setSplit,
  sessionFor,
  volumeOf,
  type GymLog,
} from "../gym";

const log = (): GymLog => {
  let l = emptyGymLog();
  l = setSplit(l, "Mon", "push");
  l = addExercise(l, "2026-09-21", "Bench press");
  const id = l.sessions["2026-09-21"].exercises[0].id;
  l = addSet(l, "2026-09-21", id, { reps: 8, weight: 60 });
  l = addSet(l, "2026-09-21", id, { reps: 6, weight: 70 });
  return l;
};

describe("parseGymLog", () => {
  it("round-trips through a note's text", () => {
    const parsed = parseGymLog(serializeGymLog(log()));
    expect(parsed.split.Mon).toBe("push");
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
      split: { Mon: "push", Tue: "brunch" },
      sessions: {
        "2026-09-21": {
          focus: "nonsense",
          exercises: [
            { id: "a", name: "Squat", sets: [{ reps: 5, weight: 100 }, { reps: "many" }] },
            { id: "b", sets: [] },
          ],
        },
      },
    });
    const parsed = parseGymLog(raw);
    expect(parsed.split.Mon).toBe("push");
    expect(parsed.split.Tue).toBeUndefined();
    expect(parsed.sessions["2026-09-21"].focus).toBeUndefined();
    // The nameless exercise goes; the bad set goes; the good set stays.
    expect(parsed.sessions["2026-09-21"].exercises).toHaveLength(1);
    expect(parsed.sessions["2026-09-21"].exercises[0].sets).toEqual([{ reps: 5, weight: 100 }]);
  });
});

describe("focusFor", () => {
  it("falls back to the weekly split", () => {
    expect(focusFor(log(), "2026-09-28", "Mon")).toBe("push");
  });

  it("lets a day override its split", () => {
    const l = setDayFocus(log(), "2026-09-28", "cardio");
    expect(focusFor(l, "2026-09-28", "Mon")).toBe("cardio");
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
