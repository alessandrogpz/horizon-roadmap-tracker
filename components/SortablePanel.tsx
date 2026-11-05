"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, EyeOff } from "lucide-react";

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
      ref={setNodeRef}
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
