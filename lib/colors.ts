/**
 * A track's colour, at the strengths the rest of the app needs it.
 *
 * Shared because the two apps draw the same thing: the consistency grid is a
 * track's own colour at four strengths in both of them, and two
 * implementations of "four steps of one hue" is two ramps that drift.
 */

/** `#rrggbb` at an opacity, as `rgba()`. Returns the colour untouched if it is
 *  not a hex triple, because a palette value may be anything — a CSS variable
 *  on the web, a named colour, an `rgba()` already. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = toRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/** The four strengths a day can be drawn at, as fractions. Kept in one place
 *  because the grid, its key and the miniature in the track list all have to
 *  agree about what "two things done" looks like. */
export const SHADE_STEPS = [0.3, 0.52, 0.76, 1] as const;

/**
 * A track's colour at a given strength, for the consistency grid.
 *
 * Four steps of one hue rather than four fixed greens: a track is told apart
 * by its colour everywhere else in the app, and its own history is the last
 * place that should be painted somebody else's. The steps are alpha over
 * whatever is behind them, which keeps them legible in both themes without
 * needing two ramps.
 */
export function shadeOf(color: string, count: number, empty: string): string {
  if (count <= 0) return empty;
  return withAlpha(color, SHADE_STEPS[Math.min(count, SHADE_STEPS.length) - 1]);
}

/** The whole scale, lightest first — what the web needs, because it paints the
 *  grid through five CSS variables rather than per cell. */
export function shadeScale(color: string, empty: string): [string, string, string, string, string] {
  return [empty, shadeOf(color, 1, empty), shadeOf(color, 2, empty), shadeOf(color, 3, empty), shadeOf(color, 4, empty)];
}

/** The same colour, mixed toward white. What a hover state is: the accent,
 *  but lifted, rather than a second colour nobody chose. */
export function lighten(color: string, amount: number): string {
  const rgb = toRgb(color);
  if (!rgb) return color;
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `#${rgb.map((channel) => mix(channel).toString(16).padStart(2, "0")).join("")}`;
}

function toRgb(color: string): [number, number, number] | null {
  const hex = color.trim().replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const value = parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
