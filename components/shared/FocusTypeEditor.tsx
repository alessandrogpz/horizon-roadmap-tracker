"use client";

import React from "react";
import { X } from "lucide-react";
import type { FocusType, WeekDay } from "@/lib/types";

interface FocusTypeEditorProps {
  focusTypes: Record<string, FocusType>;
  weekSchedule: WeekDay[];
  onChange: (focusTypes: Record<string, FocusType>, weekSchedule: WeekDay[]) => void;
}

/** The "Customize Pool" panel — add/edit/delete focus types, keeping weekSchedule's
 *  labels and fallback assignments in sync. Extracted so both ScheduleDayModal and
 *  the onboarding wizard's rhythm step can reuse the exact same editor. */
export default function FocusTypeEditor({ focusTypes, weekSchedule, onChange }: FocusTypeEditorProps) {
  return (
    <div className="bg-surface-muted border border-card-border rounded-lg p-3 flex flex-col gap-[0.6rem]">
      <span className="text-[0.7rem] text-muted-foreground font-bold uppercase">
        Edit Focus Types Pool
      </span>

      <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
        {Object.entries(focusTypes).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <input
              type="text"
              value={val.label}
              onChange={(e) => {
                const updatedTypes = {
                  ...focusTypes,
                  [key]: { ...val, label: e.target.value }
                };
                const updatedSchedule = weekSchedule.map((d) =>
                  d.type === key ? { ...d, label: e.target.value } : d
                );
                onChange(updatedTypes, updatedSchedule);
              }}
              placeholder="Label"
              className="flex-1 bg-input-bg border border-card-border rounded px-1.5 py-0.5 text-foreground text-xs outline-none"
            />

            <input
              type="color"
              value={val.color || "#a1a1aa"}
              onChange={(e) => {
                const updatedTypes = {
                  ...focusTypes,
                  [key]: { ...val, color: e.target.value }
                };
                onChange(updatedTypes, weekSchedule);
              }}
              className="w-6 h-6 border-none bg-transparent cursor-pointer p-0"
            />

            <button
              onClick={() => {
                const updatedTypes = { ...focusTypes };
                delete updatedTypes[key];

                const fallbackType = Object.keys(updatedTypes)[0] || "free";
                const fallbackLabel = updatedTypes[fallbackType]?.label || "Free";

                const updatedSchedule = weekSchedule.map((d) =>
                  d.type === key ? { ...d, type: fallbackType, label: fallbackLabel } : d
                );
                onChange(updatedTypes, updatedSchedule);
              }}
              disabled={Object.keys(focusTypes).length <= 1}
              className={`bg-transparent border-none text-[0.8rem] px-0.5 ${
                Object.keys(focusTypes).length <= 1 ? "text-subtle-foreground cursor-not-allowed" : "text-red-500 cursor-pointer"
              }`}
              title="Delete Focus Type"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 items-center border-t border-card-border pt-2">
        <input
          type="text"
          id="new-type-label"
          placeholder="New type label..."
          className="flex-1 bg-input-bg border border-card-border rounded px-2 py-1 text-foreground text-xs outline-none"
        />
        <input
          type="color"
          id="new-type-color"
          defaultValue="#0ea5e9"
          className="w-6 h-6 border-none bg-transparent cursor-pointer p-0"
        />
        <button
          onClick={() => {
            const labelInput = document.getElementById("new-type-label") as HTMLInputElement;
            const colorInput = document.getElementById("new-type-color") as HTMLInputElement;
            if (labelInput && labelInput.value.trim()) {
              const labelVal = labelInput.value.trim();
              const colorVal = colorInput ? colorInput.value : "#0ea5e9";
              const keyVal = labelVal.toLowerCase().replace(/[^a-z0-9]/g, "");

              if (keyVal && !focusTypes[keyVal]) {
                const updatedTypes = {
                  ...focusTypes,
                  [keyVal]: { label: labelVal, color: colorVal }
                };
                onChange(updatedTypes, weekSchedule);
                labelInput.value = "";
              }
            }
          }}
          className="btn px-2 py-1 text-xs"
        >
          Add Type
        </button>
      </div>
    </div>
  );
}
