"use client";

import React from "react";

interface HorizonFields {
  startDate: string;
  durationDays: number;
}

interface HorizonStepProps extends HorizonFields {
  onChange: (fields: Partial<HorizonFields>) => void;
}

const DURATION_PRESETS = [
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "6 months", value: 180 },
  { label: "1 year", value: 365 },
];

export default function HorizonStep({ startDate, durationDays, onChange }: HorizonStepProps) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-[1.1rem] font-semibold text-foreground m-0">Set your horizon</h2>
      <p className="text-muted-foreground text-[0.85rem] m-0">
        How far out is the goal you&apos;re working toward? This shapes the phase timeline on the next step —
        changing duration later will regenerate it.
      </p>

      <div className="flex flex-col gap-1.5">
        <label className="text-[0.8rem] text-muted-foreground">Start date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onChange({ startDate: e.target.value })}
          className="bg-input-bg border border-card-border rounded-md text-foreground text-[0.9rem] outline-none px-3 py-2 font-[inherit] w-fit"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[0.8rem] text-muted-foreground">Duration</label>
        <div className="flex flex-wrap gap-2 items-center">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => onChange({ durationDays: preset.value })}
              className={`px-3 py-1.5 rounded-md border text-[0.85rem] cursor-pointer transition-all duration-150 ${
                durationDays === preset.value
                  ? "border-accent bg-accent/[0.1] text-foreground"
                  : "border-card-border bg-surface-muted text-muted-foreground hover:border-card-border-hover"
              }`}
            >
              {preset.label}
            </button>
          ))}
          <input
            type="number"
            min={1}
            value={durationDays}
            onChange={(e) => onChange({ durationDays: Math.max(1, Number(e.target.value) || 1) })}
            className="bg-input-bg border border-card-border rounded-md text-foreground text-[0.85rem] outline-none px-3 py-1.5 w-28 font-[inherit]"
          />
        </div>
        <span className="text-subtle-foreground text-[0.75rem]">Custom day count, or pick a preset above.</span>
      </div>
    </div>
  );
}
