"use client";

import { useEffect, useRef, type ElementType } from "react";

/**
 * Fades its children up as they come into view, once.
 *
 * A landing page is one long scroll, and a page that arrives all at once
 * gives the scrolling nothing to do. An `IntersectionObserver` rather than a
 * scroll listener, because the browser already knows the answer and a scroll
 * handler would ask it sixty times a second.
 *
 * The classes are put on the node by hand rather than held in state. Two
 * reasons: the element must render visible, so that it is still there if the
 * JavaScript never runs or fails, and only becomes hidden once an observer is
 * actually watching it — a marketing page that renders blank without client JS
 * is worse than one that does not animate. And doing it in state would mean
 * setting state in an effect on every one of these, which is a re-render per
 * section for something the browser can do in CSS.
 */
export default function Reveal({
  as: Tag = "div",
  className = "",
  children,
}: {
  as?: ElementType;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    node.classList.add("reveal");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        node.classList.add("is-in");
        observer.disconnect();
      },
      // A little before the bottom edge, so a section is already settling by
      // the time it is worth looking at.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
