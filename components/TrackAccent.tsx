"use client";

import { useEffect } from "react";
import { lighten, shadeOf, withAlpha } from "@/lib/colors";

/**
 * The open track's colour, applied to the whole page.
 *
 * Every accent in this app already reads from a handful of CSS variables, so
 * a track wearing its own colour is those variables being rewritten when the
 * track changes rather than a colour threaded through every component. The
 * consistency grid goes with them: `--streak-1` … `--streak-4` are four
 * strengths of the same hue, so a track's history is drawn in the track's own
 * ink rather than in a green that belongs to no track in particular.
 *
 * `--streak-0` is left alone. It is the colour of a day with nothing on it,
 * which belongs to the page and not to the track — and in light mode it is the
 * only one of the five that has to stay readable against white.
 *
 * Written on `<html>`, above the theme's own `[data-theme]` block, so the
 * cascade puts it on top of both themes without either needing to know.
 */
const VARIABLES = ["--accent", "--accent-hover", "--accent-muted", "--ring", "--streak-1", "--streak-2", "--streak-3", "--streak-4"];

export default function TrackAccent({ color }: { color?: string }) {
  useEffect(() => {
    const root = document.documentElement;
    if (!color) {
      VARIABLES.forEach((name) => root.style.removeProperty(name));
      return;
    }

    root.style.setProperty("--accent", color);
    root.style.setProperty("--accent-hover", lighten(color, 0.22));
    root.style.setProperty("--accent-muted", withAlpha(color, 0.35));
    root.style.setProperty("--ring", withAlpha(color, 0.45));
    // `transparent` as the empty step, because these four are only ever used
    // for days that have something on them; the empty one keeps its own
    // variable, set by the theme.
    [1, 2, 3, 4].forEach((step) => {
      root.style.setProperty(`--streak-${step}`, shadeOf(color, step, "transparent"));
    });

    return () => VARIABLES.forEach((name) => root.style.removeProperty(name));
  }, [color]);

  return null;
}
