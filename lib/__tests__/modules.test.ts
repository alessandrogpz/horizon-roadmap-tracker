import { describe, it, expect } from "vitest";
import { resolveTrackLayout, defaultPanelColumns, homeColumnFor, isOptIn, MODULE_IDS, MODULES } from "../modules";

describe("defaultPanelColumns", () => {
  it("returns a fresh object each call (no shared reference across tracks)", () => {
    const a = defaultPanelColumns();
    const b = defaultPanelColumns();
    expect(a).not.toBe(b);
    expect(a.left).not.toBe(b.left);
    a.left.push("x");
    expect(b.left).not.toContain("x");
  });

  it("covers every module except the opt-in ones", () => {
    const cols = defaultPanelColumns();
    const placed = [...cols.left, ...cols.right].sort();
    const expected = MODULES.filter((module) => !isOptIn(module.id))
      .map((module) => module.id as string)
      .sort();
    expect(placed).toEqual(expected);
  });

  it("leaves opt-in modules out of a new track entirely", () => {
    const cols = defaultPanelColumns();
    const optIn = MODULE_IDS.filter(isOptIn);
    expect(optIn.length).toBeGreaterThan(0);
    for (const id of optIn) expect([...cols.left, ...cols.right]).not.toContain(id);
  });

  it("does not append an opt-in module to a track that never asked for one", () => {
    // The whole point: a module added in a later version turns up by itself
    // unless it is the kind most tracks would not want.
    const { columns } = resolveTrackLayout({ panelColumns: { left: [], right: [] } });
    const optIn = MODULE_IDS.filter(isOptIn);
    for (const id of optIn) expect([...columns.left, ...columns.right]).not.toContain(id);
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
      hiddenPanels: ["phaseTracker", "streakGraph", "pomodoroTimer", "portfolioTracker", "notepad", "todoList"],
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
