"use client";

import React from "react";
import { X } from "lucide-react";
import type { Phase } from "@/lib/types";

interface PhaseReviewStepProps {
  phases: Phase[];
  onChange: (phases: Phase[]) => void;
}

export default function PhaseReviewStep({ phases, onChange }: PhaseReviewStepProps) {
  const updatePhase = (id: number, fields: Partial<Phase>) => {
    onChange(phases.map((p) => (p.id === id ? { ...p, ...fields } : p)));
  };

  const removePhase = (id: number) => {
    if (phases.length <= 1) return;
    onChange(phases.filter((p) => p.id !== id));
  };

  const addPhase = () => {
    const nextId = Math.max(0, ...phases.map((p) => p.id)) + 1;
    onChange([
      ...phases,
      {
        id: nextId,
        title: `Phase ${nextId}`,
        description: "",
        tasks: [],
        detailedInfo: { focus: "", deliverable: "", math: "" },
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[1.1rem] font-semibold text-foreground m-0">Review your phases</h2>
      <p className="text-muted-foreground text-[0.85rem] m-0">
        Auto-generated from your horizon — rename, reword, or restructure them however you like. Nothing here is locked in.
      </p>

      <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
        {phases.map((phase) => (
          <div key={phase.id} className="bg-input-bg border border-card-border rounded-md p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[0.7rem] text-accent font-mono font-bold shrink-0">P{phase.id}</span>
              <input
                type="text"
                value={phase.title}
                onChange={(e) => updatePhase(phase.id, { title: e.target.value })}
                className="flex-1 bg-transparent border-none text-foreground text-[0.9rem] font-semibold outline-none"
              />
              <button
                onClick={() => removePhase(phase.id)}
                disabled={phases.length <= 1}
                className={`flex items-center bg-transparent border-none ${
                  phases.length <= 1 ? "text-subtle-foreground cursor-not-allowed" : "text-red-500 cursor-pointer"
                }`}
                aria-label="Remove phase"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
            <input
              type="text"
              value={phase.description}
              onChange={(e) => updatePhase(phase.id, { description: e.target.value })}
              placeholder="What is this phase about?"
              className="bg-transparent border-none border-b border-dashed border-card-border text-muted-foreground text-[0.8rem] outline-none py-px"
            />
          </div>
        ))}
      </div>

      <button onClick={addPhase} className="btn px-3 py-1.5 text-[0.8rem] self-start">
        + Add Phase
      </button>
    </div>
  );
}
