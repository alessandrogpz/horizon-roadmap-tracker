import { describe, it, expect } from "vitest";
import { formatDateYMD, isDateStr, parseYMD, getMondayOfDateWeek, getWeekNum, getDateForDayName } from "../dates";

describe("formatDateYMD / parseYMD", () => {
  it("round-trips local dates", () => {
    const d = new Date(2026, 6, 19); // 2026-07-19
    expect(formatDateYMD(d)).toBe("2026-07-19");
    expect(formatDateYMD(parseYMD("2026-07-19"))).toBe("2026-07-19");
  });
});

describe("getMondayOfDateWeek", () => {
  it("maps every weekday to that week's Monday", () => {
    // 2026-07-13 is a Monday
    for (let i = 0; i < 7; i++) {
      const d = new Date(2026, 6, 13 + i);
      expect(formatDateYMD(getMondayOfDateWeek(d))).toBe("2026-07-13");
    }
  });

  it("treats Sunday as the end of the week", () => {
    expect(formatDateYMD(getMondayOfDateWeek(new Date(2026, 6, 19)))).toBe("2026-07-13"); // Sunday
  });
});

describe("getWeekNum", () => {
  it("counts week 1 from the Monday of the start date's week", () => {
    // start Wednesday 2026-07-01 → week starts Monday 2026-06-29
    expect(getWeekNum("2026-07-01", new Date(2026, 5, 29))).toBe(1);
    expect(getWeekNum("2026-07-01", new Date(2026, 6, 5))).toBe(1); // Sunday same week
    expect(getWeekNum("2026-07-01", new Date(2026, 6, 6))).toBe(2); // next Monday
    expect(getWeekNum("2026-07-01", new Date(2026, 6, 19))).toBe(3);
  });

  it("defaults to week 1 without a start date", () => {
    expect(getWeekNum("")).toBe(1);
  });
});

describe("getDateForDayName", () => {
  it("returns dates within the requested week", () => {
    const mon = parseYMD(getDateForDayName("Mon", 0));
    const sun = parseYMD(getDateForDayName("Sun", 0));
    expect(mon.getDay()).toBe(1);
    expect(sun.getDay()).toBe(0);
    expect(sun.getTime() - mon.getTime()).toBe(6 * 24 * 60 * 60 * 1000);
  });

  it("shifts by exactly seven days per week offset", () => {
    const thisMon = parseYMD(getDateForDayName("Mon", 0));
    const nextMon = parseYMD(getDateForDayName("Mon", 1));
    expect(nextMon.getTime() - thisMon.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("isDateStr", () => {
  // Shape only: it guards the boundary where a pasted or half-written value
  // could otherwise reach date arithmetic.
  it("accepts what the app stores", () => {
    expect(isDateStr("2026-09-24")).toBe(true);
  });

  it("rejects anything else, including nothing", () => {
    for (const bad of ["", "24/09/2026", "2026-9-4", "2026-09-24T00:00", "today", undefined, null]) {
      expect(isDateStr(bad as string)).toBe(false);
    }
  });
});
