// Turns whatever the model returned into something the wizard can safely show.
//
// Constrained decoding guarantees *shape*. This layer guarantees *sanity*, and
// the gap between the two is much wider than it sounds: every generation in the
// Stage −1 screening was grammar-constrained, and models still returned
// `durationDays: 8` for an eight-*week* goal, phases with no tasks, and weeks
// whose day names were phase titles.
//
// Three rules this file obeys without exception:
//   1. It is pure and synchronous — trivially unit-testable, no I/O.
//   2. It NEVER throws on bad model output. It repairs, drops, or falls back.
//   3. It reports what it changed, so the UI can say "generated, with
//      adjustments" rather than silently shipping a mangled roadmap.
//
// Checks marked [observed] fired for real across 60 logged generations; the
// counts are in AI_ROADMAP_PLAN.md §6.

import type {
  FocusType,
  Material,
  Phase,
  PhaseDetailItem,
  PortfolioProject,
  RotationDef,
  TaskItem,
  WeekDay,
} from "../types";
import { buildFocusTypes, buildWeekSchedule, DAY_NAMES } from "./prompts";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_TYPES,
  MAX_MATERIALS,
  MAX_PORTFOLIO,
  MAX_ROTATIONS,
  MAX_ROTATION_ITEMS,
} from "./roadmapSchema";

const HEX = /^#[0-9a-fA-F]{6}$/;

const MIN_PHASES = 2;
const MAX_PHASES = 8;
const MAX_TASKS_PER_PHASE = 10;
const MAX_DETAIL_ITEMS = 6;
const MAX_NAME_LEN = 60;
const MAX_TITLE_LEN = 120;
const MAX_DESC_LEN = 400;

export interface ValidatedRoadmap {
  name: string;
  color: string;
  phases: Phase[];
  weekSchedule: WeekDay[];
  focusTypes: Record<string, FocusType>;
  materials: Omit<Material, "id">[];
  portfolio: Omit<PortfolioProject, "id">[];
  /** `id` is assigned at seed time; `startWeek` is set here and never by the
   *  model — see validateRotations. */
  rotations: Omit<RotationDef, "id">[];
  /** Human-readable list of repairs applied, for the "with adjustments" notice.
   *  Empty means the model's output was used as-is. */
  adjustments: string[];
}

/** Thrown only when there is nothing salvageable — never for a repairable
 *  defect. The wizard treats this as "retry", not "show the user a mess". */
export class RoadmapUnusableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoadmapUnusableError";
  }
}

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

function detailList(value: unknown): PhaseDetailItem[] | string {
  if (typeof value === "string") return text(value, MAX_DESC_LEN);
  if (!Array.isArray(value)) return "";
  const items = value
    .map((entry) => {
      const obj = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      return { item: text(obj.item, MAX_TITLE_LEN), desc: text(obj.desc, MAX_DESC_LEN) };
    })
    .filter((d) => d.item.length > 0)
    .slice(0, MAX_DETAIL_ITEMS);
  // `math` is typed as required but is legitimately empty for non-technical
  // goals, and "" reads better than [] everywhere it's rendered.
  return items.length ? items : "";
}

/**
 * Redistributes phase deadlines evenly across the horizon.
 *
 * The single most common failure in screening — final value ≠ duration 23×, not
 * strictly increasing 20×, including a 180-day plan scheduling to day 270 and
 * seven consecutive phases pinned to the same day. Mirrors the even-split
 * pattern in lib/templates/custom.ts.
 */
function redistribute(phases: Phase[], durationDays: number): void {
  const step = durationDays / phases.length;
  phases.forEach((phase, i) => {
    phase.recommendedByDay = Math.max(1, Math.round(step * (i + 1)));
  });
  if (phases.length) phases[phases.length - 1].recommendedByDay = durationDays;
}

/**
 * Study materials, with links stripped unconditionally.
 *
 * D8: a model will confidently produce a plausible book title attached to a
 * dead or invented URL, and nothing destroys trust in a generated curriculum
 * faster. Titles are useful enough to keep — the user recognises a real book —
 * but the address is never generated, so `link` is always "". The wizard
 * labels these as unverified.
 */
