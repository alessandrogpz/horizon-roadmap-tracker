import { describe, it, expect } from "vitest";
import { validateRoadmap, RoadmapUnusableError } from "../ai/validate";
import { categoriesFor, MATERIAL_CATEGORIES } from "../materialOptions";

// Fixtures here are drawn from the Stage −1 model screening
// (temp/ai-eval/results/), not invented. Real model failures are stranger than
// imagined ones, and these are the exact distribution the validator will face.

const task = (title: string) => ({ title });

const goodPhase = (title: string, day: number) => ({
  title,
  description: "A concrete stage of progress.",
  recommendedByDay: day,
  tasks: [task("Do a specific thing"), task("Do another specific thing")],
  detailedInfo: { focus: [{ item: "Focus", desc: "desc" }], deliverable: [], math: [] },
});

const goodWeek = ["focus", "focus", "practice", "focus", "build", "review", "rest"];

describe("validateRoadmap — clean input", () => {
  it("passes good output through without adjustments", () => {
    const result = validateRoadmap(
      {
        name: "Vulkan Rendering",
        color: "#4caf50",
        phases: [goodPhase("Instance and device setup", 30), goodPhase("Swapchain and render pass", 90)],
        weekSchedule: goodWeek,
      },
      90,
    );

    expect(result.adjustments).toEqual([]);
    expect(result.name).toBe("Vulkan Rendering");
    expect(result.phases).toHaveLength(2);
    expect(result.weekSchedule).toHaveLength(7);
  });

  it("assigns its own phase and task ids, ignoring anything the model sent", () => {
    const result = validateRoadmap(
      {
        name: "T",
        color: "#0ea5e9",
        // D9: models produce duplicate ids, which would corrupt completion
        // tracking since it is keyed by id.
        phases: [
          { ...goodPhase("A", 45), id: 99, tasks: [{ title: "x", id: "dup" }, { title: "y", id: "dup" }] },
          { ...goodPhase("B", 90), id: 99 },
        ],
        weekSchedule: goodWeek,
      },
      90,
    );

    expect(result.phases.map((p) => p.id)).toEqual([1, 2]);
    expect(result.phases[0].tasks.map((t) => t.id)).toEqual(["p1_t1", "p1_t2"]);
    expect(result.phases[0].tasks.every((t) => t.completed === false)).toBe(true);
  });
});

