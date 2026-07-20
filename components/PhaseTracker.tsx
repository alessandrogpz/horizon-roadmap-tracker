"use client";

import React from "react";
import type { Phase } from "@/lib/types";

interface PhaseTrackerProps {
  phases: Phase[];
  currentPhase: number;
  onPhaseClick: (phase: Phase) => void;
  onAddPhase: () => void;
}

export default function PhaseTracker({ phases, currentPhase, onPhaseClick, onAddPhase }: PhaseTrackerProps) {
  return (
    <div className="glass-panel p-6 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="section-title !mb-0">Roadmap Timeline</h2>
        <button onClick={onAddPhase} className="btn px-2.5 py-1 text-xs">
          [+ Add Phase]
        </button>
      </div>
      <div className="relative flex flex-col gap-5">

        {/* Timeline Line */}
        <div className="absolute left-[12px] top-[18px] bottom-[18px] w-[2px] opacity-30 bg-gradient-to-b from-success via-accent to-card-border" />

        {phases.map((phase) => {
          const isActive = phase.id === currentPhase;
          const isPast = phase.id < currentPhase;

          return (
            <div
              key={phase.id}
              onClick={() => onPhaseClick(phase)}
              className={`relative flex flex-col gap-1 cursor-pointer transition-all duration-200 py-2 pr-2 pl-9 rounded-md hover:bg-white/[0.02] ${isPast ? "opacity-65" : ""}`}
            >
              {/* Timeline Indicator Dot */}
              <div
                className={`absolute left-[5px] top-[10px] w-4 h-4 rounded-full z-[1] transition-all duration-200 ${
                  isActive
                    ? "bg-background border-[3px] border-accent shadow-[0_0_8px_var(--accent)]"
                    : isPast
                      ? "bg-success border-2 border-success"
                      : "bg-zinc-900 border-2 border-card-border"
                }`}
              />

              {/* Header Title Row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-mono font-bold tracking-[0.05em] ${isActive ? "text-accent" : isPast ? "text-success" : "text-zinc-500"}`}>
                  PHASE 0{phase.id}
                </span>
                <h3 className={`text-[0.95rem] font-semibold m-0 ${isActive ? "text-white" : "text-zinc-200"}`}>
                  {phase.title.replace(/Phase \d+:\s*/, "")}
                </h3>
              </div>

              <p className="text-[0.8rem] text-zinc-400 m-0">
                {phase.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
