// The same palette as the web app, so the two feel like one product.
//
// Taken from the CSS custom properties in ../../app/globals.css. They can't be
// imported here — React Native has no CSS — which is a small, concrete example
// of what does and doesn't cross the platform boundary: logic travels, styling
// does not (MOBILE_PLAN.md §3).

/** The five shades a day can take in the consistency grid, from "nothing" to
 *  "a lot", matching the web app's `--streak-0` … `--streak-4`. */
export type StreakShades = readonly [string, string, string, string, string];

export interface Palette {
  background: string;
  foreground: string;
  mutedForeground: string;
  subtleForeground: string;
  accent: string;
  card: string;
  cardBorder: string;
  surfaceMuted: string;
  success: string;
  danger: string;
  streak: StreakShades;
}

export const DARK: Palette = {
  background: "#0a0a0c",
  foreground: "#e7e7ea",
  mutedForeground: "#8b8b94",
  // 4.54:1 on surfaceMuted over the card (#18181c), which is the lightest
  // surface this tier lands on and so the worst case; 4.85 on the card
  // itself. #6b6b74 read 3.60 and failed AA for the small labels it carries.
  subtleForeground: "#808088",
  accent: "#0ea5e9",
  card: "#101014",
  cardBorder: "rgba(255, 255, 255, 0.08)",
  surfaceMuted: "rgba(255, 255, 255, 0.035)",
  success: "#10b981",
  danger: "#f87171",
  streak: ["#17171b", "#0b5747", "#068466", "#10b981", "#4ade80"],
};

export const LIGHT: Palette = {
  background: "#fbfbfc",
  foreground: "#0a0a0b",
  mutedForeground: "#5a5a63",
  subtleForeground: "#74747d",
  accent: "#0284c7",
  card: "#ffffff",
  cardBorder: "rgba(0, 0, 0, 0.1)",
  surfaceMuted: "rgba(0, 0, 0, 0.03)",
  success: "#059669",
  danger: "#dc2626",
  streak: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
/**
 * The type scale: nine sizes, and no others.
 *
 * There were sixteen distinct font sizes in this app — 9, 10, 11, 12, 13, 14,
 * 15, 16, 17, 18, 19, 20, 22, 24, 30, 72 — each chosen where it was written.
 * Seven were heading-ish numbers doing what turned out to be three jobs, and
 * three adjacent sizes carried most of the body text between them. Sizes
 * picked one at a time cannot help but disagree, and an interface whose text
 * disagrees with itself by a point here and there reads as approximate however
 * carefully each screen was made.
 *
 * These are roles rather than measurements: what a piece of text *is* decides
 * how big it is, and there is one answer per role. Spread the role first in a
 * style and set colour and weight after it.
 *
 * Deliberately size only. An earlier version gave each role a weight too,
 * which quietly turned every muted 13pt explanation semi-bold because the role
 * that fitted its size was the one meant for control labels. Weight belongs to
 * the individual style: two texts can be the same size and mean differently.
 */
export const TYPE = {
  /** The timer's clock. One thing in the app is this big, on purpose. */
  display: { fontSize: 72 },
  /** A number that is the whole point of its tile — a streak, a step count. */
  figure: { fontSize: 26 },
  /** A screen's own headline, under the bar that names it. */
  title: { fontSize: 20 },
  /** Modal titles, card headlines, the top level of a document. */
  heading: { fontSize: 17 },
  /** The name of a thing in a list, a panel or a row. */
  subhead: { fontSize: 15 },
  /** Reading text: sentences meant to be read rather than scanned. */
  body: { fontSize: 14 },
  /** Controls, chips, row labels, and the prose that sits under them. */
  label: { fontSize: 13 },
  /** Secondary text, sitting under something it explains. */
  caption: { fontSize: 12 },
  /** The smallest thing that still has to be read — axis labels, counts. */
  micro: { fontSize: 11 },
  /** Small-caps markers over a section: a size and the treatment together. */
  eyebrow: { fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" },
} as const;

// The colour helpers live in the shared core, because the website draws the
// same grid from the same numbers. Re-exported here so that everything on the
// phone still reaches for them where it reaches for the rest of the theme.
export { shadeOf, withAlpha, shadeScale, lighten, SHADE_STEPS } from "@shared/colors";

export const RADIUS = { control: 8, card: 14 } as const;

/** Every control in the app header — the sync chip, the theme button, the
 *  menu — is this tall, with this radius and this border. They were three
 *  different sizes because each was written on its own day; a row of controls
 *  that disagree about their own height reads as unfinished however good each
 *  one is in isolation. */
export const HEADER_CONTROL = {
  height: 30,
  minWidth: 32,
  radius: RADIUS.control,
  paddingHorizontal: SPACING.sm,
} as const;