describe("validateRoadmap — failures observed in screening", () => {
  it("ignores a model duration that contradicts the user's horizon", () => {
    // 1.5B, `fitness` run3: returned durationDays 8 for an 8-*week* goal while
    // scheduling phases out to day 72. The user's horizon is authoritative.
    const result = validateRoadmap(
      {
        name: "Couch to 5K",
        color: "#1ABC9C",
        durationDays: 8,
        phases: [
          { ...goodPhase("Introduction", 0) },
          { ...goodPhase("Building Strength", 8) },
          { ...goodPhase("Running Progress", 72) },
        ],
        weekSchedule: goodWeek,
      },
      56,
    );

    expect(result.phases.map((p) => p.recommendedByDay)).toEqual([19, 37, 56]);
    expect(result.adjustments).toContain("rescheduled phase deadlines to fit your horizon");
  });

  it("repairs deadlines that never advance", () => {
    // 1.5B, `webdev` run2: seven consecutive phases all at day 75.
    const result = validateRoadmap(
      {
        name: "Full-Stack",
        color: "#0ea5e9",
        phases: [goodPhase("A", 75), goodPhase("B", 75), goodPhase("C", 75), goodPhase("D", 105)],
        weekSchedule: goodWeek,
      },
      180,
    );

    const days = result.phases.map((p) => p.recommendedByDay!);
    expect(days).toEqual([45, 90, 135, 180]);
    expect(days[days.length - 1]).toBe(180);
  });

  it("repairs deadlines that run past the horizon", () => {
    // 3B, `webdev` run1: scheduled to day 270 on a 180-day plan.
    const result = validateRoadmap(
      {
        name: "Full-Stack",
        color: "#0ea5e9",
        phases: [goodPhase("A", 30), goodPhase("B", 150), goodPhase("C", 270)],
        weekSchedule: goodWeek,
      },
      180,
    );

    expect(result.phases.every((p) => p.recommendedByDay! <= 180)).toBe(true);
    expect(result.phases[2].recommendedByDay).toBe(180);
  });

  it("drops phases that have no tasks", () => {
    // 1.5B, `fitness` run1: six phases, every one with an empty task array.
    const result = validateRoadmap(
      {
        name: "Couch to 5K",
        color: "#0ea5e9",
        phases: [
          goodPhase("Real phase", 28),
          { title: "Race Day", description: "", recommendedByDay: 56, tasks: [], detailedInfo: {} },
          goodPhase("Another real phase", 56),
        ],
        weekSchedule: goodWeek,
      },
      56,
    );

    expect(result.phases).toHaveLength(2);
    expect(result.phases.map((p) => p.id)).toEqual([1, 2]);
    expect(result.adjustments.some((a) => a.includes("empty phase"))).toBe(true);
  });

  it("falls back to a full week when weekSchedule is not usable keys", () => {
    // 1.5B, `webdev` run1: day slots filled with phase names. Under the D13
    // schema these arrive as unrecognised values and are replaced wholesale.
    const result = validateRoadmap(
      {
        name: "Full-Stack",
        color: "#0ea5e9",
        phases: [goodPhase("A", 90), goodPhase("B", 180)],
        weekSchedule: [
          { name: "Beginner Phase", type: "HTML, CSS, JavaScript Basics", label: "x" },
          { name: "Intermediate Phase", type: "Modern JS Features", label: "y" },
        ],
      },
      180,
    );

    expect(result.weekSchedule).toHaveLength(7);
    expect(result.weekSchedule.map((d) => d.name)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    // Referential integrity is structural now, not repaired: every type is ours.
    for (const day of result.weekSchedule) {
      expect(result.focusTypes[day.type]).toBeDefined();
    }
  });

  it("breaks up a week where every day is identical", () => {
    // 3B, `vulkan` runs 1 and 3: all seven days "focus" — schema-valid, useless.
    const result = validateRoadmap(
      {
        name: "Vulkan",
        color: "#0ea5e9",
        phases: [goodPhase("A", 45), goodPhase("B", 90)],
        weekSchedule: ["focus", "focus", "focus", "focus", "focus", "focus", "focus"],
      },
      90,
    );

    expect(new Set(result.weekSchedule.map((d) => d.type)).size).toBeGreaterThan(1);
    expect(result.weekSchedule[6].type).toBe("rest");
    expect(result.adjustments.some((a) => a.includes("repetitive week"))).toBe(true);
  });

  it("replaces a colour that is not #rrggbb", () => {
    const result = validateRoadmap(
      { name: "T", color: "light blue", phases: [goodPhase("A", 45), goodPhase("B", 90)], weekSchedule: goodWeek },
      90,
    );
    expect(result.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(result.adjustments).toContain("replaced an invalid track colour");
  });

  it("clamps counts that exceed the allowed range", () => {
    const many = Array.from({ length: 12 }, (_, i) => goodPhase(`Phase ${i}`, (i + 1) * 10));
    const result = validateRoadmap(
      {
        name: "T",
        color: "#0ea5e9",
        phases: many.map((p) => ({ ...p, tasks: Array.from({ length: 20 }, (_, i) => task(`t${i}`)) })),
        weekSchedule: goodWeek,
      },
      120,
    );

    expect(result.phases).toHaveLength(8);
    expect(result.phases[0].tasks).toHaveLength(10);
  });
});

describe("validateRoadmap — materials, portfolio, rotations", () => {
  const base = {
    name: "T",
    color: "#0ea5e9",
    phases: [goodPhase("A", 45), goodPhase("B", 90)],
    weekSchedule: goodWeek,
  };

  it("strips links from materials unconditionally", () => {
    // D8: models attach dead or invented URLs to plausible book titles. The
    // title is worth keeping; the address is never generated.
    const result = validateRoadmap(
      {
        ...base,
        materials: [
          { title: "Real-Time Rendering", category: "Computer Graphics", type: "Book", totalPages: 1200 },
          { title: "Sketchy Blog", category: "Other", type: "Website", link: "https://invented.example/x" },
        ],
      },
      90,
    );

    expect(result.materials).toHaveLength(2);
    expect(result.materials.every((m) => m.link === "")).toBe(true);
    expect(result.materials[0].totalPages).toBe(1200);
    // Non-books get no page count, whatever the model claimed.
    expect(result.materials[1].totalPages).toBe(0);
    expect(result.materials.every((m) => m.status === "Not Started" && m.currentPage === 0)).toBe(true);
  });

  it("forces material category and type into the vocabularies the UI offers", () => {
    const result = validateRoadmap(
      { ...base, materials: [{ title: "X", category: "Underwater Basket Weaving", type: "Scroll" }] },
      90,
    );
    expect(result.materials[0].category).toBe("Other");
    expect(result.materials[0].type).toBe("Other");
  });

  it("never lets the model set startWeek", () => {
    // startWeek anchors which item is current and drives the daily reset. A
    // model-chosen value desynchronises the rotation from week one.
    const result = validateRoadmap(
      {
        ...base,
        rotations: [
          {
            label: "Algorithm patterns",
            items: [{ title: "Two pointers" }, { title: "Sliding window" }],
            daysOfWeek: ["Mon", "Wed"],
            target: "revision",
            startWeek: 47,
          },
        ],
      },
      90,
    );

    expect(result.rotations[0].startWeek).toBe(1);
  });

  it("drops rotation days that fall on a rest day", () => {
    const result = validateRoadmap(
      {
        ...base,
        // goodWeek puts rest on Sunday.
        rotations: [
          {
            label: "Drills",
            items: [{ title: "A" }],
            daysOfWeek: ["Mon", "Sun", "Mon", "Nonesuch"],
            target: "focus",
          },
        ],
      },
      90,
    );

    // Rest day removed, duplicate collapsed, invalid name discarded.
    expect(result.rotations[0].daysOfWeek).toEqual(["Mon"]);
  });

  it("drops rotations that have nothing to run", () => {
    const result = validateRoadmap(
      {
        ...base,
        rotations: [
          { label: "Empty", items: [], daysOfWeek: ["Mon"], target: "revision" },
          { label: "No days", items: [{ title: "A" }], daysOfWeek: [], target: "revision" },
          { label: "Fine", items: [{ title: "A" }], daysOfWeek: ["Tue"], target: "revision" },
        ],
      },
      90,
    );

    expect(result.rotations).toHaveLength(1);
    expect(result.rotations[0].label).toBe("Fine");
    expect(result.adjustments.some((a) => a.includes("rotation"))).toBe(true);
  });

  it("defaults an unknown rotation target to revision", () => {
    const result = validateRoadmap(
      {
        ...base,
        rotations: [{ label: "R", items: [{ title: "A" }], daysOfWeek: ["Mon"], target: "nonsense" }],
      },
      90,
    );
    expect(result.rotations[0].target).toBe("revision");
  });

  it("takes only titles for portfolio projects, never URLs", () => {
    const result = validateRoadmap(
      {
        ...base,
        portfolio: [
          { title: "Deferred renderer", repoUrl: "https://invented.example/repo", completed: true },
          { title: "" },
        ],
      },
      90,
    );

    expect(result.portfolio).toEqual([{ title: "Deferred renderer", completed: false }]);
  });

  it("carries algoDS only when it has content", () => {
    const withAlgo = validateRoadmap(
      {
        ...base,
        phases: [
          { ...goodPhase("A", 45), detailedInfo: { focus: [], deliverable: [], math: [], algoDS: [{ item: "Graphs", desc: "BFS/DFS" }] } },
          goodPhase("B", 90),
        ],
      },
      90,
    );
    expect(withAlgo.phases[0].detailedInfo.algoDS).toEqual([{ item: "Graphs", desc: "BFS/DFS" }]);
    // A track with no algorithms work shouldn't render an empty section.
    expect("algoDS" in withAlgo.phases[1].detailedInfo).toBe(false);
  });

  it("returns empty collections rather than undefined when nothing was generated", () => {
    const result = validateRoadmap(base, 90);
    expect(result.materials).toEqual([]);
    expect(result.portfolio).toEqual([]);
    expect(result.rotations).toEqual([]);
    expect(result.adjustments).toEqual([]);
  });
});

describe("validateRoadmap — never throws on repairable garbage", () => {
  const junk: unknown[] = [
    null,
    undefined,
    "a string",
    42,
    [],
    { phases: "not an array" },
    { phases: [{}, {}] },
    { name: 1, color: [], phases: [{ tasks: [{ title: 5 }] }], weekSchedule: 7 },
  ];

  it.each(junk.map((v, i) => [i, v]))("input %i either validates or fails cleanly", (_i, value) => {
    try {
      const result = validateRoadmap(value, 90);
      expect(result.weekSchedule).toHaveLength(7);
      expect(result.phases.length).toBeGreaterThanOrEqual(2);
    } catch (err) {
      // The one permitted exception: nothing salvageable. Never a TypeError.
      expect(err).toBeInstanceOf(RoadmapUnusableError);
    }
  });

  it("strips unknown keys rather than spreading them into app state", () => {
    const result = validateRoadmap(
      {
        name: "T",
        color: "#0ea5e9",
        phases: [
          { ...goodPhase("A", 45), isSynced: true, streakHistory: { evil: 1 } },
          goodPhase("B", 90),
        ],
        weekSchedule: goodWeek,
        configVersion: 99,
      },
      90,
    );

    expect(Object.keys(result)).toEqual(
      expect.arrayContaining(["name", "color", "phases", "weekSchedule", "focusTypes", "adjustments"]),
    );
    expect("configVersion" in result).toBe(false);
    expect("isSynced" in result.phases[0]).toBe(false);
    expect("streakHistory" in result.phases[0]).toBe(false);
  });
});

describe("material vocabularies stay in step with the UI", () => {
  it("accepts every category and type the materials UI offers", () => {
    // The schema constrains the model to these lists and the validator falls
    // back to "Other" for anything else. If the two drift apart, generation
    // silently produces materials filed under the wrong heading.
    for (const category of MATERIAL_CATEGORIES) {
      const result = validateRoadmap(
        {
          name: "T",
          color: "#0ea5e9",
          phases: [goodPhase("A", 45), goodPhase("B", 90)],
          weekSchedule: goodWeek,
          materials: [{ title: "X", category, type: "Book" }],
        },
        90,
      );
      expect(result.materials[0].category).toBe(category);
    }
  });

  it("surfaces a category already in use that predates the canonical list", () => {
    expect(categoriesFor([{ category: "Woodworking" }])).toContain("Woodworking");
    // And doesn't duplicate one that's already canonical.
    const list = categoriesFor([{ category: "Mathematics" }]);
    expect(list.filter((c) => c === "Mathematics")).toHaveLength(1);
  });
});
