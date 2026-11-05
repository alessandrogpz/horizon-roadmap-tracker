"use client";

import React, { useEffect, useRef, useState } from "react";
import type { TrackState, Workspace } from "@/lib/types";
import { daysSince, todayYMD } from "@/lib/dates";
import { trackStreak } from "@/lib/restDays";
import { phaseStats } from "@/lib/stats";
import { orderedTracks } from "@/lib/selectors";
import type { SyncStatus } from "@/components/workspace/WorkspaceProvider";
import HorizonMark from "@/components/HorizonMark";
import TrackSwitcher from "@/components/TrackSwitcher";
import MasterStats from "@/components/master/MasterStats";
import TrackSettingsModal from "@/components/TrackSettingsModal";
import ThemeToggle from "@/components/ThemeToggle";
import TopBarMenu, { type ModuleState } from "@/components/TopBarMenu";
import SettingsModal from "@/components/SettingsModal";
import InsightsModal from "@/components/InsightsModal";
import { useAccount } from "@/components/useAccount";
import StatDetailModal, { type StatMetric } from "@/components/StatDetailModal";

/** Re-exported for the header's own consumers; the provider owns the type. */
export type { SyncStatus };

interface DashboardHeaderProps {
  data: TrackState;
  workspace: Workspace;
  syncStatus: SyncStatus;
  syncError: string;
  /** Where the sync button sends the data: the Horizon account, or Drive. */
  syncTarget?: "account" | "local";
  onSync: (e: React.MouseEvent) => void;
  onSwitchTrack: (trackId: string) => void;
  /** Resolves once the new track is active. */
  onNewTrack: () => Promise<void>;
  onEditTrack: (fields: { name: string; color: string; startDate: string; totalDays: number }) => void;
  /** With an id, that track; without one, the open one. */
  onDeleteTrack: (trackId?: string) => void;
  /** Saves a new order for the track list. */
  onReorderTracks: (orderedIds: string[]) => void;
  /**
   * The master view: every track at once, read-only. When it is open the
   * header shows its numbers instead of the open track's, and the menu drops
   * everything that would edit a track — there is no track here to edit.
   */
  masterTracks?: TrackState[] | null;
  masterOpen?: boolean;
  onOpenMaster?: () => void;
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

/**
 * One figure under the opening line.
 *
 * These were four bordered tiles with a tracked label and a bold
 * mono number — the row every dashboard opens with, and in a product whose
 * first line already says the day, the rhythm and the streak, four boxes
 * repeating it was the loudest thing on the screen. They are type now: a
 * label in sentence case and a figure at regular weight, sitting on the page
 * rather than in a card. Each still opens its detail panel, which is the only
 * reason they are buttons.
 */
function StatFigure({
  label,
  value,
  unit,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={`${label} — open the detail`}
      className="group flex flex-col items-start gap-0.5 bg-transparent border-none p-0 text-left cursor-pointer focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--ring)] rounded-[4px]"
    >
      <span className="type-caption text-subtle-foreground group-hover:text-muted-foreground transition-colors">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="type-display-sm font-normal tabular-nums text-foreground">{value}</span>
        {unit ? <span className="type-caption text-muted-foreground">{unit}</span> : null}
      </span>
    </button>
  );
}

export default function DashboardHeader({ data, workspace, syncStatus, syncError, syncTarget = "local", onSync, onSwitchTrack, onNewTrack, onEditTrack, onDeleteTrack, onReorderTracks, masterTracks, masterOpen = false, onOpenMaster, canDeleteTrack, moduleState, onToggleModule, onEditRhythm, onNewRotation, onReloadWorkspace }: DashboardHeaderProps) {
  const [showTrackSettings, setShowTrackSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const account = useAccount();

  // A new track starts blank as "New Track", so go straight to its settings:
  // that's where it gets a real name, colour, start date and length.
  const handleNewTrack = async () => {
    await onNewTrack();
    setShowTrackSettings(true);
  };
  // Which hero metric has its detail panel open, if any.
  const [openStat, setOpenStat] = useState<StatMetric | null>(null);
  const daysPassed = data.startDate && data.isSynced ? daysSince(data.startDate) : 0;
  // Through `phaseStats`, not worked out here: a phase's day count is the time
  // spent in it, including stretches before the track last moved away and came
  // back, and that sum lives in one place. Counting from the current start
  // date meant this tile reset to day one whenever a phase was revisited —
  // and disagreed with the detail panel behind it, which already asked
  // `phaseStats`.
  const daysInPhase: number | string = data.isSynced
    ? phaseStats(data, todayYMD()).dayInPhase
    : "--";

  // Track duration generalizes per template: the last phase with a
  // recommendedByDay threshold defines the track's horizon; falls back to
  // 365 for tracks/templates that don't set one.
  const lastThresholdPhase = [...data.phases].reverse().find((p) => p.recommendedByDay !== undefined);
  const totalDays = lastThresholdPhase?.recommendedByDay ?? 365;
  const progressPct = totalDays > 0 ? (daysPassed / totalDays) * 100 : 0;
  // A plan that has run out is the ordinary end of a plan. Once it has, the
  // track stops being counted against a total it no longer has: "573 / 92
  // days" described a track that had gone wrong, when all that happened is
  // that the estimate was short, which estimates are.
  const overrunDays = Math.max(0, daysPassed - totalDays);

  const streak = data.isSynced ? trackStreak(data, todayYMD()) : 0;


  // Four states, four tokens. Three of these were raw Tailwind palette
  // colours with a literal hex in the glow — `bg-emerald-500` with
  // `#10b981`, `bg-yellow-500` with `#eab308`, and a `#ef4444` glow under a
  // `bg-danger` dot that is actually `#f87171`. Those are fixed values, so
  // the most-looked-at piece of chrome in the app was the only thing that
  // did not follow the theme: in light mode the success and warning tokens
  // deepen to #047857 and #b45309 to stay readable on a light surface, and
  // the dot kept the dark-mode greens. The glow now comes from the same
  // token as the fill, so the two can no longer disagree.
  const dotColor = syncStatus === "syncing"
    ? "bg-accent shadow-[0_0_8px_var(--accent)]"
    : syncStatus === "error"
      ? "bg-danger shadow-[0_0_8px_var(--danger)]"
      : workspace.hasUnsyncedChanges
        ? "bg-warning shadow-[0_0_8px_var(--warning)]"
        : "bg-success shadow-[0_0_8px_var(--success)]";

  return (
    <header className="main-header w-full flex flex-col gap-4 border-b border-card-border pb-5">
      {/* Line 1: identity, which track, and whether it's saved — the things
          you read. Everything you *do* occasionally lives in the ⋮ menu, so
          this stays one row on a phone instead of wrapping to three. */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap type-body">
        <h1 className="type-title font-bold text-foreground m-0 flex items-center gap-2 tracking-[-0.01em] shrink-0">
          <HorizonMark className="h-[0.85em] w-auto text-accent" /> Horizon
        </h1>

        <span aria-hidden="true" className="text-card-border hidden sm:inline">|</span>

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-muted-foreground hidden sm:inline">Track:</span>
          <TrackSwitcher
            tracks={orderedTracks(workspace)}
            activeTrackId={workspace.activeTrackId}
            onSwitch={onSwitchTrack}
            onNewTrack={() => void handleNewTrack()}
            onDelete={canDeleteTrack ? onDeleteTrack : undefined}
            onReorder={onReorderTracks}
            onOpenMaster={onOpenMaster}
            masterOpen={masterOpen}
          />
        </div>

        <span aria-hidden="true" className="text-card-border hidden sm:inline">|</span>

        {/* Sync status, clickable to sync. Stays in the bar on purpose: a
            status indicator hidden inside a menu stops being one. */}
        <div
          onClick={syncTarget === "account" ? onSync : () => setShowSettings(true)}
          className={`flex items-center gap-2 text-muted-foreground select-none w-fit py-1 px-2 -mx-2 rounded transition-colors duration-200 min-w-0 ${
            syncStatus === "syncing" ? "cursor-not-allowed" : "cursor-pointer hover:bg-surface-hover"
          }`}
          title={
            syncStatus === "error"
              ? syncError
              : syncTarget === "account"
                ? "Click to sync with your Horizon account"
                : "Saved on this device. Sign in to sync between devices."
          }
        >
          <div className={`w-2 h-2 rounded-full transition-colors duration-200 shrink-0 ${dotColor}`} />
          <span className="font-medium truncate">
            {syncStatus === "syncing" && "Syncing..."}
            {syncStatus === "error" && "Sync Error (retry)"}
            {syncStatus === "success" && "Synced"}
            {syncStatus === "idle" &&
              (syncTarget !== "account"
                ? "On this device"
                : workspace.hasUnsyncedChanges
                  ? "Unsynced (Click to Sync)"
                  : "Synced with account")}
          </span>
          <span aria-hidden="true" className="text-card-border hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            <LastSyncedLabel timestamp={workspace.lastSyncTime} />
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <TopBarMenu
            trackName={masterOpen ? "All tracks" : data.meta.name}
            readOnly={masterOpen}
            roadmapEnabled={!!data.isSynced}
            modules={moduleState}
            onToggleModule={onToggleModule}
            onEditTrack={() => setShowTrackSettings(true)}
            onEditRhythm={onEditRhythm}
            onNewRotation={onNewRotation}
            onNewTrack={() => void handleNewTrack()}
            onOpenSettings={() => setShowSettings(true)}
            onOpenInsights={account ? () => setShowInsights(true) : undefined}
          />
        </div>
      </div>

      {/* The track's standing: one measure, then the figures. These were four
          bordered tiles with tracked labels and bold mono numbers —
          the row every dashboard opens with. They are type on the page now. */}
      {masterOpen && masterTracks ? (
        <MasterStats tracks={masterTracks} />
      ) : (
      <div className="flex flex-col gap-5">
        {/* Where today sits in the track. A plan that has run out keeps the
            bar full rather than pretending there is more of it. */}
        {data.isSynced && data.startDate ? (
          <div
            className="h-[3px] w-full rounded-full bg-surface-hover overflow-hidden"
            role="img"
            aria-label={`Day ${daysPassed} of ${totalDays}`}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
              style={{ width: `${Math.min(100, Math.max(1.5, progressPct))}%` }}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
          <StatFigure
            label="Streak"
            value={<CountUp value={streak} className="type-display-sm font-normal tabular-nums text-foreground" />}
            unit={streak === 1 ? "day" : "days"}
            onClick={() => setOpenStat("streak")}
          />
          <StatFigure label="Phase day" value={daysInPhase} onClick={() => setOpenStat("phase")} />
          <StatFigure
            label="Timeline"
            value={daysPassed}
            unit={overrunDays > 0 ? `· ${overrunDays} past plan` : `of ${totalDays}`}
            onClick={() => setOpenStat("timeline")}
          />
          <StatFigure
            label="Progress"
            value={`${Math.round(Math.min(100, progressPct))}%`}
            onClick={() => setOpenStat("progress")}
          />
        </div>
      </div>
      )}

      {openStat && !masterOpen && (
        <StatDetailModal metric={openStat} track={data} onClose={() => setOpenStat(null)} />
      )}

      {showInsights && <InsightsModal onClose={() => setShowInsights(false)} onOpenTrack={onSwitchTrack} />}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
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
