import type { PanelColumns, TrackState } from "./types";

export type ColumnId = "left" | "right";

export interface ModuleDefinition {
  id: string;
  /** Shown in the header's Modules menu. */
  label: string;
  /** Which column the module sits in by default, and returns to when reopened. */
  homeColumn: ColumnId;
  /** Asked for rather than assumed: absent from a new track's layout, and not
   *  appended to an existing one when it appears in a later version. Everything
   *  else is shown unless explicitly closed, which is right for a panel most
   *  tracks want and wrong for one most tracks do not — a gym panel on a track
   *  about a database course is noise nobody asked for. */
  optIn?: boolean;
}

/**
 * Every dashboard module, in the order they appear by default.
 *
 * The labels name the thing, not a use for it. "Weekly Study Plan" assumed
 * every track was about studying, which stopped being true the moment a track
 * could be about training or anything else; and "Roadmap Timeline" sat one
 * letter away from the Roadmap *document*, which is a different thing
 * entirely.
 *
 * This is the source of truth for *which* modules exist. It stays free of
 * React so the layout logic below (and its tests) can run headless; each id's
 * icon and actual panel live in components/panels/registry.tsx, which is typed
 * against `ModuleId` — so a module added here without a matching panel is a
 * compile error rather than a blank space on the dashboard.
 */
export const MODULES = [
  { id: "weeklyPlan", label: "Weekly Overview", homeColumn: "left" },
  { id: "phaseTracker", label: "Phases", homeColumn: "left" },
  { id: "streakGraph", label: "Consistency", homeColumn: "left" },
  { id: "pomodoroTimer", label: "Timer", homeColumn: "left" },
  { id: "portfolioTracker", label: "Deliverables", homeColumn: "right" },
  { id: "materialsTracker", label: "Materials", homeColumn: "right" },
  { id: "notepad", label: "Notepad", homeColumn: "right" },
  { id: "todoList", label: "To-do List", homeColumn: "right" },
  { id: "gym", label: "Gym plan", homeColumn: "right", optIn: true },
] as const satisfies readonly ModuleDefinition[];

export type ModuleId = (typeof MODULES)[number]["id"];

export const MODULE_IDS: readonly string[] = MODULES.map((m) => m.id);

/** `as const satisfies` narrows each entry to its own literal type, so a
 *  module that does not declare `optIn` has no such property to read. This
 *  asks the question once, in one place, instead of widening the whole list. */
export const isOptIn = (id: string): boolean =>
  MODULES.some((module) => module.id === id && "optIn" in module && module.optIn === true);

/** Fresh copy each call — never share one object across tracks, or two tracks
 *  would alias the same array and edits to one would silently affect the other. */
export const defaultPanelColumns = (): PanelColumns => ({
  left: MODULES.filter((m) => m.homeColumn === "left" && !isOptIn(m.id)).map((m) => m.id),
  right: MODULES.filter((m) => m.homeColumn === "right" && !isOptIn(m.id)).map((m) => m.id),
});

/** Which column a module returns to when reopened. */
export const homeColumnFor = (id: string): ColumnId =>
  MODULES.find((m) => m.id === id)?.homeColumn ?? "left";

/**
 * The track's effective layout for rendering: its stored visible columns, plus
 * any known module that's neither placed nor explicitly hidden appended to its
 * home column (so a module added in a future version shows up by default rather
 * than silently vanishing). Pure — returns fresh arrays.
 */
export function resolveTrackLayout(track: Pick<TrackState, "panelColumns" | "hiddenPanels">): {
  columns: PanelColumns;
  hidden: string[];
} {
  const stored = track.panelColumns ?? defaultPanelColumns();
  const hidden = track.hiddenPanels ?? [];
  const left = [...stored.left];
  const right = [...stored.right];
  const accountedFor = new Set([...left, ...right, ...hidden]);

  for (const id of MODULE_IDS) {
    // Opt-in modules are not placed for someone who has never asked for one;
    // they wait in the modules menu instead.
    if (isOptIn(id) || accountedFor.has(id)) continue;
    (homeColumnFor(id) === "right" ? right : left).push(id);
  }
  return { columns: { left, right }, hidden };
}
