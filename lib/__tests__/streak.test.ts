import { describe, it, expect } from "vitest";
import { addCompletion, removeCompletion, rebuildStreakHistory, completedItemTitle } from "../streak";
import type { AppState } from "../types";

const baseData = { completedItemsHistory: {} } as AppState;

describe("completedItemTitle", () => {
  it("handles both legacy plain-string entries and object entries", () => {
    expect(completedItemTitle("Old Entry")).toBe("Old Entry");
    expect(completedItemTitle({ title: "New Entry", description: "x" })).toBe("New Entry");
  });
});

describe("rebuildStreakHistory", () => {
  it("only includes dates with at least one recorded item", () => {
    const history = rebuildStreakHistory({
      "2026-01-01": [{ title: "A" }],
      "2026-01-02": [],
    });
    expect(history).toEqual(["2026-01-01"]);
  });
});

describe("addCompletion / removeCompletion", () => {
  it("adds an item once and updates streakHistory", () => {
    const result = addCompletion(baseData, "2026-01-01", "Read a book");
    expect(result.completedItemsHistory["2026-01-01"]).toEqual([{ title: "Read a book", description: "" }]);
    expect(result.streakHistory).toEqual(["2026-01-01"]);
  });

  it("does not add a duplicate title on the same date", () => {
    const once = addCompletion(baseData, "2026-01-01", "Read a book");
    const twice = addCompletion({ ...baseData, completedItemsHistory: once.completedItemsHistory }, "2026-01-01", "Read a book");
    expect(twice.completedItemsHistory["2026-01-01"]).toHaveLength(1);
  });

  it("removes an item by title and clears the date from streakHistory once empty", () => {
    const added = addCompletion(baseData, "2026-01-01", "Read a book");
    const removed = removeCompletion({ ...baseData, completedItemsHistory: added.completedItemsHistory }, "2026-01-01", "Read a book");
    expect(removed.completedItemsHistory["2026-01-01"]).toEqual([]);
    expect(removed.streakHistory).toEqual([]);
  });

  it("leaves other items on the same date untouched when removing one", () => {
    const withOne = addCompletion(baseData, "2026-01-01", "Item A");
    const withTwo = addCompletion({ ...baseData, completedItemsHistory: withOne.completedItemsHistory }, "2026-01-01", "Item B");
    const removed = removeCompletion({ ...baseData, completedItemsHistory: withTwo.completedItemsHistory }, "2026-01-01", "Item A");
    expect(removed.completedItemsHistory["2026-01-01"]).toEqual([{ title: "Item B", description: "" }]);
  });
});
