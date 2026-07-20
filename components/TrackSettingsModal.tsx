"use client";

import React, { useState } from "react";

interface TrackSettingsFields {
  name: string;
  color: string;
  startDate: string;
  totalDays: number;
}

interface TrackSettingsModalProps extends TrackSettingsFields {
  onSave: (fields: TrackSettingsFields) => void;
  onClose: () => void;
}

export default function TrackSettingsModal({ name, color, startDate, totalDays, onSave, onClose }: TrackSettingsModalProps) {
  const [draftName, setDraftName] = useState(name);
  const [draftColor, setDraftColor] = useState(color);
  const [draftStartDate, setDraftStartDate] = useState(startDate);
  const [draftTotalDays, setDraftTotalDays] = useState(totalDays);

  const handleSave = () => {
    if (!draftName.trim() || !draftStartDate || draftTotalDays < 1) return;
    onSave({ name: draftName.trim(), color: draftColor, startDate: draftStartDate, totalDays: draftTotalDays });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel max-w-[420px] w-full flex flex-col gap-5 p-8 border border-accent-muted relative rounded-lg"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 bg-transparent border-none text-zinc-400 text-[1.2rem] cursor-pointer"
        >
          ✕
        </button>

        <div>
          <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded font-semibold uppercase font-mono tracking-[0.05em]">
            Track Settings
          </span>
          <h2 className="text-[1.3rem] font-bold text-white mt-2">Edit Track</h2>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[0.8rem] text-zinc-400">Track name</label>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
            className="bg-black/25 border border-card-border rounded-md text-white text-[0.95rem] outline-none px-3 py-2 font-[inherit]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[0.8rem] text-zinc-400">Accent color</label>
          <input
            type="color"
            value={draftColor}
            onChange={(e) => setDraftColor(e.target.value)}
            className="w-12 h-10 border border-card-border bg-transparent cursor-pointer p-0 rounded-md"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-[0.8rem] text-zinc-400">Start date</label>
            <input
              type="date"
              value={draftStartDate}
              onChange={(e) => setDraftStartDate(e.target.value)}
              className="bg-black/25 border border-card-border rounded-md text-white text-[0.9rem] outline-none px-3 py-2 font-[inherit] w-full"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-[0.8rem] text-zinc-400">Total days</label>
            <input
              type="number"
              min={1}
              value={draftTotalDays}
              onChange={(e) => setDraftTotalDays(Math.max(1, Number(e.target.value) || 1))}
              className="bg-black/25 border border-card-border rounded-md text-white text-[0.9rem] outline-none px-3 py-2 font-[inherit] w-full"
            />
          </div>
        </div>
        <p className="text-[0.75rem] text-zinc-500 -mt-3">
          Changing total days rescales your phase timeline proportionally.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="btn px-4 py-2 text-[0.85rem] !bg-transparent !text-zinc-400 !border-white/10 hover:!text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!draftName.trim() || !draftStartDate || draftTotalDays < 1}
            className="btn px-5 py-2 text-[0.85rem] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
