// Which panels a track shows on the phone, and in what order.
//
// The panel model itself is shared with the website (`@shared/modules`): the
// same module ids, the same `hiddenPanels` on the track, so closing the
// notepad on the phone closes it on the laptop. That is the half worth
// sharing — "which panels do I want" is the same question on both.
//
// The order is not shared, and the split is deliberate. The website arranges
// two columns; a phone has one. A phone writing its single order into
// `panelColumns` would flatten the laptop's layout every time someone dragged
// something on a train, so the order lives on the device (storage/deviceSettings)
// and only membership travels.
//
// One module exists here that does not exist on the website: the step counter.
// A browser has no pedometer, so there is nothing for the website to show — but
// `hiddenPanels` is a list of strings the server stores without interpreting,
// so a phone-only id costs nothing and syncs harmlessly.

import type { TrackState } from "@shared/types";
import { MODULES, MODULE_IDS } from "@shared/modules";
import { panelOrder } from "../storage/deviceSettings";

/** The step counter, which only a phone can offer. */
export const STEPS_PANEL = "steps";

export interface PanelDefinition {
  id: string;
  label: string;
  /** One line in the "add a panel" list, so the choice is not a guess. */
  hint: string;
}

const HINTS: Record<string, string> = {
  weeklyPlan: "The week at a glance, and what each day is for",
  phaseTracker: "Where you are on the roadmap",
  streakGraph: "The run of days you have shown up",
  pomodoroTimer: "Twenty-five minutes of work, five of rest — for anything, not just study",
  portfolioTracker: "The things this track has to produce",
  materialsTracker: "What you are reading, and how far in",
  notepad: "Somewhere to put a thought",
  todoList: "Loose ends that are not part of a day",
  [STEPS_PANEL]: "This phone's step counter — for tracks where walking counts",
};

/** Every panel the phone can show: the website's, plus the step counter. */
export const PANELS: PanelDefinition[] = [
  ...MODULES.map((m) => ({ id: m.id as string, label: m.label, hint: HINTS[m.id] ?? "" })),
  { id: STEPS_PANEL, label: "Step Counter", hint: HINTS[STEPS_PANEL] },
];

const ALL_IDS = PANELS.map((p) => p.id);

export const panelDefinition = (id: string): PanelDefinition | undefined =>
  PANELS.find((p) => p.id === id);

/**
 * The panels to render, in this phone's order.
 *
 * A panel the device has no opinion about is appended rather than dropped, so
 * a module added in a later version turns up instead of silently vanishing —
 * the same rule `resolveTrackLayout` follows on the website.
 *
 * The step counter is the one exception to "shown unless hidden": it is hidden
 * unless asked for. A step count is exactly right on a fitness track and pure
 * noise on a graphics engine, and defaulting it on would put it on every track
 * anyone ever makes.
 */
export function visiblePanels(track: Pick<TrackState, "meta" | "hiddenPanels">): string[] {
  const hidden = new Set(track.hiddenPanels ?? []);
  const stored = panelOrder(track.meta?.id).filter((id) => ALL_IDS.includes(id));
  const seen = new Set(stored);

  const rest = ALL_IDS.filter((id) => !seen.has(id));
  return [...stored, ...rest].filter((id) =>
    id === STEPS_PANEL ? !hidden.has(id) && seen.has(id) : !hidden.has(id)
  );
}

/** Panels that exist but are not being shown, for the "add a panel" list. */
export function availablePanels(track: Pick<TrackState, "meta" | "hiddenPanels">): PanelDefinition[] {
  const shown = new Set(visiblePanels(track));
  return PANELS.filter((p) => !shown.has(p.id));
}

/**
 * Shows or hides a panel.
 *
 * Hiding only removes it from the view — the data behind it is never touched,
 * which is what makes this safe to do casually. `MODULE_IDS` is consulted so a
 * website module dropped from `hiddenPanels` returns to the website too.
 */
export function setPanelHidden(track: TrackState, id: string, hidden: boolean): TrackState {
  const current = new Set(track.hiddenPanels ?? []);
  if (hidden) current.add(id);
  else current.delete(id);

  const next: TrackState = { ...track, hiddenPanels: [...current] };

  // Re-opening a website module also has to put it back in a column, or
  // `resolveTrackLayout` will append it to its home column on the next load
  // and the laptop will have quietly moved it.
  if (!hidden && MODULE_IDS.includes(id) && track.panelColumns) {
    const inAColumn = [...track.panelColumns.left, ...track.panelColumns.right].includes(id);
    if (!inAColumn) {
      next.panelColumns = { ...track.panelColumns, left: [...track.panelColumns.left, id] };
    }
  }
  return next;
}
