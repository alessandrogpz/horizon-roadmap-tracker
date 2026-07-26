"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into <body> instead of where they sit in the tree.
 *
 * Needed by any `position: fixed` overlay that lives *inside* a dashboard
 * panel. A transformed ancestor becomes the containing block for its fixed
 * descendants, and dnd-kit puts a transform on a panel for the whole duration
 * of a drag — so a fixed drawer stops being positioned against the viewport
 * and starts being positioned against the panel. An off-screen `translateX
 * (100%)` then means "one panel-width to the right", which is very much
 * on screen.
 *
 * Escaping to <body> makes that structurally impossible rather than something
 * every overlay has to remember.
 */

// Canonical "have we hydrated yet" hook: the server snapshot is false, the
// client's is true, so the portal is only created once document exists — and
// without a setState-in-effect.
const noopSubscribe = () => () => {};

export default function Portal({ children }: { children: React.ReactNode }) {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
  if (!isClient) return null;
  return createPortal(children, document.body);
}
