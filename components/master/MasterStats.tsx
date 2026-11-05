"use client";

import { useMemo } from "react";
import { Activity, Flame, Layers } from "lucide-react";
import type { TrackState } from "@/lib/types";
import { todayYMD } from "@/lib/dates";
import { masterProgress, masterStreak } from "@/lib/masterTrack";

/**
 * The four numbers at the top of the master view.
 *
 * The same row the dashboard header shows for one track, answering the same
 * questions of all of them — and *not* clickable, because the detail panel
 * behind each of the real ones is a panel about one track. A tile that opens
 * nothing is better than a tile that opens the wrong thing.
 *
 * The timeline tile is the one that needed thinking about. "Day 400 of 460"
 * means nothing across six tracks that started on six different days, so this
 * one shows the share of the work, weighted by how long each goal is: a
 * ninety-day track at 50% and a three-year track at 50% are not the same
 * amount of work, and a plain mean would say they were.
 */
export default function MasterStats({ tracks }: { tracks: TrackState[] }) {
  const today = todayYMD();
  const streak = useMemo(() => masterStreak(tracks, today), [today, tracks]);
  const progress = useMemo(() => masterProgress(tracks), [tracks]);

  const pace =
    progress.paceDelta >= 1
      ? `${Math.round(progress.paceDelta)}% ahead of the calendar`
      : progress.paceDelta <= -1
        ? `${Math.round(-progress.paceDelta)}% behind the calendar`
        : "level with the calendar";

  return (
    <div className="flex flex-wrap items-stretch gap-3">
      <Tile label="Current Streak" icon={<Flame size={20} strokeWidth={2} className="shrink-0 text-warning" />}>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono type-display-sm font-bold text-foreground">{streak.current}</span>
          <span className="type-label text-muted-foreground">{streak.current === 1 ? "day" : "days"}</span>
        </div>
      </Tile>

      <Tile
        label="Across all of it"
        icon={
          <div className="relative grid shrink-0 place-items-center" style={{ width: 60, height: 60 }}>
            <Ring pct={progress.timePct} />
            <span className="absolute inset-0 grid place-items-center font-mono type-micro font-semibold text-accent">
              {Math.round(Math.min(100, progress.timePct))}%
            </span>
          </div>
        }
      >
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono type-display-sm font-bold text-foreground">{progress.count}</span>
          <span className="type-label text-muted-foreground">
            track{progress.count === 1 ? "" : "s"} · {progress.totalDays} days planned
          </span>
        </div>
      </Tile>

      <Tile label="Active Days" icon={<Activity size={20} strokeWidth={2} className="shrink-0 text-accent" />}>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono type-display-sm font-bold text-foreground">{streak.activeDays}</span>
          <span className="type-label text-muted-foreground">{streak.activeLast30} in the last 30</span>
        </div>
      </Tile>

      <div className="flex min-w-[200px] flex-1 items-center gap-2.5 rounded-[10px] border border-card-border bg-card/60 px-4 py-3">
        <Layers size={18} strokeWidth={2} className="shrink-0 text-muted-foreground" />
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-baseline gap-x-1.5 type-micro font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Work done
            <span className="font-normal normal-case tracking-normal text-subtle-foreground">{pace}</span>
          </span>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
              style={{ width: `${Math.min(100, progress.workPct)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The dashboard's stat tile, minus the button. Nothing here opens anything. */
function Tile({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-card-border bg-card/60 px-4 py-3">
      {icon}
      <div className="flex flex-col">
        <span className="type-micro font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        {children}
      </div>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width={60} height={60} viewBox="0 0 60 60" className="-rotate-90">
      <circle cx="30" cy="30" r={radius} fill="none" stroke="var(--card-border)" strokeWidth="4" />
      <circle
        cx="30"
        cy="30"
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.min(100, Math.max(0, pct)) / 100)}
      />
    </svg>
  );
}
