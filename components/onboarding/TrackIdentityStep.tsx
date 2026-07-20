"use client";

import React from "react";

interface TrackIdentityFields {
  name: string;
  color: string;
}

interface TrackIdentityStepProps extends TrackIdentityFields {
  onChange: (fields: Partial<TrackIdentityFields>) => void;
}

export default function TrackIdentityStep({ name, color, onChange }: TrackIdentityStepProps) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-[1.1rem] font-semibold text-white m-0">Name your track</h2>

      <div className="flex flex-col gap-1.5">
        <label className="text-[0.8rem] text-zinc-400">Track name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Marathon Training"
          className="bg-black/25 border border-card-border rounded-md text-white text-[0.95rem] outline-none px-3 py-2 font-[inherit]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[0.8rem] text-zinc-400">Accent color</label>
        <input
          type="color"
          value={color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="w-12 h-10 border border-card-border bg-transparent cursor-pointer p-0 rounded-md"
        />
      </div>
    </div>
  );
}