function validateMaterials(raw: unknown): Omit<Material, "id">[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const obj = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      const title = text(obj.title, MAX_TITLE_LEN);
      if (!title) return null;

      const category = MATERIAL_CATEGORIES.includes(String(obj.category))
        ? String(obj.category)
        : "Other";
      const type = MATERIAL_TYPES.includes(String(obj.type)) ? String(obj.type) : "Other";
      const pages =
        type === "Book" && typeof obj.totalPages === "number" && Number.isFinite(obj.totalPages)
          ? Math.max(0, Math.min(5000, Math.round(obj.totalPages)))
          : 0;

      return {
        title,
        category,
        type,
        status: "Not Started",
        currentPage: 0,
        totalPages: pages,
        currentSubject: "",
        // Never generated. Not a repair — a hard rule.
        link: "",
      };
    })
    .filter((m): m is Omit<Material, "id"> => m !== null)
    .slice(0, MAX_MATERIALS);
}

function validatePortfolio(raw: unknown): Omit<PortfolioProject, "id">[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const obj = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      return text(obj.title, MAX_TITLE_LEN);
    })
    .filter((title) => title.length > 0)
    // No repoUrl or localPath: same reasoning as material links.
    .map((title) => ({ title, completed: false }))
    .slice(0, MAX_PORTFOLIO);
}

/**
 * Recurring weekly cycles.
 *
 * Two fields are ours, not the model's:
 *
 *  - `startWeek` is the anchor deciding which item is "current", and the daily
 *    reset computes from it. A model guessing here would desynchronise the
 *    rotation from week one. A new track always starts at week 1.
 *  - `id` is assigned at seed time; rotation-generated daily items are
 *    namespaced by it (`rotation_<id>`), so a duplicate would make two
 *    rotations overwrite each other's entries.
 *
 * A rotation with no items or no valid days is dropped rather than repaired —
 * there is nothing to repair it from, and an empty rotation silently produces
 * no items forever, which reads as a bug rather than a choice.
 */
function validateRotations(raw: unknown, weekSchedule: WeekDay[]): Omit<RotationDef, "id">[] {
  if (!Array.isArray(raw)) return [];

  // Scheduling a rotation onto a rest day means work appears on a day the plan
  // says to rest. Drop those days rather than the whole rotation.
  const restDays = new Set(weekSchedule.filter((d) => d.type === "rest").map((d) => d.name));

  return raw
    .map((entry) => {
      const obj = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;

      const items = (Array.isArray(obj.items) ? obj.items : [])
        .map((it) => {
          const item = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
          const title = text(item.title, MAX_TITLE_LEN);
          if (!title) return null;
          const desc = text(item.description, MAX_DESC_LEN);
          return desc ? { title, description: desc } : { title };
        })
        .filter((i): i is { title: string; description?: string } => i !== null)
        .slice(0, MAX_ROTATION_ITEMS);

      const daysOfWeek = (Array.isArray(obj.daysOfWeek) ? obj.daysOfWeek : [])
        .map((d) => String(d))
        .filter((d) => (DAY_NAMES as readonly string[]).includes(d) && !restDays.has(d))
        // De-duplicate: the same day twice would write the item twice.
        .filter((d, i, arr) => arr.indexOf(d) === i);

      if (items.length === 0 || daysOfWeek.length === 0) return null;

      return {
        label: text(obj.label, MAX_TITLE_LEN) || "Weekly rotation",
        items,
        daysOfWeek,
        target: obj.target === "focus" ? ("focus" as const) : ("revision" as const),
        // Ours, always. See the note above.
        startWeek: 1,
      };
    })
    .filter((r): r is Omit<RotationDef, "id"> => r !== null)
    .slice(0, MAX_ROTATIONS);
}

/**
 * @param durationDays The user's own horizon from HorizonStep — authoritative.
 *   The model is never asked for it and never trusted with it: 1.5B returned
 *   `durationDays: 8` for an eight-week goal while scheduling phases to day 72.
 */
