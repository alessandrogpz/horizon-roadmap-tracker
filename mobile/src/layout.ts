/**
 * How wide the window is, as a class rather than a device.
 *
 * The app shipped portrait-locked and without iPad support, which meant it was
 * never laid out for anything but a phone held upright. On an iPad it ran as a
 * scaled-up phone: panels 800 points wide holding one short sentence, a week's
 * seven dots spread from edge to edge, meters running the width of the screen.
 *
 * The thresholds are Material's window size classes, which line up closely
 * enough with iOS's regular/compact size classes to serve both. They are read
 * from the window, never from the device model — a phone in landscape, an iPad
 * in Split View and a small tablet can all hand you the same width, and all
 * three want the same layout.
 */

import { useWindowDimensions } from "react-native";

export const BREAKPOINT = { medium: 600, expanded: 840 } as const;

export type WidthClass = "compact" | "medium" | "expanded";

/**
 * The widest a single column of panels is allowed to get.
 *
 * Not a guess: it is roughly the width the panels were designed against plus
 * the room a larger screen can afford them. Past it a card stops being a card
 * and becomes a band, and the eye has to travel the whole screen to get from a
 * panel's title to the chevron that opens it.
 */
export const MAX_CONTENT = 620;

export interface Layout {
  width: number;
  height: number;
  widthClass: WidthClass;
  isCompact: boolean;
  landscape: boolean;
}

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const widthClass: WidthClass =
    width >= BREAKPOINT.expanded ? "expanded" : width >= BREAKPOINT.medium ? "medium" : "compact";
  return { width, height, widthClass, isCompact: widthClass === "compact", landscape: width > height };
}

/**
 * Caps and centres a scrolling screen's content.
 *
 * Spread onto a `contentContainerStyle`. On a phone it does nothing — the cap
 * is wider than the screen — so there is one code path rather than a phone
 * layout and a tablet layout that can drift apart.
 */
export const centredContent = {
  width: "100%",
  maxWidth: MAX_CONTENT,
  alignSelf: "center",
} as const;
