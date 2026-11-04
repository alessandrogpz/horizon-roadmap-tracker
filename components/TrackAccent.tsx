"use client";

import { useEffect } from "react";
import { trackAccentVariables } from "@/lib/trackAccent";

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
 * What goes onto `<html>` is a *pair* of values per variable, one per theme,
 * which `globals.css` then chooses between. An inline style sits above both
 * `[data-theme]` blocks, so a single value would be a colour neither theme
 * could correct — and all six track colours were picked on a dark screen, five
 * of them landing under even 3:1 on white. Writing both and letting the
 * cascade pick means the theme can flip with nothing subscribed to it.
 */
const VARIABLES = Object.keys(trackAccentVariables("#000000"));

export default function TrackAccent({ color }: { color?: string }) {
  useEffect(() => {
    const root = document.documentElement;
    if (!color) {
      VARIABLES.forEach((name) => root.style.removeProperty(name));
      return;
    }

    const variables = trackAccentVariables(color);
    Object.entries(variables).forEach(([name, value]) => root.style.setProperty(name, value));

    return () => VARIABLES.forEach((name) => root.style.removeProperty(name));
  }, [color]);

  return null;
}
