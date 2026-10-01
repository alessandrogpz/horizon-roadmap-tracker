import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DEFAULT_SETTINGS, getSettings, resetSettings, updateSettings } from "../settings";
import { activeDateYMD, todayYMD } from "../dates";

// A minimal localStorage, since these run in node.
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

beforeEach(() => {
  vi.stubGlobal("window", {
    localStorage: new MemoryStorage(),
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  resetSettings();
});

afterEach(() => {
  resetSettings();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("settings", () => {
  it("starts at the defaults", () => {
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("persists a patch and leaves the rest alone", () => {
    updateSettings({ dayRolloverHour: 4 });
    expect(getSettings().dayRolloverHour).toBe(4);
    expect(getSettings().weekStartsOn).toBe(DEFAULT_SETTINGS.weekStartsOn);

    resetSettings(); // drops the cache too — proves it came back from storage
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("clamps a rollover hour out of range", () => {
    expect(updateSettings({ dayRolloverHour: 99 }).dayRolloverHour).toBe(23);
    expect(updateSettings({ dayRolloverHour: -5 }).dayRolloverHour).toBe(0);
  });

  it("repairs a malformed stored blob rather than throwing", () => {
    window.localStorage.setItem("horizon-settings", '{"weekStartsOn":"funday","dayRolloverHour":"four"}');
    const settings = getSettings();
    // Nonsense falls back to the default, which is Monday.
    expect(settings.weekStartsOn).toBe("mon");
    expect(settings.dayRolloverHour).toBe(0);
  });

  it("keeps a valid week start", () => {
    expect(updateSettings({ weekStartsOn: "sun" }).weekStartsOn).toBe("sun");
    expect(updateSettings({ weekStartsOn: "mon" }).weekStartsOn).toBe("mon");
  });
});

describe("day rollover", () => {
  it("keeps the small hours on the previous day", () => {
    const lateNight = new Date("2026-07-27T01:30:00");
    expect(activeDateYMD(lateNight, 0)).toBe("2026-07-27"); // plain midnight
    expect(activeDateYMD(lateNight, 4)).toBe("2026-07-26"); // still "yesterday"
  });

  it("rolls over once the configured hour passes", () => {
    const morning = new Date("2026-07-27T04:30:00");
    expect(activeDateYMD(morning, 4)).toBe("2026-07-27");
  });

  it("leaves the rest of the day untouched", () => {
    const afternoon = new Date("2026-07-27T15:00:00");
    expect(activeDateYMD(afternoon, 4)).toBe("2026-07-27");
  });

  it("todayYMD reads the configured hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T02:00:00"));
    expect(todayYMD()).toBe("2026-07-27");
    updateSettings({ dayRolloverHour: 5 });
    expect(todayYMD()).toBe("2026-07-26");
  });
});

describe("retired AI settings", () => {
  it("drops a stored AI block, API keys included, on first read and keeps the rest", () => {
    window.localStorage.setItem(
      "horizon-settings",
      JSON.stringify({ dayRolloverHour: 4, weekStartsOn: "mon", ai: { provider: "byok-gemini", geminiKey: "AIza-secret" } })
    );
    expect(getSettings()).toEqual({ dayRolloverHour: 4, weekStartsOn: "mon", masterView: false, masterExcluded: [] });
    expect(window.localStorage.getItem("horizon-settings")).not.toContain("AIza-secret");
  });

  it("leaves a blob that never had one alone", () => {
    const stored = JSON.stringify({ dayRolloverHour: 4, weekStartsOn: "mon" });
    window.localStorage.setItem("horizon-settings", stored);
    getSettings();
    expect(window.localStorage.getItem("horizon-settings")).toBe(stored);
  });
});