export function validateRoadmap(raw: unknown, durationDays: number): ValidatedRoadmap {
  const adjustments: string[] = [];
  const root = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  // ---- name and colour ----------------------------------------------------
  const name = text(root.name, MAX_NAME_LEN) || "My Roadmap";
  if (!text(root.name, MAX_NAME_LEN)) adjustments.push("used a placeholder track name");

  let color = typeof root.color === "string" ? root.color.trim() : "";
  if (!HEX.test(color)) {
    color = "#0ea5e9";
    adjustments.push("replaced an invalid track colour");
  }

  // ---- phases -------------------------------------------------------------
  const rawPhases = Array.isArray(root.phases) ? root.phases : [];
  if (rawPhases.length === 0) {
    throw new RoadmapUnusableError("The model returned no phases.");
  }

  let phases: Phase[] = rawPhases.map((entry, index) => {
    const obj = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const rawTasks = Array.isArray(obj.tasks) ? obj.tasks : [];

    const tasks: TaskItem[] = rawTasks
      .map((t) => {
        const task = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
        return text(task.title, MAX_TITLE_LEN);
      })
      .filter((title) => title.length > 0)
      .slice(0, MAX_TASKS_PER_PHASE)
      // D9: ids are ours. Models drift and produce duplicates; a duplicate task
      // id would corrupt completion tracking, which is keyed by id.
      .map((title, i) => ({ id: `p${index + 1}_t${i + 1}`, title, completed: false }));

    const detail = (obj.detailedInfo && typeof obj.detailedInfo === "object"
      ? obj.detailedInfo
      : {}) as Record<string, unknown>;

    return {
      id: index + 1,
      title: text(obj.title, MAX_TITLE_LEN),
      description: text(obj.description, MAX_DESC_LEN),
      tasks,
      detailedInfo: {
        focus: detailList(detail.focus),
        deliverable: detailList(detail.deliverable),
        math: detailList(detail.math),
        // Optional on the type — only carried when it has content, so a track
        // with no algorithms work doesn't render an empty section.
        ...(() => {
          const algoDS = detailList(detail.algoDS);
          return algoDS === "" ? {} : { algoDS };
        })(),
      },
      recommendedByDay:
        typeof obj.recommendedByDay === "number" && Number.isFinite(obj.recommendedByDay)
          ? Math.round(obj.recommendedByDay)
          : undefined,
    };
  });

  // [observed] A phase with no tasks renders as a dead row in PhaseReviewStep —
  // worse than not being there at all.
  const withTasks = phases.filter((p) => p.title.length > 0 && p.tasks.length > 0);
  if (withTasks.length < phases.length) {
    adjustments.push(`dropped ${phases.length - withTasks.length} empty phase(s)`);
    phases = withTasks;
  }

  if (phases.length < MIN_PHASES) {
    throw new RoadmapUnusableError("The model returned too few usable phases.");
  }

  // [observed] phase count out of range 22×.
  if (phases.length > MAX_PHASES) {
    adjustments.push(`kept the first ${MAX_PHASES} of ${phases.length} phases`);
    phases = phases.slice(0, MAX_PHASES);
  }

  // Renumber after every drop, so ids stay dense and match task id prefixes.
  phases.forEach((phase, i) => {
    phase.id = i + 1;
    phase.tasks = phase.tasks.map((t, ti) => ({ ...t, id: `p${i + 1}_t${ti + 1}` }));
  });

  // ---- phase deadlines ----------------------------------------------------
  let monotonic = true;
  let previous = 0;
  for (const phase of phases) {
    const day = phase.recommendedByDay;
    if (day === undefined || day <= previous || day > durationDays) {
      monotonic = false;
      break;
    }
    previous = day;
  }
  if (!monotonic || phases[phases.length - 1].recommendedByDay !== durationDays) {
    redistribute(phases, durationDays);
    adjustments.push("rescheduled phase deadlines to fit your horizon");
  }

  // ---- weekly rhythm ------------------------------------------------------
  // D13: the model emits seven enum keys; labels and colours are ours, so the
  // orphan-focusType failure mode simply cannot occur. `buildWeekSchedule`
  // substitutes "focus" for anything unrecognised and pads a short array.
  const rawWeek = Array.isArray(root.weekSchedule) ? root.weekSchedule : [];
  const keys = rawWeek.map((k) => (typeof k === "string" ? k : ""));
  if (keys.length !== DAY_NAMES.length) {
    adjustments.push("filled in a full seven-day week");
  }
  const weekSchedule = buildWeekSchedule(keys);

  // [observed] 3B produced weeks where all seven days were identical —
  // structurally valid, completely useless as a rhythm. Not worth failing the
  // generation over, but the user should know it wasn't really planned.
  const distinct = new Set(weekSchedule.map((d) => d.type));
  if (distinct.size === 1) {
    weekSchedule[5] = { name: "Sat", type: "review", label: "Review" };
    weekSchedule[6] = { name: "Sun", type: "rest", label: "Rest" };
    adjustments.push("added a review and rest day to a repetitive week");
  }

  // ---- materials, portfolio, rotations ------------------------------------
  const materials = validateMaterials(root.materials);
  const portfolio = validatePortfolio(root.portfolio);
  const rotations = validateRotations(root.rotations, weekSchedule);

  const droppedRotations = (Array.isArray(root.rotations) ? root.rotations.length : 0) - rotations.length;
  if (droppedRotations > 0) {
    adjustments.push(`dropped ${droppedRotations} rotation(s) with no items or no usable days`);
  }

  return {
    name,
    color,
    phases,
    weekSchedule,
    focusTypes: buildFocusTypes(weekSchedule),
    materials,
    portfolio,
    rotations,
    adjustments,
  };
}
