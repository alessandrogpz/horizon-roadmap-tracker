"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Flame, Plus } from "lucide-react";
import type { TrackState } from "@/lib/types";
import { streakCalendar } from "@/lib/stats";
import { currentStreakLength } from "@/lib/streak";
import { todayYMD } from "@/lib/dates";
import { useAppSettings } from "@/lib/useAppSettings";
import TrackYearStrip from "@/components/TrackYearStrip";

interface TrackSwitcherProps {
  tracks: TrackState[];
  activeTrackId: string;
  onSwitch: (trackId: string) => void;
  onNewTrack: () => void;
}

/**
 * The track list, which is also the place you go to see how each one is
 * going.
 *
 * It used to be a column of names, which answered "which tracks exist" and
 * nothing else. Each row now carries a year of that track's days in the
 * track's own colour and the run it is on, because the question anyone
 * actually opens this for is which ones they are keeping up.
 */
export default function TrackSwitcher({ tracks, activeTrackId, onSwitch, onNewTrack }: TrackSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const settings = useAppSettings();
  const today = todayYMD();
  const activeTrack = tracks.find((t) => t.meta.id === activeTrackId) || tracks[0];

  // A year per track is real work on an account with several, and it is only
  // ever looked at while the menu is open.
  const rows = useMemo(
    () =>
      open
        ? tracks.map((track) => ({
            track,
            color: track.meta.color || "var(--accent)",
            days: streakCalendar(track, today, settings.weekStartsOn),
            streak: currentStreakLength(track.streakHistory ?? [], today),
          }))
        : [],
    [open, settings.weekStartsOn, today, tracks]
  );

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!activeTrack) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer text-[0.85rem] font-semibold text-accent hover:underline"
        title="Switch track"
      >
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: activeTrack.meta.color || "var(--accent)" }}
          aria-hidden="true"
        />
        <span>{activeTrack.meta.name}</span>
        <ChevronDown size={12} strokeWidth={2.5} className={`text-subtle-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[360px] max-w-[calc(100vw-2rem)] bg-card border border-card-border rounded-md shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)] overflow-hidden">
          {rows.map((row) => {
            const active = row.track.meta.id === activeTrackId;
            return (
              <button
                key={row.track.meta.id}
                onClick={() => {
                  setOpen(false);
                  if (!active) onSwitch(row.track.meta.id);
                }}
                aria-current={active}
                className="relative w-full flex flex-col gap-2 px-3 py-2.5 text-left bg-transparent border-none border-b border-card-border cursor-pointer transition-colors duration-150 hover:bg-surface-hover"
              >
                {/* The track's colour laid over the row rather than replacing
                    its background, so the row keeps the surface it sits on. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{ backgroundColor: row.color, opacity: active ? 0.12 : 0.04 }}
                />
                <span className="relative flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                  <span className="flex-1 truncate text-[0.85rem] font-semibold text-foreground">{row.track.meta.name}</span>
                  {row.streak > 0 && (
                    <span
                      className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[0.65rem] font-bold"
                      style={{ color: row.color, backgroundColor: "var(--surface-hover)" }}
                    >
                      <Flame size={9} strokeWidth={2.5} />
                      {row.streak}
                    </span>
                  )}
                </span>
                <TrackYearStrip
                  days={row.days}
                  color={row.color}
                  cell={4}
                  gap={2}
                  start={row.track.startDate}
                  className="relative"
                />
              </button>
            );
          })}
          <button
            onClick={() => {
              setOpen(false);
              onNewTrack();
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-[0.8rem] bg-transparent border-none cursor-pointer text-accent hover:bg-accent/[0.08]"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>New track…</span>
          </button>
        </div>
      )}
    </div>
  );
}
