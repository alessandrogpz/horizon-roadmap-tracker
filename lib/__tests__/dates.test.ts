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
  /**
   * Days apart on the calendar, which is the thing these tests mean.
   *
   * They used to subtract one timestamp from another and expect a whole
   * number of 24-hour days, which is only true of a week with no daylight
   * saving change in it. On the week of 19 October 2026 the clocks go back,
   * so two local midnights seven days apart are 169 hours apart and the test
   * failed — on the dates being right. It would have failed twice a year,
   * every year, and passed every other day.
   */
  const daysBetween = (from: string, to: string): number => {
    const cursor = parseYMD(from);
    let days = 0;
    while (formatDateYMD(cursor) < to) {
      cursor.setDate(cursor.getDate() + 1);
      days += 1;
    }
    return days;
  };

  it("returns dates within the requested week", () => {
    const mon = getDateForDayName("Mon", 0);
    const sun = getDateForDayName("Sun", 0);
    expect(parseYMD(mon).getDay()).toBe(1);
    expect(parseYMD(sun).getDay()).toBe(0);
    expect(daysBetween(mon, sun)).toBe(6);
  });

  it("shifts by exactly seven days per week offset", () => {
    expect(daysBetween(getDateForDayName("Mon", 0), getDateForDayName("Mon", 1))).toBe(7);
  });

  // The failure above was a Sunday-to-Monday clock change. Pin the behaviour
  // that matters across one directly, rather than waiting for October.
  it("counts calendar days across a daylight saving change", () => {
    expect(daysBetween("2026-10-19", "2026-10-26")).toBe(7);
    expect(daysBetween("2026-03-23", "2026-03-30")).toBe(7);
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
