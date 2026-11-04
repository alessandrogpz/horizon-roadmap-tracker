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

/** The same colour, mixed toward black. `lighten`'s counterpart, and the one
 *  that keeps a hue intact: every channel is scaled by the same factor, so the
 *  result is the same colour with the light turned down rather than a new one. */
export function darken(color: string, amount: number): string {
  const rgb = toRgb(color);
  if (!rgb) return color;
  const mix = (channel: number) => Math.round(channel * (1 - amount));
  return `#${rgb.map((channel) => mix(channel).toString(16).padStart(2, "0")).join("")}`;
}

/** A translucent colour resolved against what is behind it, as an opaque
 *  `#rrggbb`. Text on a wash of its own colour is the case this exists for:
 *  the wash moves the background *toward* the text, so measuring that text
 *  against the bare card reads better than the screen does. */
export function flatten(color: string, alpha: number, backdrop: string): string {
  const front = toRgb(color);
  const back = toRgb(backdrop);
  if (!front || !back) return backdrop;
  const mix = (i: number) => Math.round(front[i] * alpha + back[i] * (1 - alpha));
  return `#${[0, 1, 2].map((i) => mix(i).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** The WCAG contrast ratio between two opaque colours, 1 to 21. Returns 1 for
 *  anything this file cannot parse, so a caller can never read a pass out of a
 *  colour that was never measured. */
export function contrastRatio(a: string, b: string): number {
  const first = toRgb(a);
  const second = toRgb(b);
  if (!first || !second) return 1;
  const one = luminance(first);
  const two = luminance(second);
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

/**
 * The same hue, moved until it can be read against a given surface.
 *
 * The six track colours are picked to be told apart from each other, and they
 * were picked on a dark screen. On white, five of the six fail even the 3:1 a
 * control needs — sky reads 2.77, green 2.28, amber 2.15 — because a colour
 * bright enough to glow on #0a0a0c is a colour close to the paper in light
 * mode. The track's accent is not decoration: it is the ticked box, the link,
 * the number on a stat. So it moves.
 *
 * It moves along its own hue, never to a substitute colour, because the whole
 * point of a track's colour is telling one track from another. Toward black on
 * a light surface, toward white on a dark one, in small steps, stopping at the
 * first one that clears `target`. A colour that already passes is returned
 * untouched, which is why the dark theme is left exactly as it was.
 */
export function readableOn(color: string, surface: string, target = 4.5): string {
  const back = toRgb(surface);
  if (!toRgb(color) || !back) return color;
  if (contrastRatio(color, surface) >= target) return color;

  const STEPS = 50;
  const towardBlack = luminance(back) > 0.18;
  for (let step = 1; step <= STEPS; step++) {
    const moved = towardBlack ? darken(color, step / STEPS) : lighten(color, step / STEPS);
    if (contrastRatio(moved, surface) >= target) return moved;
  }
  // A surface no hue can be read on — mid-grey. Best effort, still deterministic.
  return towardBlack ? "#000000" : "#ffffff";
}

function toRgb(color: string): [number, number, number] | null {
  const hex = color.trim().replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const value = parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
