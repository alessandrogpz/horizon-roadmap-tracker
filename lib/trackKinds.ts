// What a track is roughly about, and the only thing that follows from it.
//
// A kind decides which panels a *new* track opens with. That is all it does,
// and the restraint is the point: hiding panels by kind would be the version
// that bites, because real tracks are hybrid — the student who also lifts
// wants the gym panel on a track filed under "studies", and an app that
// decided otherwise would produce the unanswerable question "where did it
// go?". There is no affordance for "this exists but is not offered here".
//
// So every panel stays available to every track, from the Arrange list, for
// ever. A kind is a better starting point, not a smaller app: it spares a new
// fitness track a roadmap timeline it will never use, and costs two taps to
// overrule.

import { MODULES } from "./modules";

/** Keyed to the template ids, because the template *is* the kind: picking
 *  "Fitness" when creating a track already says what the track is about, and
 *  asking the same question twice in one form would be absurd. */
export type TrackKind = "learning" | "work" | "fitness" | "custom";

export interface TrackKindDefinition {
  id: TrackKind;
  label: string;
  /** One line, so choosing is not a guess. */
  hint: string;
  /** Panels this kind starts with. Everything else begins hidden and is one
   *  tap away in Arrange. */
  panels: string[];
}

const ALL = MODULES.map((module) => module.id as string);

export const TRACK_KINDS: TrackKindDefinition[] = [
  {
    id: "learning",
    label: "Learning",
    hint: "A course, a subject, a book you are working through",
    panels: ["weeklyPlan", "phaseTracker", "materialsTracker", "streakGraph", "notepad", "todoList"],
  },
  {
    id: "work",
    label: "Work",
    hint: "A project with things to deliver",
    panels: ["weeklyPlan", "phaseTracker", "portfolioTracker", "streakGraph", "todoList", "notepad"],
  },
  {
    id: "fitness",
    label: "Fitness",
    hint: "Training, with a weekly split and sets to log",
    panels: ["gym", "weeklyPlan", "streakGraph", "steps", "notepad"],
  },
  {
    id: "custom",
    label: "Custom",
    hint: "Start with everything and take away what you do not want",
    panels: [...ALL],
  },
];

export const trackKind = (id: string | undefined): TrackKindDefinition =>
  TRACK_KINDS.find((kind) => kind.id === id) ?? TRACK_KINDS[TRACK_KINDS.length - 1];

/**
 * The panels a new track of this kind should *not* start with.
 *
 * Expressed as what to hide rather than what to show, because that is what the
 * app actually stores: `hiddenPanels` is the field, and a panel absent from it
 * is visible. Phone-only panels — the gym, the step counter — are not in
 * `MODULES`, so they are added explicitly when a kind wants them and left out
 * otherwise.
 */
export function hiddenPanelsFor(kind: TrackKind, everyPanelId: string[]): string[] {
  const wanted = new Set(trackKind(kind).panels);
  return everyPanelId.filter((id) => !wanted.has(id));
}
