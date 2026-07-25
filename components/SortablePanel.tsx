"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";

interface SortablePanelProps {
  id: string;
  children: React.ReactNode;
  /** Position in its column — drives a small staggered entrance delay. */
  index?: number;
  /** Optional: shows a hover-revealed edit icon next to the drag handle for
   *  panels that have a dedicated bulk editor beyond their inline editing. */
  onEdit?: () => void;
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
export default function SortablePanel({ id, children, index = 0, onEdit }: SortablePanelProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const chromeBtn =
    "w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground bg-card/70 backdrop-blur-sm border border-card-border cursor-pointer hover:text-foreground hover:border-card-border transition-colors";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group"
      onTouchStart={listeners?.onTouchStart as React.TouchEventHandler<HTMLDivElement> | undefined}
    >
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
        {onEdit && (
          <button onClick={onEdit} className={chromeBtn} title="Edit panel" aria-label="Edit panel">
            <Pencil size={13} strokeWidth={2} />
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
