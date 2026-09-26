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
import { streakStats, timelineStats, yearCalendar } from "@/lib/stats";

/** Fixed on purpose. See above. */
export const PREVIEW_TODAY = "2026-09-26";

const NAMES = ["Graphics & engine dev", "Half marathon", "Land the senior role"];

const demo = buildDemoTracks(PREVIEW_TODAY);

export const PREVIEW_TRACKS = demo.map((track, index) => ({
  id: track.meta.id,
  name: NAMES[index] ?? track.meta.name,
  color: track.meta.color,
  startDate: track.startDate,
  days: yearCalendar(track.completedItemsHistory, track.startDate, 2026, PREVIEW_TODAY, "mon"),
  pct: timelineStats(track).progressPct,
  streak: currentStreakLength(track.streakHistory, PREVIEW_TODAY),
  stats: streakStats(track, PREVIEW_TODAY),
}));

/** The one the phone screens are "inside". */
export const PREVIEW_TRACK = PREVIEW_TRACKS[0];

/**
 * The last nine weeks of it, oldest first, as the phone draws them: seven
 * columns wide running *down* the page. The website's grid turns ninety
 * degrees on a phone, because seven cells across 375 points is the only size
 * at which a day is still big enough to press.
 */
export const PREVIEW_WEEKS = (() => {
  const days = PREVIEW_TRACK.days.filter((day) => day.date);
  const tail = days.slice(-63);
  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < tail.length; i += 7) weeks.push(tail.slice(i, i + 7));
  return weeks;
})();
