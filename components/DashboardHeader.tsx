"use client";

import React, { useEffect, useRef, useState } from "react";
import type { TrackState, Workspace } from "@/lib/types";
import { daysSince, todayYMD } from "@/lib/dates";
import { currentStreakLength } from "@/lib/streak";
import { visibleTracks } from "@/lib/api";
import { Pencil, Ellipsis, Cloud, Map, Flame } from "lucide-react";
import TrackSwitcher from "@/components/TrackSwitcher";
import TrackSettingsModal from "@/components/TrackSettingsModal";
import ThemeToggle from "@/components/ThemeToggle";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

interface DashboardHeaderProps {
  data: TrackState;
  workspace: Workspace;
  syncStatus: SyncStatus;
  syncError: string;
  onSync: (e: React.MouseEvent) => void;
  onOpenCloudMenu: () => void;
  onSwitchTrack: (trackId: string) => void;
  onNewTrack: () => void;
  onEditTrack: (fields: { name: string; color: string; startDate: string; totalDays: number }) => void;
  onDeleteTrack: () => void;
  canDeleteTrack: boolean;
}

const getRelativeTimeString = (timestamp: number | undefined) => {
  if (!timestamp) return "Never";
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "Just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
};

/** Self-ticking relative-time label. Owns its own 15s interval so refreshing
 *  the "last synced" text re-renders only this span, not the whole dashboard. */
function LastSyncedLabel({ timestamp }: { timestamp: number | undefined }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);
  return <span className="text-muted-foreground">{getRelativeTimeString(timestamp)}</span>;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Animates a number up to `value` on mount / when it changes. A small, cheap
 *  micro-interaction for the hero metrics. */
function CountUp({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    fromRef.current = value;
    if (from === to || prefersReducedMotion()) {
      setDisplay(to);
      return;
    }
    const duration = 600;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{display}</span>;
}

/** Circular progress ring — the hero's focal "Day X of Y" element. */
function ProgressRing({ pct, size = 60 }: { pct: number; size?: number }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-border)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - clamped / 100)}
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)" }}
      />
    </svg>
  );
}

