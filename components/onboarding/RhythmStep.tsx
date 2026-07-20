"use client";

import React, { useState } from "react";
import type { FocusType, WeekDay } from "@/lib/types";
import FocusTypeEditor from "@/components/shared/FocusTypeEditor";

interface RhythmStepProps {
  weekSchedule: WeekDay[];
  focusTypes: Record<string, FocusType>;
  onChange: (weekSchedule: WeekDay[], focusTypes: Record<string, FocusType>) => void;
}

export default function RhythmStep({ weekSchedule, focusTypes, onChange }: RhythmStepProps) {
  const [showManager, setShowManager] = useState(false);

  const setDayType = (dayName: string, type: string) => {
    const label = focusTypes[type]?.label || type;
    onChange(
      weekSchedule.map((d) => (d.name === dayName ? { ...d, type, label } : d)),
      focusTypes
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[1.1rem] font-semibold text-white m-0">Set your weekly rhythm</h2>
        <button
          onClick={() => setShowManager(!showManager)}
          className="bg-transparent border-none text-accent text-xs cursor-pointer font-mono p-0 underline"
        >
          {showManager ? "Hide Settings" : "Customize Pool"}
        </button>
      </div>
      <p className="text-zinc-400 text-[0.85rem] m-0">
        Assign a focus to each day. You can change this anytime from the dashboard.
      </p>

      {showManager && (
        <FocusTypeEditor
          focusTypes={focusTypes}
          weekSchedule={weekSchedule}
          onChange={(types, schedule) => onChange(schedule, types)}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {weekSchedule.map((day) => (
          <div
            key={day.name}
            className="flex items-center justify-between gap-2 bg-black/15 border border-white/5 rounded-md px-3 py-2"
          >
            <span className="text-[0.85rem] text-zinc-300 font-mono w-10">{day.name}</span>
            <select
              value={day.type}
              onChange={(e) => setDayType(day.name, e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-white text-[0.85rem] font-[inherit] outline-none cursor-pointer"
            >
              {Object.entries(focusTypes).map(([key, val]) => (
                <option key={key} value={key} className="bg-zinc-900 text-white">
                  {val.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
