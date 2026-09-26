"use client";

import { useEffect } from "react";

/**
 * In-page links roll to where they point instead of snapping.
 *
 * `scroll-behavior: smooth` would be one CSS line, but it gives the browser's
 * own curve and its own duration, which on a long page means a short hop and
 * a cross-page jump take noticeably different amounts of time in the wrong
 * direction. This eases in and out of every trip and lets the *speed* rise
 * with the distance — a jump to the footer is quicker than four times the
 * hop to the next section, not four times slower.
 *
 * One listener on the document rather than a handler per link, so it covers
 * the nav, the contents column on the document pages, and anything added
 * later without those knowing about it.
 */

/** How long a trip takes. Grows with the square root of the distance, so the
 *  speed climbs as the distance does; clamped at both ends because below a
 *  third of a second nothing reads as motion and above a second it is a wait. */
function durationFor(distance: number): number {
  return Math.min(900, Math.max(320, 260 + Math.sqrt(distance) * 13));
}

/** Slow, fast, slow. The standard cubic curve — the same shape the panels use
 *  when they arrive. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function SmoothAnchors() {
  useEffect(() => {
    let frame = 0;

    const onClick = (event: MouseEvent) => {
      // Anything the browser has its own meaning for is left alone.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = (event.target as Element | null)?.closest?.("a");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") return;

      const href = link.getAttribute("href");
      if (!href || !href.startsWith("#") || href === "#") return;

      const target = document.getElementById(decodeURIComponent(href.slice(1)));
      if (!target) return;

      event.preventDefault();

      // `scroll-margin-top` is what keeps a section clear of the sticky bar,
      // and the browser only applies it to scrolls it performs itself.
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const from = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const to = Math.max(0, Math.min(max, target.getBoundingClientRect().top + from - margin));
      const distance = to - from;

      // The address bar should still end up saying where you are.
      const settle = () => history.replaceState(null, "", href);

      if (Math.abs(distance) < 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        window.scrollTo(0, to);
        settle();
        return;
      }

      cancelAnimationFrame(frame);
      const duration = durationFor(Math.abs(distance));
      const start = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        window.scrollTo(0, from + distance * easeInOutCubic(t));
        if (t < 1) frame = requestAnimationFrame(step);
        else settle();
      };
      frame = requestAnimationFrame(step);
    };

    // A wheel or a touch mid-flight means the reader has changed their mind.
    const stop = () => cancelAnimationFrame(frame);

    document.addEventListener("click", onClick);
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("click", onClick);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
    };
  }, []);

  return null;
}
