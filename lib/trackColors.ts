/**
 * The colours a track can wear.
 *
 * A fixed set rather than a colour picker, for two reasons. A picker is a
 * native module on the phone and a second one on the web; and a free choice
 * lets someone pick a colour the app then has to work around — the consistency
 * grid paints a track's days in its colour at four strengths, and a colour
 * near the page's own is four shades of nothing.
 *
 * White and black are deliberately absent, and must stay absent: the day a
 * track began is drawn in the page's opposite — white on a dark screen, black
 * on a light one — so that it is findable whatever colour the track is. Offer
 * white here and that mark would vanish on exactly one track.
 */
export const TRACK_COLORS = [
  "#0ea5e9", // sky
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#a855f7", // violet
  "#64748b", // slate
] as const;

/** The first colour nobody has taken, for offering as a default. Falls back to
 *  the first: six colours and no cap on tracks means a repeat is allowed, it
 *  just should not be what happens by itself. */
export function firstFreeColor(taken: Iterable<string | undefined>): string {
  const used = new Set(taken);
  return TRACK_COLORS.find((color) => !used.has(color)) ?? TRACK_COLORS[0];
}
