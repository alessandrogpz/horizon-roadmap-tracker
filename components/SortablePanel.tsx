"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortablePanelProps {
  id: string;
  children: React.ReactNode;
  /** Optional: shows a hover-revealed edit icon next to the drag handle for
   *  panels that have a dedicated bulk editor beyond their inline editing. */
  onEdit?: () => void;
}

/** Wraps a dashboard panel with a hover-revealed drag handle so it can be
 *  reordered — within its column or across into the other one — via dnd-kit. */
export default function SortablePanel({ id, children, onEdit }: SortablePanelProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
        {onEdit && (
          <button
            onClick={onEdit}
            className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 bg-black/40 backdrop-blur-sm border border-white/10 cursor-pointer hover:text-white hover:border-white/25"
            title="Edit panel"
            aria-label="Edit panel"
          >
            ✎
          </button>
        )}
        <button
          {...attributes}
          {...listeners}
          className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 bg-black/40 backdrop-blur-sm border border-white/10 cursor-grab active:cursor-grabbing hover:text-white hover:border-white/25 touch-none"
          title="Drag to reorder"
          aria-label="Drag to reorder panel"
        >
          ⠿
        </button>
      </div>
      {children}
    </div>
  );
}
