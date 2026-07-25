import { describe, it, expect } from "vitest";
import { resolveTrackLayout, defaultPanelColumns, homeColumnFor, MODULE_IDS } from "../modules";

describe("defaultPanelColumns", () => {
  it("returns a fresh object each call (no shared reference across tracks)", () => {
    const a = defaultPanelColumns();
    const b = defaultPanelColumns();
    expect(a).not.toBe(b);
    expect(a.left).not.toBe(b.left);
    a.left.push("x");
    expect(b.left).not.toContain("x");
  });

  it("covers every known module across the two columns", () => {
    const cols = defaultPanelColumns();
    expect([...cols.left, ...cols.right].sort()).toEqual([...MODULE_IDS].sort());
  });
});

describe("resolveTrackLayout", () => {
  it("uses the default layout when the track has none", () => {
    const { columns, hidden } = resolveTrackLayout({});
    expect(columns).toEqual(defaultPanelColumns());
    expect(hidden).toEqual([]);
  });

  it("keeps stored columns as-is when they already cover everything", () => {
    const stored = { left: ["weeklyPlan"], right: ["materialsTracker"] };
    const track = {
      panelColumns: stored,
      hiddenPanels: ["phaseTracker", "streakGraph", "pomodoroTimer", "portfolioTracker"],
    };
    const { columns, hidden } = resolveTrackLayout(track);
    expect(columns.left).toEqual(["weeklyPlan"]);
    expect(columns.right).toEqual(["materialsTracker"]);
    expect(hidden).toEqual(track.hiddenPanels);
  });

  it("appends a known module that is neither placed nor hidden to its home column", () => {
    // streakGraph is missing from both columns and not hidden — it should
    // reappear on the left (its default home) rather than silently vanish.
    const track = {
      panelColumns: { left: ["weeklyPlan", "phaseTracker", "pomodoroTimer"], right: ["portfolioTracker", "materialsTracker"] },
      hiddenPanels: [],
    };
    const { columns } = resolveTrackLayout(track);
    expect(columns.left).toContain("streakGraph");
    expect(homeColumnFor("streakGraph")).toBe("left");
  });

  it("does not resurrect an explicitly hidden module", () => {
    const track = {
      panelColumns: { left: ["weeklyPlan"], right: [] },
      hiddenPanels: ["streakGraph"],
    };
    const { columns } = resolveTrackLayout(track);
    expect([...columns.left, ...columns.right]).not.toContain("streakGraph");
  });

  it("returns fresh arrays that don't alias the track's stored columns", () => {
    const stored = { left: ["weeklyPlan"], right: ["materialsTracker"] };
    const { columns } = resolveTrackLayout({ panelColumns: stored, hiddenPanels: [] });
    expect(columns.left).not.toBe(stored.left);
  });
});
