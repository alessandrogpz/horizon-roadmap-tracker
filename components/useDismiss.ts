"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lets a surface finish leaving before it is taken off the page.
 *
 * Nine modals and two popovers were rendered by a `{open && …}` in whoever
 * owns them, so the moment the state changed they stopped existing. They now
 * arrive properly — a backdrop that fades, a panel that scales up out of its
 * trigger — and then vanished on one frame, which made the arrival look like
 * an accident rather than a decision.
 *
 * The obvious fix is for the owner to keep the thing mounted a moment longer,
 * which would mean touching eleven call sites and giving each of them a piece
 * of state that is really about an animation. This does it from inside
 * instead: the surface takes the close request, marks itself as leaving,
 * plays its exit, and only then tells its owner it is gone. Nothing above it
 * changes or needs to know.
 *
 * Exit is shorter than entry (140ms against 200ms) and that asymmetry is
 * deliberate: opening is the interface presenting something and may take its
 * time, closing is it getting out of the way and must not keep you waiting.
 *
 * `closing` resets itself once the owner has been told, so a popover that
 * stays mounted between openings — the top bar's menu, the track list — can
 * be opened again immediately.
 */

/** A shade longer than the longest exit in globals.css — `.modal-out` and
 *  `.overlay-out` run for 140ms, `.popover-out` for 120 — so the unmount
 *  never races the animation's last frame away. */
const EXIT_MS = 160;

export function useDismiss(onClose: () => void, exitMs: number = EXIT_MS) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A surface can be taken off the page by something other than its own close
  // button — a route change, a parent unmounting — and the timer would then
  // call back into a component that is no longer there.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const dismiss = useCallback(() => {
    // Already on its way out: a second Escape, or a click that lands on the
    // backdrop just after the close button, must not start a second exit or
    // close the thing twice.
    if (timer.current) return;

    setClosing(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setClosing(false);
      onClose();
    }, exitMs);
  }, [onClose, exitMs]);

  return { closing, dismiss };
}

export default useDismiss;
