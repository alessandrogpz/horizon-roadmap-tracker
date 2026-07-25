import type { PanelColumns, TrackState } from "./types";

/** The dashboard modules, in a stable order, with the labels shown in the
 *  Modules menu. Kept here (not in a component) so both the render/migration
 *  logic and the menu draw from one source of truth. Icons live in the menu
 *  component, since they're React nodes. */
export const MODULES: { id: string; label: string }[] = [
  { id: "weeklyPlan", label: "Weekly Study Plan" },
  { id: "phaseTracker", label: "Roadmap Timeline" },
  { id: "streakGraph", label: "Consistency Streak" },
  { id: "pomodoroTimer", label: "Focus Timer" },
  { id: "portfolioTracker", label: "Portfolio Deliverables" },
  { id: "materialsTracker", label: "Materials" },
];

export const MODULE_IDS = MODULES.map((m) => m.id);

/** Fresh copy each call — never share one object across tracks, or two tracks
 *  would alias the same array and edits to one would silently affect the other. */
export const defaultPanelColumns = (): PanelColumns => ({
  left: ["weeklyPlan", "phaseTracker", "streakGraph", "pomodoroTimer"],
  right: ["portfolioTracker", "materialsTracker"],
});

/** Which column a module returns to when reopened, derived from the default. */
const DEFAULT_HOME: Record<string, "left" | "right"> = (() => {
  const cols = defaultPanelColumns();
  const home: Record<string, "left" | "right"> = {};
  cols.left.forEach((id) => (home[id] = "left"));
  cols.right.forEach((id) => (home[id] = "right"));
  return home;
})();

export const homeColumnFor = (id: string): "left" | "right" => DEFAULT_HOME[id] ?? "left";

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
    if (!accountedFor.has(id)) {
      (homeColumnFor(id) === "right" ? right : left).push(id);
    }
  }
  return { columns: { left, right }, hidden };
}
