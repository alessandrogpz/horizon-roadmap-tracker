"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { dateForDay, dayForDate, formatDateYMD } from "@/lib/dates";
import ColorSwatches from "@/components/shared/ColorSwatches";

interface TrackSettingsFields {
  name: string;
  color: string;
  startDate: string;
  totalDays: number;
}

interface TrackSettingsModalProps extends TrackSettingsFields {
  onSave: (fields: TrackSettingsFields) => void;
  onDelete: () => void;
  canDelete: boolean;
  onClose: () => void;
}

export default function TrackSettingsModal({ name, color, startDate, totalDays, onSave, onDelete, canDelete, onClose }: TrackSettingsModalProps) {
  const [draftName, setDraftName] = useState(name);
  const [draftColor, setDraftColor] = useState(color);
  const [draftStartDate, setDraftStartDate] = useState(startDate);
  const [draftTotalDays, setDraftTotalDays] = useState(totalDays);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
          className="absolute top-6 right-6 flex items-center bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          aria-label="Close"
        >
          <X size={18} strokeWidth={2} />
        </button>

        <div>
          <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded font-semibold uppercase font-mono tracking-[0.05em]">
            Track Settings
          </span>
          <h2 className="text-[1.3rem] font-bold text-foreground mt-2">Edit Track</h2>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[0.8rem] text-muted-foreground">Track name</label>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
            className="bg-input-bg border border-card-border rounded-md text-foreground text-[0.95rem] outline-none px-3 py-2 font-[inherit]"
          />
        </div>

        <div className="flex flex-col gap-2">
          {/* Not decoration. This is the accent the whole track wears — its
              buttons, its rings, its links and the four strengths its year of
              days is drawn in. */}
          <label className="text-[0.8rem] text-muted-foreground">Colour</label>
          <ColorSwatches value={draftColor} onPick={setDraftColor} />
        </div>

        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-[0.8rem] text-muted-foreground">Start date</label>
            <input
              type="date"
              value={draftStartDate}
              onChange={(e) => setDraftStartDate(e.target.value)}
              className="bg-input-bg border border-card-border rounded-md text-foreground text-[0.95rem] outline-none px-3 py-2 font-[inherit] w-full"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            {/* An end date, not a day count. Nobody knows their track is 92
                days long; they know it should be done by Christmas. The count
                is still what gets stored — it is what lets a track be re-dated
                wholesale — so this converts on the way in and out. */}
            <label className="text-[0.8rem] text-muted-foreground">Ends on</label>
            <input
              type="date"
              min={draftStartDate}
              value={formatDateYMD(dateForDay(draftStartDate, draftTotalDays))}
              onChange={(e) => {
                const days = dayForDate(draftStartDate, e.target.value);
                if (Number.isFinite(days) && days >= 1) setDraftTotalDays(days);
              }}
              className="bg-input-bg border border-card-border rounded-md text-foreground text-[0.95rem] outline-none px-3 py-2 font-[inherit] w-full"
            />
          </div>
        </div>
        <p className="text-[0.8rem] text-muted-foreground -mt-3">
          {draftTotalDays} day{draftTotalDays === 1 ? "" : "s"}.{" "}
          Moving the end date rescales your phase timeline proportionally.
        </p>

        <div className="border-t border-card-border pt-4 flex justify-between items-center">
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[0.8rem] text-red-400">Delete this track?</span>
              <button
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                className="btn px-3 py-1.5 text-[0.8rem] !bg-red-500/15 !text-red-400 !border-red-500/40"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="btn px-3 py-1.5 text-[0.8rem] !bg-transparent !text-muted-foreground !border-card-border"
              >
                Cancel
              </button>
            </div>
          ) : canDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-red-500 bg-transparent border-none cursor-pointer text-[0.8rem]"
            >
              Delete Track
            </button>
          ) : (
            <span className="text-[0.8rem] text-subtle-foreground" title="You need at least one track">
              Can&apos;t delete your only track
            </span>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn px-4 py-2 text-[0.85rem] !bg-transparent !text-muted-foreground !border-card-border hover:!text-foreground"
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
    </div>
  );
}
