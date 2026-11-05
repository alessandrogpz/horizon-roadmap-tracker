"use client";

import React, { useState } from "react";
import {
  addFocusType,
  DEFAULT_TYPE_COLOR,
  recolorFocusType,
  removeFocusType,
  renameFocusType,
  setRestDay,
  type FocusPool,
} from "@/lib/focusTypes";
import { isRestType } from "@/lib/restDays";
import { Moon, X } from "lucide-react";
import type { FocusType, WeekDay } from "@/lib/types";
import { LIMITS } from "@/lib/limits";

interface FocusTypeEditorProps {
  focusTypes: Record<string, FocusType>;
  weekSchedule: WeekDay[];
  onChange: (focusTypes: Record<string, FocusType>, weekSchedule: WeekDay[]) => void;
}

/** The "Customize Pool" panel — add/edit/delete focus types, keeping weekSchedule's
 *  labels and fallback assignments in sync. Extracted so both ScheduleDayModal and
 *  WeeklyRhythmModal use the exact same editor. */
export default function FocusTypeEditor({ focusTypes, weekSchedule, onChange }: FocusTypeEditorProps) {
  const [draft, setDraft] = useState({ label: "", color: "#0ea5e9" });

  // The rules — how a key is derived, what a rename does to the week, what a
  // delete re-points its days at — live in lib/focusTypes.ts, because the phone
  // has the same editor and the week has to end up in the same state either way.
  const apply = (next: FocusPool) => onChange(next.focusTypes, next.weekSchedule);
  const pool: FocusPool = { focusTypes, weekSchedule };

  const addType = () => {
    const before = Object.keys(focusTypes).length;
    const next = addFocusType(pool, draft.label, draft.color);
    if (Object.keys(next.focusTypes).length === before) return; // blank or a duplicate
    apply(next);
    setDraft({ label: "", color: draft.color });
  };

  return (
    <div className="bg-surface-muted border border-card-border rounded-lg p-3 flex flex-col gap-[0.6rem]">
      <span className="type-caption text-muted-foreground font-bold uppercase">
        Edit Focus Types Pool
      </span>

      <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
        {Object.entries(focusTypes).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <input
              type="text"
              maxLength={LIMITS.name}
              value={val.label}
              onChange={(e) => apply(renameFocusType(pool, key, e.target.value))}
              placeholder="Label"
              className="flex-1 bg-input-bg border border-card-border rounded px-1.5 py-0.5 text-foreground type-caption outline-none"
            />

            <input
              type="color"
              value={val.color || DEFAULT_TYPE_COLOR}
              onChange={(e) => apply(recolorFocusType(pool, key, e.target.value))}
              className="w-6 h-6 border-none bg-transparent cursor-pointer p-0"
            />

            {/* A day off, rather than a day missed. Days of this kind bridge
                the streak instead of breaking it, and the consistency grid
                marks them with a dot. */}
            <button
              onClick={() => apply(setRestDay(pool, key, !isRestType(key, val)))}
              aria-pressed={isRestType(key, val)}
              title={isRestType(key, val) ? `${val.label} is a day off — the streak survives it` : `Make ${val.label} a day off`}
              aria-label={isRestType(key, val) ? `${val.label} is a day off` : `Make ${val.label} a day off`}
              className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors ${
                isRestType(key, val)
                  ? "border-accent-muted bg-accent/15 text-accent"
                  : "border-card-border bg-transparent text-subtle-foreground hover:text-foreground"
              }`}
            >
              <Moon size={12} strokeWidth={2.5} />
            </button>

            <button
              onClick={() => apply(removeFocusType(pool, key))}
              disabled={Object.keys(focusTypes).length <= 1}
              className={`bg-transparent border-none type-label px-0.5 ${
                Object.keys(focusTypes).length <= 1 ? "text-subtle-foreground cursor-not-allowed" : "text-danger cursor-pointer"
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
          maxLength={LIMITS.name}
          value={draft.label}
          onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && addType()}
          placeholder="New type label..."
          className="flex-1 bg-input-bg border border-card-border rounded px-2 py-1 text-foreground type-caption outline-none"
        />
        <input
          type="color"
          value={draft.color}
          onChange={(e) => setDraft((prev) => ({ ...prev, color: e.target.value }))}
          className="w-6 h-6 border-none bg-transparent cursor-pointer p-0"
        />
        <button onClick={addType} className="btn px-2 py-1 type-caption">
          Add Type
        </button>
      </div>

      <p className="m-0 type-caption text-subtle-foreground">
        The moon marks a kind of day you take off on purpose. Those days bridge a streak rather
        than breaking it, and show in the consistency grid as a dot.
      </p>
    </div>
  );
}
