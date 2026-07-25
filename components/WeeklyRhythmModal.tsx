"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import type { FocusType, WeekDay } from "@/lib/types";
import FocusTypeEditor from "@/components/shared/FocusTypeEditor";

interface WeeklyRhythmModalProps {
  weekSchedule: WeekDay[];
  focusTypes: Record<string, FocusType>;
  onSave: (weekSchedule: WeekDay[], focusTypes: Record<string, FocusType>) => void;
  onClose: () => void;
}

export default function WeeklyRhythmModal({ weekSchedule, focusTypes, onSave, onClose }: WeeklyRhythmModalProps) {
  const [draftSchedule, setDraftSchedule] = useState(weekSchedule);
  const [draftTypes, setDraftTypes] = useState(focusTypes);
  const [showManager, setShowManager] = useState(false);

  const setDayType = (dayName: string, type: string) => {
    const label = draftTypes[type]?.label || type;
    setDraftSchedule((prev) => prev.map((d) => (d.name === dayName ? { ...d, type, label } : d)));
  };

  const handleSave = () => {
    onSave(draftSchedule, draftTypes);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel max-w-[560px] w-full max-h-[90vh] overflow-y-auto flex flex-col gap-5 p-8 border border-accent-muted relative rounded-lg"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 flex items-center bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          aria-label="Close"
        >
          <X size={18} strokeWidth={2} />
        </button>

        <div className="flex items-center justify-between pr-8">
          <div>
            <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded font-semibold uppercase font-mono tracking-[0.05em]">
              Weekly Study Plan
            </span>
            <h2 className="text-[1.3rem] font-bold text-foreground mt-2">Edit Weekly Rhythm</h2>
          </div>
          <button
            onClick={() => setShowManager(!showManager)}
            className="bg-transparent border-none text-accent text-xs cursor-pointer font-mono p-0 underline"
          >
            {showManager ? "Hide Settings" : "Customize Pool"}
          </button>
        </div>

        {showManager && (
          <FocusTypeEditor
            focusTypes={draftTypes}
            weekSchedule={draftSchedule}
            onChange={(types, schedule) => {
              setDraftTypes(types);
              setDraftSchedule(schedule);
            }}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {draftSchedule.map((day) => (
            <div
              key={day.name}
              className="flex items-center justify-between gap-2 bg-input-bg border border-card-border rounded-md px-3 py-2"
            >
              <span className="text-[0.85rem] text-foreground font-mono w-10">{day.name}</span>
              <select
                value={day.type}
                onChange={(e) => setDayType(day.name, e.target.value)}
                className="flex-1 bg-input-bg border border-card-border rounded-md px-2 py-1.5 text-foreground text-[0.85rem] font-[inherit] outline-none cursor-pointer"
              >
                {Object.entries(draftTypes).map(([key, val]) => (
                  <option key={key} value={key} className="bg-card text-foreground">
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 border-t border-card-border pt-4">
          <button
            onClick={onClose}
            className="btn px-4 py-2 text-[0.85rem] !bg-transparent !text-muted-foreground !border-card-border hover:!text-foreground"
          >
            Cancel
          </button>
          <button onClick={handleSave} className="btn px-5 py-2 text-[0.85rem]">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
