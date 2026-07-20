import { describe, it, expect } from "vitest";
import { computeAutoRevisionItem, isAutoRevisionItem } from "../rotation";
import { DEFAULT_WEEK_SCHEDULE, DSA_PATTERN_WEEKS } from "../constants";
import type { RotationConfig } from "../types";

const rotation: RotationConfig = { weeks: DSA_PATTERN_WEEKS, appliesToScheduleType: "math" };

describe("computeAutoRevisionItem", () => {
  it("returns the rotation pattern for a rotation-type day", () => {
    // Mon is type "math" in DEFAULT_WEEK_SCHEDULE, matching rotation.appliesToScheduleType
    const item = computeAutoRevisionItem(rotation, DEFAULT_WEEK_SCHEDULE, 1, 1, "Mon");
    expect(item?.id).toBe("dsa_auto");
    expect(item?.title).toBe(DSA_PATTERN_WEEKS[0].pattern);
  });

  it("returns the math interleave item for a non-rotation-type day", () => {
    // Tue is type "dsapattern", not "math", so it gets the interleave item
    const item = computeAutoRevisionItem(rotation, DEFAULT_WEEK_SCHEDULE, 1, 1, "Tue");
    expect(item?.id).toBe("math_revision");
  });

  it("returns null on the rest day (Sun)", () => {
    expect(computeAutoRevisionItem(rotation, DEFAULT_WEEK_SCHEDULE, 1, 1, "Sun")).toBeNull();
  });

  it("advances to the next pattern as the curriculum week advances", () => {
    const week1 = computeAutoRevisionItem(rotation, DEFAULT_WEEK_SCHEDULE, 1, 1, "Mon");
    const week2 = computeAutoRevisionItem(rotation, DEFAULT_WEEK_SCHEDULE, 2, 1, "Mon");
    expect(week1?.title).toBe(DSA_PATTERN_WEEKS[0].pattern);
    expect(week2?.title).toBe(DSA_PATTERN_WEEKS[1].pattern);
  });

  it("wraps around after the last pattern in the cycle", () => {
    const len = DSA_PATTERN_WEEKS.length;
    const item = computeAutoRevisionItem(rotation, DEFAULT_WEEK_SCHEDULE, 1 + len, 1, "Mon");
    expect(item?.title).toBe(DSA_PATTERN_WEEKS[0].pattern);
  });

  it("respects a non-default dsaStartWeek offset", () => {
    const item = computeAutoRevisionItem(rotation, DEFAULT_WEEK_SCHEDULE, 5, 5, "Mon");
    expect(item?.title).toBe(DSA_PATTERN_WEEKS[0].pattern);
  });
});

describe("isAutoRevisionItem", () => {
  it("identifies dsa_auto and math_revision as auto items", () => {
    expect(isAutoRevisionItem({ id: "dsa_auto", title: "x", completed: false })).toBe(true);
    expect(isAutoRevisionItem({ id: "math_revision", title: "x", completed: false })).toBe(true);
  });

  it("does not treat manually added items as auto items", () => {
    expect(isAutoRevisionItem({ id: "rev_12345", title: "x", completed: false })).toBe(false);
  });
});
