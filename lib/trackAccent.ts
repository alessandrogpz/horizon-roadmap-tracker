import { darken, flatten, lighten, readableOn, shadeOf, withAlpha } from "@/lib/colors";

/**
 * The surface each theme's accent is read on — the worst one, not the typical.
 *
 * Which end is "worst" flips with the theme, and that is the easy mistake:
 * light-mode ink is dark, so the surface that costs it the most is the
 * *darkest* one, while dark-mode ink is light and loses most on the
 * *lightest*. So light is the card under its deepest wash — `--surface-hover`
 * at 4% black over white, #f5f5f5 — rather than the bare white I first solved
 * against, which read a badge as passing at 4.5 when the screen gave 4.29. And
 * dark is the card plus the muted and hover washes that stack on it in an
 * inner row.
 */
const CARD = { light: "#f5f5f5", dark: "#17171b" } as const;

/**
 * How strong a wash of its own colour the text can be sitting on.
 *
 * This is the part that is easy to get wrong, and I did: solving a colour
 * against the bare card says it passes, and then it does not, because the
 * accent is usually written on a tint of itself — the open day, the active
 * tab, a focus badge. A same-hue tint moves the background *toward* the text,
 * so it costs contrast rather than adding it. These are the strongest washes
 * each one actually lands on: `bg-accent/15` is the deepest accent wash in the
 * app, and a focus badge sits on `withAlpha(colour, 0.2)`.
 */
const ACCENT_WASH = 0.15;
const INK_WASH = 0.2;

/**
 * Above the 4.5 that is actually required, because the surface this solves
 * against is a model of the real one and not the real one.
 *
 * The washes below are the ones this code can see. The app stacks more of
 * them, and each layer the model does not know about costs contrast. The
 * weekly plan is the worst case and the reason this number moved twice: a
 * focus tag sits on a 20% wash of its own colour, on a day card that is a 3%
 * white wash, on a panel, on the page. The model composites that to #17171b
 * plus one wash; the browser composites it to #153345. At 4.6 the model
 * reported 4.77 and the screen measured 4.42 — a real failure that the model
 * called a pass.
 *
 * So the margin absorbs the difference rather than this function learning
 * every surface in the app, which would mean the colour maths knowing the
 * layout. Verified by measuring the rendered page in both themes, not by
 * trusting the model: see the day-card tags in the weekly plan.
 */
const TARGET = 5.2;

/** The surface a colour has to be read on in a theme: its own wash, resolved
 *  against that theme's card. The raw colour is used for the wash because it
 *  is the most saturated version, and so the worst one to read on. */
function surfaceFor(color: string, theme: keyof typeof CARD, wash: number): string {
  return flatten(color, wash, CARD[theme]);
}

/**
 * One track colour, as the whole accent system, twice — once per theme.
 *
 * The track colours are chosen to be told apart from each other, and they were
 * chosen on a dark screen; on white, sky reads 2.77, green 2.28, amber 2.15.
 * The accent is not decoration here — it is the ticked box, the link, the
 * number on a stat — so each theme gets the colour moved along its own hue
 * until it can be read there. A colour that already passes comes back
 * untouched, which in dark is every one of them but slate.
 *
 * Hover lifts on dark and deepens on light: both move away from the page,
 * which is the direction that reads as "more", and neither spends the contrast
 * just bought.
 *
 * Exported as a plain object so the page can write it onto `<html>` and the
 * landing page's preview card can put the same thing in a `style` prop.
 */
export function trackAccentVariables(color: string): Record<string, string> {
  const variables: Record<string, string> = {};

  for (const theme of ["light", "dark"] as const) {
    const accent = readableOn(color, surfaceFor(color, theme, ACCENT_WASH), TARGET);
    const hover = theme === "light" ? darken(accent, 0.18) : lighten(accent, 0.22);

    variables[`--track-accent-${theme}`] = accent;
    variables[`--track-accent-hover-${theme}`] = hover;
    variables[`--track-accent-muted-${theme}`] = withAlpha(accent, 0.35);
    // Full strength, not a wash. At 45% the ring composited to 2.25 against
    // the page and 2.27 against a panel in dark, 2.04 in light — against the
    // 3:1 that WCAG 2.2 SC 1.4.11 asks of a non-text indicator. The alpha
    // was buying softness on the one element whose entire job is to be
    // unmistakable. At full opacity the same hue reads 7.14 and 5.74.
    variables[`--track-ring-${theme}`] = accent;
    // `transparent` as the empty step, because these four are only ever used
    // for days that have something on them; the empty one keeps its own
    // variable, set by the theme.
    for (const step of [1, 2, 3, 4]) {
      variables[`--track-streak-${step}-${theme}`] = shadeOf(accent, step, "transparent");
    }
  }

  return variables;
}

/**
 * A track's or focus type's colour as *ink* — text, rather than a fill.
 *
 * The colour does two jobs and only one of them is this. As a fill — the dot
 * beside a name, the wash behind a badge, a ticked box — it stays exactly the
 * colour the person picked, because that is what tells two of them apart, and
 * a solid shape beside its own label is not being read. As ink it is text,
 * small and usually bold: a streak count, a focus label. That has to clear 4.5
 * on the tinted surface it sits on, and the defaults are pastels chosen for a
 * dark screen — #a78bfa reads 2.42 on white. A type's colour is the user's to
 * pick, so no set of better defaults would fix this.
 *
 * Returns the pair as custom properties so the caller can be a server
 * component with no idea which theme is on; `.track-ink` in globals.css picks.
 */
export function trackInkVariables(color: string): Record<string, string> {
  return {
    "--ink-light": readableOn(color, surfaceFor(color, "light", INK_WASH), TARGET),
    "--ink-dark": readableOn(color, surfaceFor(color, "dark", INK_WASH), TARGET),
  };
}
