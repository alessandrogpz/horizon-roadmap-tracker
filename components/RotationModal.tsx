"use client";

import React from "react";
import type { TrackState } from "@/lib/types";
import { getWeekNum } from "@/lib/dates";

interface RotationModalProps {
  data: TrackState;
  onClose: () => void;
  /** Applies an optimistic state update and schedules a debounced save. */
  applyChange: (newData: TrackState) => void;
}

export default function RotationModal({ data, onClose, applyChange }: RotationModalProps) {
  const rotation = data.rotationConfig;
  const currentWeekNum = getWeekNum(data.startDate);
  const dsaStartWeek = data.dsaStartWeek || 1;
  const weeks = rotation?.weeks || [];
  const len = weeks.length;
  const activeIndex = len > 0 ? (((currentWeekNum - dsaStartWeek) % len) + len) % len : 0;

  const selectPattern = (idx: number) => {
    const newDsaStartWeek = currentWeekNum - idx;
    const currentPattern = weeks[idx];
    if (!currentPattern) return;

    // Update existing auto-revision items to match the newly selected pattern immediately
    const updatedRevisionItems = { ...(data.dailyRevisionItems || {}) };
    Object.keys(updatedRevisionItems).forEach((dayKey) => {
      updatedRevisionItems[dayKey] = (updatedRevisionItems[dayKey] || []).map((item) => {
        if (item.id === "dsa_auto") {
          return {
            ...item,
            title: currentPattern.pattern,
            description: currentPattern.problems
          };
        }
        return item;
      });
    });

    applyChange({
      ...data,
      dsaStartWeek: newDsaStartWeek,
      dailyRevisionItems: updatedRevisionItems
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel max-w-[600px] w-full flex flex-col gap-6 p-8 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] border border-accent-muted relative rounded-lg"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 bg-transparent border-none text-zinc-400 text-[1.2rem] cursor-pointer"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div>
          <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded font-semibold uppercase font-mono tracking-[0.05em]">
            {len}-Week Rotation Cycle
          </span>
          <h2 className="text-[1.4rem] font-bold text-white mt-2 mb-1">
            Pattern Rotation
          </h2>
          <p className="text-[0.85rem] text-zinc-400 m-0">
            Currently on Week {currentWeekNum} of curriculum.
          </p>
        </div>

        {/* Rotation list */}
        <div className="flex flex-col gap-[0.6rem] max-h-[350px] overflow-y-auto pr-2">
          {weeks.map((patternItem, idx) => {
            const isActive = idx === activeIndex;

            return (
              <div
                key={patternItem.pattern}
                onClick={() => selectPattern(idx)}
                className={`flex flex-col gap-1 px-4 py-3 rounded-md cursor-pointer transition-all duration-200 ${
                  isActive
                    ? "bg-accent/[0.08] border border-accent shadow-[0_0_10px_rgba(14,165,233,0.1)]"
                    : "bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] hover:border-white/15"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={`text-[0.8rem] font-bold ${isActive ? "text-white" : "text-zinc-400"}`}>
                    Week {idx + 1}: {patternItem.pattern}
                  </span>
                  {isActive && (
                    <span className="text-[0.65rem] bg-accent text-black px-1.5 py-px rounded-[3px] font-bold uppercase">
                      Active Week
                    </span>
                  )}
                </div>
                <span className={`text-xs leading-snug ${isActive ? "text-zinc-200" : "text-zinc-500"}`}>
                  Problems: {patternItem.problems}
                </span>
              </div>
            );
          })}
        </div>

        {/* Links and Actions */}
        <div className="flex justify-between items-center border-t border-white/5 pt-4 mt-2">
          <a
            href="/roadmap"
            onClick={onClose}
            className="btn px-4 py-2 text-[0.8rem] no-underline inline-block"
          >
            Go to Full Roadmap
          </a>
          <button
            onClick={onClose}
            className="btn px-4 py-2 text-[0.8rem] !bg-transparent !text-zinc-400 !border-white/10 hover:!text-white"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
