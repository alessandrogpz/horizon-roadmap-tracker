/**
 * Three tracks with a year of plausible history behind them.
 *
 * Every screen that shows more than one track — the switcher's stack of
 * heatmaps, the combined grid in Progress — is impossible to look at with one
 * track and no history, which is what a real account looks like for its first
 * month. Making them by hand means ticking several hundred days.
 *
 * The history is generated from a fixed seed, so the same three tracks come
 * out the same every time. That matters more than it sounds: a screenshot of
 * a bug in "test2" is worth something only if test2 is the same track
 * tomorrow.
 *
 * They are ordinary tracks in every other respect — no flag, no hidden mode.
 * Delete them like any other.
 */

import { formatDateYMD, parseYMD } from "./dates";
import { rebuildStreakHistory } from "./streak";
import { seedTrackFromTemplate, TEMPLATES } from "./templates";
import { TRACK_COLORS } from "./trackColors";
import type { CompletedItem, TrackState } from "./types";

export const DEMO_TRACK_NAMES = ["test1", "test2", "test3"] as const;

/** Named, not flagged. A flag would have to be understood by the sync merge
 *  and by every screen that lists tracks; a name has to be understood by this
 *  file alone. */
export function isDemoTrack(track: Pick<TrackState, "meta">): boolean {
  return (DEMO_TRACK_NAMES as readonly string[]).includes(track.meta.name);
}

interface Recipe {
  name: string;
  color: string;
  /** How far back the track runs, and how much of it got done. */
  days: number;
  /** How long it was *planned* to run, as a multiple of how long it has been
   *  running. Above one, so the progress ring beside the track is part-way
   *  round rather than closed — three closed rings say nothing about three
   *  tracks. */
  plannedOver: number;
  density: number;
  /** How much the days clump. 0 is a coin flip per day; near 1 is long runs
   *  with long gaps, which is what a real habit looks like. */
  clumping: number;
  seed: number;
}

const RECIPES: Recipe[] = [
  { name: "test1", color: TRACK_COLORS[0], days: 400, plannedOver: 1.15, density: 0.68, clumping: 0.55, seed: 0x5eed01 },
  { name: "test2", color: TRACK_COLORS[2], days: 250, plannedOver: 2.6, density: 0.46, clumping: 0.72, seed: 0x5eed02 },
  { name: "test3", color: TRACK_COLORS[4], days: 520, plannedOver: 1.6, density: 0.33, clumping: 0.8, seed: 0x5eed03 },
];

/**
 * What a day's work is called.
 *
 * Deliberately vague about the subject: these three tracks stand in for a
 * course, a training plan and a job hunt, and anything specific would be
 * wrong for two of them. "test1 item 1" was worse — it is the sort of thing
 * that is fine in a fixture and embarrassing the moment a day is opened.
 */
const THINGS_DONE = [
  "Worked through a chapter",
  "Logged a session",
  "Practised for an hour",
  "Shipped a small piece",
  "Reviewed yesterday's work",
  "Read for thirty minutes",
  "Closed off a loose end",
  "Wrote up what I learned",
];

/** mulberry32: eight lines, good enough for dummy data, and identical on every
 *  platform — which `Math.random` seeded by nothing is not. */
function randomFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDemoTracks(todayStr: string): TrackState[] {
  const template = TEMPLATES.custom;
  return RECIPES.map((recipe) => {
    const start = parseYMD(todayStr);
    start.setDate(start.getDate() - (recipe.days - 1));
    const startDate = formatDateYMD(start);

    const completedItemsHistory = historyFor(recipe, startDate, todayStr);
    const track = seedTrackFromTemplate(template, {
      name: recipe.name,
      color: recipe.color,
      startDate,
      // Planned past today, so the track has a real position on its own
      // timeline — a phase plan that ends exactly where the history does is a
      // track at 100% before anyone has looked at it.
      phases: template.buildPhases(Math.round(recipe.days * recipe.plannedOver)),
      weekSchedule: template.defaultWeekSchedule,
      focusTypes: template.defaultFocusTypes,
    });

    return {
      ...track,
      completedItemsHistory,
      streakHistory: rebuildStreakHistory(completedItemsHistory),
    };
  });
}

/** A year or two of days, clumped into runs. */
function historyFor(recipe: Recipe, startDate: string, todayStr: string): Record<string, CompletedItem[]> {
  const random = randomFrom(recipe.seed);
  const history: Record<string, CompletedItem[]> = {};
  const cursor = parseYMD(startDate);
  const end = parseYMD(todayStr);
  // Yesterday's answer, carried forward with `clumping` probability. This is
  // the whole difference between a habit and static: an independent coin per
  // day gives an even grey wash with no runs in it anywhere.
  let active = random() < recipe.density;

  while (cursor <= end) {
    active = random() < recipe.clumping ? active : random() < recipe.density;
    if (active) {
      // One to four things, weighted low: four is the top of the shade scale
      // and should be a good day, not an average one.
      const count = 1 + Math.floor(random() ** 2 * 4);
      const first = Math.floor(random() * THINGS_DONE.length);
      history[formatDateYMD(cursor)] = Array.from({ length: count }, (_, index) => ({
        // Walked rather than re-rolled, so a day never lists the same thing
        // twice — which reads as a bug rather than as a busy day.
        title: THINGS_DONE[(first + index) % THINGS_DONE.length],
        description: "Sample data",
      }));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // The last few days are always done, so every demo track has a live streak
  // to show rather than one that happened to end last Tuesday.
  const tail = parseYMD(todayStr);
  for (let back = 0; back < 3 + Math.floor(random() * 6); back += 1) {
    const date = formatDateYMD(tail);
    if (date < startDate) break;
    if (!history[date]) history[date] = [{ title: THINGS_DONE[0], description: "Sample data" }];
    tail.setDate(tail.getDate() - 1);
  }

  return history;
}
