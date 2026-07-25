"use client";

import React from "react";
import type { TrackTemplate } from "@/lib/templates";

interface TemplatePickerProps {
  templates: TrackTemplate[];
  selectedId: string;
  onSelect: (template: TrackTemplate) => void;
}

export default function TemplatePicker({ templates, selectedId, onSelect }: TemplatePickerProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[1.1rem] font-semibold text-foreground m-0">Pick a starting point</h2>
      <p className="text-muted-foreground text-[0.85rem] m-0">
        A template just seeds your first phases and weekly rhythm — everything stays fully editable afterward, and nothing here locks you in.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className={`text-left flex flex-col gap-2 p-4 rounded-lg border transition-all duration-150 cursor-pointer ${
              t.id === selectedId ? "border-accent bg-accent/[0.06]" : "border-card-border bg-surface-muted hover:border-card-border-hover"
            }`}
          >
            <span className="text-foreground font-semibold text-[0.95rem]">{t.label}</span>
            <p className="text-muted-foreground text-[0.8rem] leading-snug m-0">{t.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
