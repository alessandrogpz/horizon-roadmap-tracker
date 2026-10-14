import { describe, expect, it } from "vitest";
import { addFocusType, focusOfDay, focusTypeKey, recolorFocusType, removeFocusType, renameFocusType, type FocusPool } from "../focusTypes";

const pool = (): FocusPool => ({
  focusTypes: {
    study: { label: "Study", color: "#0ea5e9" },
    rest: { label: "Rest", color: "#22c55e" },
  },
  weekSchedule: [
    { name: "Mon", type: "study", label: "Study" },
    { name: "Tue", type: "rest", label: "Rest" },
    { name: "Wed", type: "study", label: "Study" },
  ],
});

describe("focusTypeKey", () => {
  it("reduces a label to letters and digits", () => {
    expect(focusTypeKey("Deep Work!")).toBe("deepwork");
    expect(focusTypeKey("  ")).toBe("");
  });
});

describe("addFocusType", () => {
  it("adds a type under its derived key", () => {
    const next = addFocusType(pool(), "Deep Work", "#f59e0b");
    expect(next.focusTypes.deepwork).toEqual({ label: "Deep Work", color: "#f59e0b" });
  });

  it("ignores a label that collides with an existing key", () => {
    // "study" and "STUDY!" reduce to the same key; the first one must survive.
    const next = addFocusType(pool(), "STUDY!", "#ef4444");
    expect(next.focusTypes.study.color).toBe("#0ea5e9");
    expect(Object.keys(next.focusTypes)).toHaveLength(2);
  });

  it("ignores a blank label", () => {
    expect(addFocusType(pool(), "   ", "#ef4444").focusTypes).toEqual(pool().focusTypes);
  });
});

describe("renameFocusType", () => {
  // The week stores a copy of each day's label, so a rename that only touched
  // the pool would leave the week showing the old name indefinitely.
  it("renames every day using the type", () => {
    const next = renameFocusType(pool(), "study", "Focus");
    expect(next.focusTypes.study.label).toBe("Focus");
    expect(next.weekSchedule.filter((d) => d.label === "Focus")).toHaveLength(2);
    expect(next.weekSchedule.find((d) => d.name === "Tue")?.label).toBe("Rest");
  });

  it("keeps the key, so the days stay attached", () => {
    const next = renameFocusType(pool(), "study", "Focus");
    expect(next.weekSchedule.find((d) => d.name === "Mon")?.type).toBe("study");
  });
});

describe("removeFocusType", () => {
  it("re-points the removed type's days at what is left", () => {
    const next = removeFocusType(pool(), "study");
    expect(next.focusTypes.study).toBeUndefined();
    expect(next.weekSchedule.find((d) => d.name === "Mon")).toEqual({
      name: "Mon",
      type: "rest",
      label: "Rest",
    });
  });

  it("refuses to remove the last type", () => {
    const only: FocusPool = {
      focusTypes: { study: { label: "Study", color: "#0ea5e9" } },
      weekSchedule: [{ name: "Mon", type: "study", label: "Study" }],
    };
    expect(removeFocusType(only, "study")).toEqual(only);
  });

  it("ignores a key that isn't there", () => {
    expect(removeFocusType(pool(), "nope")).toEqual(pool());
  });
});

describe("recolorFocusType", () => {
  it("changes the colour and nothing else", () => {
    const next = recolorFocusType(pool(), "rest", "#ef4444");
    expect(next.focusTypes.rest).toEqual({ label: "Rest", color: "#ef4444" });
    expect(next.weekSchedule).toEqual(pool().weekSchedule);
  });
});

describe("focusOfDay", () => {
  // The track's own rhythm is the single answer to "what is Monday for".
  // Everything that wants a day's type reads it here rather than keeping a
  // second copy that could disagree.
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