/** One hero stat tile — elevated surface, muted label, large mono value. */
function StatTile({
  label,
  icon,
  children,
  className = "",
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-[10px] border border-card-border bg-card/60 px-4 py-3 ${className}`}>
      {icon}
      <div className="flex flex-col">
        <span className="text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground font-semibold">{label}</span>
        {children}
      </div>
    </div>
  );
}

export default function DashboardHeader({ data, workspace, syncStatus, syncError, onSync, onOpenCloudMenu, onSwitchTrack, onNewTrack, onEditTrack, onDeleteTrack, canDeleteTrack }: DashboardHeaderProps) {
  const [showTrackSettings, setShowTrackSettings] = useState(false);
  const daysPassed = data.startDate && data.isSynced ? daysSince(data.startDate) : 0;
  const daysInPhase: number | string = data.isSynced
    ? daysSince(data.currentPhaseStartDate || data.startDate)
    : "--";

  // Track duration generalizes per template: the last phase with a
  // recommendedByDay threshold defines the track's horizon; falls back to
  // 365 for tracks/templates that don't set one.
  const lastThresholdPhase = [...data.phases].reverse().find((p) => p.recommendedByDay !== undefined);
  const totalDays = lastThresholdPhase?.recommendedByDay ?? 365;
  const progressPct = totalDays > 0 ? (daysPassed / totalDays) * 100 : 0;

  const streak = data.isSynced ? currentStreakLength(data.streakHistory, todayYMD()) : 0;

  const dotColor = syncStatus === "syncing"
    ? "bg-accent shadow-[0_0_8px_var(--accent)]"
    : syncStatus === "error"
      ? "bg-red-500 shadow-[0_0_8px_#ef4444]"
      : workspace.hasUnsyncedChanges
        ? "bg-yellow-500 shadow-[0_0_8px_#eab308]"
        : "bg-emerald-500 shadow-[0_0_8px_#10b981]";

  return (
    <header className="main-header w-full flex flex-col gap-4 border-b border-card-border pb-5">
      {/* Line 1: Identity + track + roadmap link + sync status, all inline */}
      <div className="flex items-center gap-3 flex-wrap text-[0.85rem]">
        <h1 className="text-[1.3rem] font-bold text-foreground m-0 flex items-center gap-2 tracking-[-0.01em] shrink-0">
          <span className="text-accent font-mono">&gt;_</span> Horizon
        </h1>

        <span className="text-card-border">|</span>

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Track:</span>
          <TrackSwitcher
            tracks={visibleTracks(workspace)}
            activeTrackId={workspace.activeTrackId}
            onSwitch={onSwitchTrack}
            onNewTrack={onNewTrack}
          />
          <button
            onClick={() => setShowTrackSettings(true)}
            className="flex items-center text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-colors"
            title="Edit track name/color"
            aria-label="Edit track"
          >
            <Pencil size={13} strokeWidth={2} />
          </button>
        </div>

        {/* Every track has its own private, editable roadmap doc. */}
        <span className="text-card-border">|</span>
        {data.isSynced ? (
          <a href="/roadmap" className="link-title !text-accent no-underline font-semibold inline-flex items-center gap-1.5">
            <Map size={14} strokeWidth={2} /> Full Roadmap
          </a>
        ) : (
          <span className="text-muted-foreground/70 font-semibold cursor-not-allowed inline-flex items-center gap-1.5" title="Connect Google Drive to unlock roadmap">
            <Map size={14} strokeWidth={2} /> Full Roadmap (Locked)
          </span>
        )}

        <span className="text-card-border">|</span>

        {/* Cloud status, clickable to sync */}
        <div
          onClick={onSync}
          className={`flex items-center gap-2 text-muted-foreground select-none w-fit py-1 px-2 -mx-2 rounded transition-colors duration-200 ${
            syncStatus === "syncing" ? "cursor-not-allowed" : "cursor-pointer hover:bg-surface-hover"
          }`}
          title={syncStatus === "error" ? syncError : "Click to sync with Google Drive"}
        >
          <div className={`w-2 h-2 rounded-full transition-all duration-300 shrink-0 ${dotColor}`} />
          <span className="font-medium">
            {syncStatus === "syncing" && "Syncing..."}
            {syncStatus === "error" && "Sync Error (retry)"}
            {syncStatus === "success" && "Synced"}
            {syncStatus === "idle" && (workspace.hasUnsyncedChanges ? "Unsynced (Click to Sync)" : "Synced with Cloud")}
          </span>
          <span className="text-card-border">•</span>
          <LastSyncedLabel timestamp={workspace.lastSyncTime} />
        </div>

        <button
          onClick={onOpenCloudMenu}
          className="flex items-center justify-center w-7 h-7 rounded-md bg-transparent border border-card-border text-muted-foreground cursor-pointer hover:text-foreground hover:border-card-border-hover shrink-0 transition-colors"
          title="Cloud connection & backup"
          aria-label="Cloud connection & backup"
        >
          <Ellipsis size={15} strokeWidth={2} />
        </button>

        <ThemeToggle />
      </div>

      {/* Hero metrics — the "am I on track?" glance, up front. */}
      <div className="flex items-stretch gap-3 flex-wrap">
        <StatTile
          label="Current Streak"
          icon={<Flame size={20} strokeWidth={2} className="text-warning shrink-0" />}
        >
          <div className="flex items-baseline gap-1.5">
            <CountUp value={streak} className="text-[1.5rem] font-bold font-mono text-foreground leading-none" />
            <span className="text-[0.8rem] text-muted-foreground">{streak === 1 ? "day" : "days"}</span>
          </div>
        </StatTile>

        <StatTile
          label="Timeline"
          icon={
            <div className="relative shrink-0 grid place-items-center" style={{ width: 60, height: 60 }}>
              <ProgressRing pct={progressPct} />
              <span className="absolute inset-0 grid place-items-center text-[0.6rem] font-mono font-semibold text-accent">
                {Math.round(Math.min(100, progressPct))}%
              </span>
            </div>
          }
        >
          <div className="flex items-baseline gap-1.5">
            <span className="text-[1.5rem] font-bold font-mono text-foreground leading-none">{daysPassed}</span>
            <span className="text-[0.8rem] text-muted-foreground">/ {totalDays} days</span>
          </div>
        </StatTile>

        <StatTile label="Phase Day">
          <span className="text-[1.5rem] font-bold font-mono text-foreground leading-none">{daysInPhase}</span>
        </StatTile>

        <div className="flex items-center gap-2.5 rounded-[10px] border border-card-border bg-card/60 px-4 py-3 flex-1 min-w-[200px]">
          <Cloud size={18} strokeWidth={2} className="text-muted-foreground shrink-0" />
          <div className="flex flex-col flex-1 gap-1.5">
            <span className="text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground font-semibold">Progress</span>
            <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-[width] duration-500"
                style={{ width: `${Math.min(100, progressPct)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {showTrackSettings && (
        <TrackSettingsModal
          name={data.meta.name}
          color={data.meta.color}
          startDate={data.startDate}
          totalDays={totalDays}
          onSave={onEditTrack}
          onDelete={onDeleteTrack}
          canDelete={canDeleteTrack}
          onClose={() => setShowTrackSettings(false)}
        />
      )}
    </header>
  );
}
