"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, EyeOff } from "lucide-react";

/** `useLayoutEffect` on the client, `useEffect` on the server, so rendering
 *  the dashboard's HTML does not warn. The clamp below has to run before the
 *  browser paints, which only the layout variant guarantees. */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

interface SortablePanelProps {
  id: string;
  children: React.ReactNode;
  /** Position in its column — drives a small staggered entrance delay. */
  index?: number;
  /** Optional: shows a hover-revealed edit icon next to the drag handle for
   *  panels that have a dedicated bulk editor beyond their inline editing. */
  onEdit?: () => void;
  /** Optional: closes (hides) this module for the current track. Data-safe —
   *  the panel is removed from the view only; reopen it from the Modules menu. */
  onHide?: () => void;
}

/** Wraps a dashboard panel so it can be reordered — within its column or
 *  across into the other one — via dnd-kit.
 *
 *  Desktop (mouse): only the small handle icon starts a drag, so clicking
 *  buttons/checkboxes/links elsewhere on the panel behaves normally.
 *  Touch: press-and-hold anywhere on the panel also starts a drag (the
 *  handle still works too) — reaching for a small icon is much harder on a
 *  phone, and TouchSensor's delay means a quick tap/scroll is never
 *  mistaken for a drag. */
export default function SortablePanel({ id, children, index = 0, onEdit, onHide }: SortablePanelProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  // Keeping the panel on the screen, in the rendering only.
  //
  // A panel is wide and you grab it by a handle in its top-right corner, so
  // a pointer at the right-hand edge of the window already puts most of the
  // panel past it. Unbounded it simply kept going, with no column out there
  // to drop into.
  //
  // The obvious fix — `restrictToWindowEdges` on the DndContext — is the one
  // that cannot be used here, and 0.117.2 shipped it and crashed the
  // dashboard. A modifier clamps the rect that collision detection then
  // measures, and this dashboard moves panels between columns *live* during
  // a drag; held against the edge, the nearest droppable flipped between the
  // two columns forever, one `setState` per flip, until React gave up.
  //
  // So the clamp is applied here, to the committed DOM, after React has
  // rendered dnd-kit's own unclamped transform and before the browser
  // paints. dnd-kit's idea of where the panel is carries on tracking the
  // pointer, so collision detection stays monotonic and there is nothing for
  // a loop to feed on. No state is set, so this cannot re-render anything.
  //
  // Horizontal only: a long dashboard scrolls, and a panel being carried
  // down it has to be able to leave the top of the window.
  const node = React.useRef<HTMLDivElement | null>(null);

  const attachRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      node.current = el;
      setNodeRef(el);
    },
    [setNodeRef]
  );

  useIsomorphicLayoutEffect(() => {
    const el = node.current;
    if (!el || !transform) return;
    // The DOM already carries dnd-kit's transform at this point, so taking it
    // back off the measured rect gives the panel's resting position without
    // having to have remembered it from before the drag.
    const rect = el.getBoundingClientRect();
    const restLeft = rect.left - transform.x;
    const restRight = rect.right - transform.x;
    const lowest = -restLeft;
    const highest = window.innerWidth - restRight;
    // A panel wider than the window has no valid range; leave it be rather
    // than pinning it somewhere arbitrary.
    if (highest < lowest) return;
    const x = Math.min(Math.max(transform.x, lowest), highest);
    if (x !== transform.x) {
      el.style.transform = `translate3d(${x}px, ${transform.y}px, 0)`;
    }
  }, [transform]);

  const style: React.CSSProperties = {
    // Translate only, never CSS.Transform — that one also emits the scaleX/
    // scaleY dnd-kit computes from the ratio between the dragged panel and
    // whatever it's currently over. Dashboard panels differ enormously in
    // height (a Timer against a full Roadmap Timeline), so those factors
    // visibly squashed and stretched the panel's text mid-drag, snapping back
    // only once the transform was dropped on release.
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const chromeBtn =
    "tap-44 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground bg-card/70 backdrop-blur-sm border border-card-border cursor-pointer hover:text-foreground hover:border-card-border transition-colors";

  return (
    <div
      ref={attachRef}
      style={style}
      className="relative group"
      onTouchStart={listeners?.onTouchStart as React.TouchEventHandler<HTMLDivElement> | undefined}
    >
      {/* Invisible is not absent: an `opacity-0` button still takes the tap.
          On a phone, where there is no hover to reveal them, these three sat
          silently over the top-right corner of every panel and swallowed
          whatever a panel had put there — tapping the Consistency scope
          toggle hid the panel instead. They are out of the way of pointers
          until they are actually shown. */}
      <div className="pointer-events-none absolute top-3 right-3 z-10 flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
        {onEdit && (
          <button onClick={onEdit} className={chromeBtn} title="Edit panel" aria-label="Edit panel">
            <Pencil size={13} strokeWidth={2} />
          </button>
        )}
        {onHide && (
          <button onClick={onHide} className={chromeBtn} title="Close module (keeps its data)" aria-label="Close module">
            <EyeOff size={14} strokeWidth={2} />
          </button>
        )}
        <button
          {...attributes}
          {...listeners}
          className={`${chromeBtn} cursor-grab active:cursor-grabbing touch-none`}
          title="Drag to reorder"
          aria-label="Drag to reorder panel"
        >
          <GripVertical size={14} strokeWidth={2} />
        </button>
      </div>
      {/* Entrance animation lives on this inner wrapper — never the drag node
          above — so it can't fight dnd-kit's live transform during a drag.
          Skipped while dragging so a reorder doesn't replay the fade. */}
      <div className={isDragging ? undefined : "panel-in"} style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}>
        {children}
      </div>
    </div>
  );
}
