// What motion in this app is allowed to do, and when it is allowed to do
// nothing at all.
//
// The web app keeps three easing curves as tokens in globals.css for the same
// reason this file exists: the numbers were written out at each call site, so
// two springs that meant "the same kind of answer" had different stiffnesses
// and nobody could have said which was intended. These are the springs,
// named for the job.
//
// Springs rather than durations, where the thing being animated is answering
// a touch. A spring keeps its velocity when it is interrupted — tap a chip
// twice quickly and the second press takes over from wherever the first one
// had got to, instead of restarting from nothing. A timed animation cannot do
// that, and on a touch screen, where presses arrive in bursts, the difference
// is the whole feel of the control.
//
// `useReducedMotion` is the piece the phone app simply did not have. The web
// app has honoured `prefers-reduced-motion` since the landing page's reveals
// went in; the phone ignored the identical system setting, so a person who
// had asked their phone to stop moving things got every spring, slide and
// collapse anyway.

import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Presses. Stiff and heavily damped: it has to arrive within the time a
 *  thumb is still down, which is often under 100ms, and it must not bounce —
 *  a button that wobbles after a press reads as a toy. */
export const PRESS_SPRING = { damping: 22, stiffness: 320 } as const;

/** Something travelling to a new place on screen — a segmented thumb, a row
 *  shifting to make room. Slightly under-damped so it overshoots a little and
 *  settles, which is what makes a short movement read as physical rather than
 *  as a redraw. */
export const TRAVEL_SPRING = { damping: 19, stiffness: 190, mass: 0.6 } as const;

/** How far a pressed control gives, and how much light it loses. Three
 *  percent is deliberately below the threshold where anyone would name it:
 *  what you notice is its absence, as the app feeling dead under the thumb. */
export const PRESS_SCALE = 0.04;
export const PRESS_DIM = 0.25;

/** Durations, for the things that are genuinely timed rather than sprung: a
 *  fade has no physics to simulate. Matches the web app's own ladder — press
 *  feedback 100–160ms, small overlays 125–200ms, sheets and drawers 200ms up. */
export const DURATION = { press: 140, fade: 180, collapse: 240, travel: 260 } as const;

/**
 * Whether the person has asked their phone to reduce motion.
 *
 * iOS: Settings › Accessibility › Motion › Reduce Motion.
 * Android: Settings › Accessibility › Remove animations.
 *
 * Starts `false` and corrects itself on mount rather than blocking a render
 * on an async platform call — the worst case is one frame of motion for
 * someone who asked for none, against a blank screen on every launch for
 * everyone.
 *
 * Reduced motion means fewer and gentler, not none: a fade still says that a
 * thing arrived, and callers keep theirs. What goes is movement — scale,
 * translation, the collapse of a list.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduced(value);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      setReduced(value);
    });

    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
