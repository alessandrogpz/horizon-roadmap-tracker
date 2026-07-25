"use client";

import React, { useEffect, useRef, useState } from "react";
import type { TrackState } from "@/lib/types";

interface TrackSwitcherProps {
  tracks: TrackState[];
  activeTrackId: string;
  onSwitch: (trackId: string) => void;
  onNewTrack: () => void;
}

export default function TrackSwitcher({ tracks, activeTrackId, onSwitch, onNewTrack }: TrackSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeTrack = tracks.find((t) => t.meta.id === activeTrackId) || tracks[0];

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!activeTrack) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer text-[0.85rem] font-semibold text-accent hover:underline"
        title="Switch track"
      >
        <span>{activeTrack.meta.name}</span>
        <span className="text-subtle-foreground text-[0.7rem]">{open ? "^" : "v"}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 min-w-[220px] bg-card border border-card-border rounded-md shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)] overflow-hidden">
          {tracks.map((track) => (
            <button
              key={track.meta.id}
              onClick={() => {
                setOpen(false);
                if (track.meta.id !== activeTrackId) onSwitch(track.meta.id);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[0.85rem] bg-transparent border-none cursor-pointer transition-colors duration-150 ${
                track.meta.id === activeTrackId ? "text-foreground bg-surface-hover" : "text-foreground hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              <span className="flex-1 truncate">{track.meta.name}</span>
            </button>
          ))}
          <button
            onClick={() => {
              setOpen(false);
              onNewTrack();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-[0.8rem] bg-transparent border-none border-t border-card-border cursor-pointer text-accent hover:bg-accent/[0.08]"
          >
            <span>+</span>
            <span>New Track</span>
          </button>
        </div>
      )}
    </div>
  );
}
