"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Flame, Plus, Trash2 } from "lucide-react";
import type { TrackState } from "@/lib/types";
import { streakCalendar } from "@/lib/stats";
import { restWeekdays, trackStreak } from "@/lib/restDays";
import { todayYMD } from "@/lib/dates";
import { useAppSettings } from "@/lib/useAppSettings";
import TrackYearStrip from "@/components/TrackYearStrip";

interface TrackSwitcherProps {
  tracks: TrackState[];
  activeTrackId: string;
  onSwitch: (trackId: string) => void;
  onNewTrack: () => void;
  /** Archives a track. Absent, the rows carry no delete affordance. */
  onDelete?: (trackId: string) => void;
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
export default function TrackSwitcher({ tracks, activeTrackId, onSwitch, onNewTrack, onDelete }: TrackSwitcherProps) {
  const [open, setOpen] = useState(false);
  /** Which row has been armed for deletion. One decision per intent: the
   *  trash icon asks, the second tap does it, and opening the menu again
   *  forgets. */
  const [confirming, setConfirming] = useState<string | null>(null);
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
            streak: trackStreak(track, today),
            rest: restWeekdays(track),
          }))
        : [],
    [open, settings.weekStartsOn, today, tracks]
  );

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setConfirming(null);
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setConfirming(null);
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!activeTrack) return null;

  // One track cannot be deleted: the app has nowhere to stand without it.
  const canDelete = Boolean(onDelete) && tracks.length > 1;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => {
          setConfirming(null);
          setOpen((o) => !o);
        }}
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

      {/* Pinned to the viewport on a phone and hung off the button on a desk.
          A 360-point menu anchored to a button sixty points from the left edge
          is 400 points wide on a 375-point screen, and the page — the only
          page in this app that had to — scrolled sideways. */}
      {open && (
        <div className="fixed inset-x-2 top-[3.6rem] z-50 max-h-[70vh] overflow-y-auto rounded-md border border-card-border bg-card shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)] sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+0.5rem)] sm:max-h-none sm:w-[360px]">
          {rows.map((row) => {
            const active = row.track.meta.id === activeTrackId;
            const armed = confirming === row.track.meta.id;
            return (
              <div key={row.track.meta.id} className="relative border-b border-card-border last:border-b-0">
                {/* The track's colour laid over the row rather than replacing
                    its background, so the row keeps the surface it sits on. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{ backgroundColor: row.color, opacity: active ? 0.12 : 0.04 }}
                />
                <button
                  onClick={() => {
                    setOpen(false);
                    if (!active) onSwitch(row.track.meta.id);
                  }}
                  aria-current={active}
                  className="relative flex w-full flex-col gap-2 border-none bg-transparent px-3 py-2.5 text-left transition-colors duration-150 cursor-pointer hover:bg-surface-hover"
                >
                  <span className="flex items-center gap-2">
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
                    {/* Room for the delete button, which sits over this end of
                        the line rather than inside the row's own button — a
                        button cannot contain another one. */}
                    {canDelete && <span className="w-6 shrink-0" />}
                  </span>
                  <TrackYearStrip
                    days={row.days}
                    color={row.color}
                    cell={4}
                    gap={2}
                    start={row.track.startDate}
                    rest={row.rest}
                  />
                </button>

                {canDelete && (
                  <button
                    onClick={() => {
                      if (!armed) {
                        setConfirming(row.track.meta.id);
                        return;
                      }
                      setConfirming(null);
                      setOpen(false);
                      onDelete?.(row.track.meta.id);
                    }}
                    onBlur={() => setConfirming((current) => (current === row.track.meta.id ? null : current))}
                    title={armed ? "Tap again to delete" : `Delete ${row.track.meta.name}`}
                    aria-label={armed ? `Confirm deleting ${row.track.meta.name}` : `Delete ${row.track.meta.name}`}
                    className={`absolute right-2.5 top-2 flex h-6 items-center gap-1 rounded-[var(--radius-control)] border px-1.5 text-[0.62rem] font-semibold transition-colors cursor-pointer ${
                      armed
                        ? "border-red-500/50 bg-red-500/15 text-red-400"
                        : "border-transparent bg-transparent text-subtle-foreground hover:border-card-border hover:bg-surface-hover hover:text-red-400"
                    }`}
                  >
                    <Trash2 size={12} strokeWidth={2} />
                    {armed && <span>Sure?</span>}
                  </button>
                )}
              </div>
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
