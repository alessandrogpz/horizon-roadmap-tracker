"use client";

import React from "react";
import { Map, Milestone } from "lucide-react";
import { dateForDay, formatDayMonthYear } from "@/lib/dates";
import type { Phase } from "@/lib/types";

interface PhaseTrackerProps {
  phases: Phase[];
  currentPhase: number;
  /** Track start, needed to turn each phase's recommendedByDay into a date. */
  startDate: string;
  /** The full roadmap doc is locked until the workspace is synced. */
  roadmapEnabled: boolean;
  onPhaseClick: (phase: Phase) => void;
  onAddPhase: () => void;
}

export default function PhaseTracker({ phases, currentPhase, startDate, roadmapEnabled, onPhaseClick, onAddPhase }: PhaseTrackerProps) {
  return (
    <div className="glass-panel flex flex-col gap-6">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <h2 className="section-title !mb-0">
          <Milestone size={14} strokeWidth={2.5} className="section-icon" />
          Phases
        </h2>
        <div className="flex items-center gap-2">
          {/* The timeline is a summary of the track's full roadmap doc, so the
              way through to it belongs here as well as in the header menu. */}
          {roadmapEnabled ? (
            <a
              href="/roadmap"
              className="btn px-2.5 py-1 text-xs inline-flex items-center gap-1.5 no-underline"
            >
              <Map size={12} strokeWidth={2} />
              Full Roadmap
            </a>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-card-border px-2.5 py-1 text-xs text-subtle-foreground cursor-not-allowed"
              title="Connect Google Drive to unlock the full roadmap"
            >
              <Map size={12} strokeWidth={2} />
              Full Roadmap
            </span>
          )}
          <button onClick={onAddPhase} className="btn px-2.5 py-1 text-xs">
            [+ Add Phase]
          </button>
        </div>
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
              className={`relative flex flex-col gap-1 cursor-pointer transition-colors duration-200 py-2 pr-2 pl-9 rounded-md hover:bg-surface-muted ${isPast ? "opacity-65" : ""}`}
            >
              {/* Timeline Indicator Dot */}
              <div
                className={`absolute left-[5px] top-[10px] w-4 h-4 rounded-full z-[1] transition-[background-color,border-color,box-shadow] duration-200 ${
                  isActive
                    ? "bg-background border-[3px] border-accent shadow-[0_0_8px_var(--accent)]"
                    : isPast
                      ? "bg-success border-2 border-success"
                      : "bg-card border-2 border-card-border"
                }`}
              />

              {/* The phase's name, and nothing above it. "PHASE 01" in tracked
                  monospace capitals used to sit here: a number the dot and the
                  line beside it already give, shouted. Where a phase stands is
                  the dot's colour and the weight of its name. */}
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className={`text-[0.95rem] m-0 text-foreground ${isActive ? "font-bold" : "font-semibold"}`}>
                  {phase.title.replace(/Phase \d+:\s*/, "")}
                </h3>
                {isActive ? <span className="text-[0.75rem] text-accent font-semibold">You are here</span> : null}
              </div>

              <p className="text-[0.8rem] text-muted-foreground m-0">
                {phase.description}
              </p>

              {/* Deadline, deliberately faint — reads as metadata under the
                  description rather than competing with it. Only shown when the
                  phase actually carries a threshold. */}
              {phase.recommendedByDay !== undefined && startDate && (
                <p className="text-[0.7rem] font-mono text-muted-foreground/60 m-0">
                  Ends {formatDayMonthYear(dateForDay(startDate, phase.recommendedByDay))}
                  <span className="opacity-70"> · day {phase.recommendedByDay}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
