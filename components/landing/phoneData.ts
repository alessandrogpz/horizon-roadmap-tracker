/**
 * The data behind the landing page's phone screens and track stack.
 *
 * Built from `buildDemoTracks` — the same three tracks the app will put in
 * your workspace from Settings — pinned to a fixed date so that the server
 * and the browser render the same pixels, and so that nothing on this page
 * changes at midnight. What the landing shows is therefore exactly what the
 * app gives you, which is the only honest way to draw a screenshot.
 *
 * Only the names are overridden: "test1" is the right name for a dummy track
 * and the wrong one for a landing page.
 */

import { buildDemoTracks } from "@/lib/demoTracks";
import { currentStreakLength } from "@/lib/streak";
import { monthCalendar, streakStats, timelineStats, yearCalendar } from "@/lib/stats";
import { dayForDate } from "@/lib/dates";

/** Fixed on purpose. See above. */
export const PREVIEW_TODAY = "2026-09-26";

/**
 * What the three tracks are called, and the handful of things a real track
 * would have written into it that a generated one cannot invent: what its
 * current phase is about, and what it is working through. The days, the
 * streaks and the timeline are all real output from the generator.
 */
const DRESSING = [
  {
    name: "Graphics & engine dev",
    phase: "Rasterizer & pipeline",
    deliverables: ["Software rasterizer", "OBJ loader"],
    materials: ["Real-Time Rendering", "PBR, 3rd ed."],
    focus: ["Focus", "Focus", "Focus", "Focus", "Focus", "Review", "Free"],
  },
  {
    name: "Half marathon",
    phase: "Build the base",
    deliverables: ["Sub-2:00 at the 10k", "Long run past 18km"],
    materials: ["80/20 Running", "Club plan, week 12"],
    focus: ["Easy", "Intervals", "Rest", "Tempo", "Easy", "Long", "Rest"],
  },
  {
    name: "Land the senior role",
    phase: "Get visible",
    deliverables: ["Portfolio site", "Two write-ups published"],
    materials: ["Staff Engineer", "System design primer"],
    focus: ["Apply", "Build", "Build", "Apply", "Write", "Review", "Free"],
  },
];

const demo = buildDemoTracks(PREVIEW_TODAY);

/** How many weeks of the year the landing's stacked preview shows. Enough to
 *  fill the card it sits in, ending on today. */
const PREVIEW_WEEKS_SHOWN = 26;

export const PREVIEW_TRACKS = demo.map((track, index) => ({
  id: track.meta.id,
  ...DRESSING[index % DRESSING.length],
  color: track.meta.color,
  startDate: track.startDate,
  /** The whole year, for the grid the dashboard preview draws. */
  months: monthCalendar(track.completedItemsHistory, track.startDate, 2026, PREVIEW_TODAY, "mon"),
  history: track.completedItemsHistory,
  timeline: timelineStats(track),
  dayOfTrack: dayForDate(track.startDate, PREVIEW_TODAY),
  // The recent end of the year, not its start. A calendar year begins in
  // January and a track rarely does, so the whole year drawn from the left is
  // mostly the blank months before anything happened — which is a poor
  // advertisement for a consistency graph.
  days: yearCalendar(track.completedItemsHistory, track.startDate, 2026, PREVIEW_TODAY, "mon").slice(-PREVIEW_WEEKS_SHOWN * 7),
  pct: timelineStats(track).progressPct,
  streak: currentStreakLength(track.streakHistory, PREVIEW_TODAY),
  stats: streakStats(track, PREVIEW_TODAY),
}));

export type PreviewTrack = (typeof PREVIEW_TRACKS)[number];

/** The one the phone screens are "inside". */
export const PREVIEW_TRACK = PREVIEW_TRACKS[0];

/** The seven days of the week the dashboard preview lays out, with Saturday —
 *  which `PREVIEW_TODAY` is — as today. */
export const PREVIEW_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const PREVIEW_WEEK_DATES = ["09-21", "09-22", "09-23", "09-24", "09-25", "09-26", "09-27"];
export const PREVIEW_TODAY_INDEX = 5;

/**
 * The last seven weeks of it, oldest first, as the phone draws them: seven
 * columns wide running *down* the page. The website's grid turns ninety
 * degrees on a phone, because seven cells across 375 points is the only size
 * at which a day is still big enough to press.
 */
export const PREVIEW_WEEKS = (() => {
  const days = PREVIEW_TRACK.days.filter((day) => day.date);
  const tail = days.slice(-49);
  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < tail.length; i += 7) weeks.push(tail.slice(i, i + 7));
  return weeks;
})();
