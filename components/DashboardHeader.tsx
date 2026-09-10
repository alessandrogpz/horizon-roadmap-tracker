"use client";

import React, { useEffect, useRef, useState } from "react";
import type { TrackState, Workspace } from "@/lib/types";
import { daysSince, todayYMD } from "@/lib/dates";
import { currentStreakLength } from "@/lib/streak";
import { visibleTracks } from "@/lib/selectors";
import type { SyncStatus } from "@/components/workspace/WorkspaceProvider";
import { Cloud, Flame } from "lucide-react";
import HorizonMark from "@/components/HorizonMark";
import TrackSwitcher from "@/components/TrackSwitcher";
import TrackSettingsModal from "@/components/TrackSettingsModal";
import ThemeToggle from "@/components/ThemeToggle";
import TopBarMenu, { type ModuleState } from "@/components/TopBarMenu";
import SettingsModal from "@/components/SettingsModal";
import StatDetailModal, { type StatMetric } from "@/components/StatDetailModal";

/** Re-exported for the header's own consumers; the provider owns the type. */
export type { SyncStatus };

interface DashboardHeaderProps {
  data: TrackState;
  workspace: Workspace;
  syncStatus: SyncStatus;
  syncError: string;
  onSync: (e: React.MouseEvent) => void;
  onOpenCloudMenu: () => void;
  onSwitchTrack: (trackId: string) => void;
  /** Resolves once the new track is active. */
  onNewTrack: () => Promise<void>;
  onEditTrack: (fields: { name: string; color: string; startDate: string; totalDays: number }) => void;
  onDeleteTrack: () => void;
  canDeleteTrack: boolean;
  moduleState: ModuleState[];
  onToggleModule: (id: string) => void;
  /** Opens the weekly-rhythm editor — same dialog the Weekly Plan panel uses. */
  onEditRhythm: () => void;
  /** Opens the "create a rotation" flow. */
  onNewRotation: () => void;
  /** Re-reads the workspace from storage, after a restore or a wipe. */
  onReloadWorkspace: () => void;
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

/** One hero stat tile — elevated surface, muted label, large mono value.
 *  Every tile opens its own detail panel, so it's a button, not a div. */
function StatTile({
  label,
  icon,
  onClick,
  children,
  className = "",
}: {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={`${label} — click for detail`}
      className={`flex items-center gap-3 rounded-[10px] border border-card-border bg-card/60 px-4 py-3 text-left cursor-pointer transition-colors duration-200 hover:border-card-border-hover hover:bg-surface-hover focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--ring)] ${className}`}
    >
      {icon}
      <div className="flex flex-col">
        <span className="text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground font-semibold">{label}</span>
        {children}
      </div>
    </button>
  );
}

export default function DashboardHeader({ data, workspace, syncStatus, syncError, onSync, onOpenCloudMenu, onSwitchTrack, onNewTrack, onEditTrack, onDeleteTrack, canDeleteTrack, moduleState, onToggleModule, onEditRhythm, onNewRotation, onReloadWorkspace }: DashboardHeaderProps) {
  const [showTrackSettings, setShowTrackSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // A new track starts blank as "New Track", so go straight to its settings:
  // that's where it gets a real name, colour, start date and length.
  const handleNewTrack = async () => {
    await onNewTrack();
    setShowTrackSettings(true);
  };
  // Which hero metric has its detail panel open, if any.
  const [openStat, setOpenStat] = useState<StatMetric | null>(null);
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
      {/* Line 1: identity, which track, and whether it's saved — the things
          you read. Everything you *do* occasionally lives in the ⋮ menu, so
          this stays one row on a phone instead of wrapping to three. */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-[0.85rem]">
        <h1 className="text-[1.3rem] font-bold text-foreground m-0 flex items-center gap-2 tracking-[-0.01em] shrink-0">
          <HorizonMark className="h-[0.85em] w-auto text-accent" /> Horizon
        </h1>

        <span className="text-card-border hidden sm:inline">|</span>

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-muted-foreground hidden sm:inline">Track:</span>
          <TrackSwitcher
            tracks={visibleTracks(workspace)}
            activeTrackId={workspace.activeTrackId}
            onSwitch={onSwitchTrack}
            onNewTrack={() => void handleNewTrack()}
          />
        </div>

        <span className="text-card-border hidden sm:inline">|</span>

        {/* Sync status, clickable to sync. Stays in the bar on purpose: a
            status indicator hidden inside a menu stops being one. */}
        <div
          onClick={onSync}
          className={`flex items-center gap-2 text-muted-foreground select-none w-fit py-1 px-2 -mx-2 rounded transition-colors duration-200 min-w-0 ${
            syncStatus === "syncing" ? "cursor-not-allowed" : "cursor-pointer hover:bg-surface-hover"
          }`}
          title={syncStatus === "error" ? syncError : "Click to sync with Google Drive"}
        >
          <div className={`w-2 h-2 rounded-full transition-all duration-300 shrink-0 ${dotColor}`} />
          <span className="font-medium truncate">
            {syncStatus === "syncing" && "Syncing..."}
            {syncStatus === "error" && "Sync Error (retry)"}
            {syncStatus === "success" && "Synced"}
            {syncStatus === "idle" && (workspace.hasUnsyncedChanges ? "Unsynced (Click to Sync)" : "Synced with Cloud")}
          </span>
          <span className="text-card-border hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            <LastSyncedLabel timestamp={workspace.lastSyncTime} />
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <TopBarMenu
            trackName={data.meta.name}
            roadmapEnabled={!!data.isSynced}
            modules={moduleState}
            onToggleModule={onToggleModule}
            onEditTrack={() => setShowTrackSettings(true)}
            onEditRhythm={onEditRhythm}
            onNewRotation={onNewRotation}
            onNewTrack={() => void handleNewTrack()}
            onOpenCloud={onOpenCloudMenu}
            onOpenSettings={() => setShowSettings(true)}
          />
        </div>
      </div>

      {/* Hero metrics — the "am I on track?" glance, up front. */}
      <div className="flex items-stretch gap-3 flex-wrap">
        <StatTile
          label="Current Streak"
          icon={<Flame size={20} strokeWidth={2} className="text-warning shrink-0" />}
          onClick={() => setOpenStat("streak")}
        >
          <div className="flex items-baseline gap-1.5">
            <CountUp value={streak} className="text-[1.5rem] font-bold font-mono text-foreground leading-none" />
            <span className="text-[0.8rem] text-muted-foreground">{streak === 1 ? "day" : "days"}</span>
          </div>
        </StatTile>

        <StatTile
          label="Timeline"
          onClick={() => setOpenStat("timeline")}
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

        <StatTile label="Phase Day" onClick={() => setOpenStat("phase")}>
          <span className="text-[1.5rem] font-bold font-mono text-foreground leading-none">{daysInPhase}</span>
        </StatTile>

        <button
          onClick={() => setOpenStat("progress")}
          title="Progress — click for detail"
          className="flex items-center gap-2.5 rounded-[10px] border border-card-border bg-card/60 px-4 py-3 flex-1 min-w-[200px] text-left cursor-pointer transition-colors duration-200 hover:border-card-border-hover hover:bg-surface-hover focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--ring)]"
        >
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
        </button>
      </div>

      {openStat && (
        <StatDetailModal metric={openStat} track={data} onClose={() => setOpenStat(null)} />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onOpenCloudMenu={onOpenCloudMenu}
          onRestored={onReloadWorkspace}
        />
      )}

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
