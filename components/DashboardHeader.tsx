"use client";

import React, { useState } from "react";
import type { TrackState, Workspace } from "@/lib/types";
import { daysSince } from "@/lib/dates";
import { visibleTracks } from "@/lib/api";
import TrackSwitcher from "@/components/TrackSwitcher";
import TrackSettingsModal from "@/components/TrackSettingsModal";

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

  const dotColor = syncStatus === "syncing"
    ? "bg-accent shadow-[0_0_8px_var(--accent)]"
    : syncStatus === "error"
      ? "bg-red-500 shadow-[0_0_8px_#ef4444]"
      : workspace.hasUnsyncedChanges
        ? "bg-yellow-500 shadow-[0_0_8px_#eab308]"
        : "bg-emerald-500 shadow-[0_0_8px_#10b981]";

  return (
    <header className="main-header w-full flex flex-col gap-2.5 border-b border-card-border pb-5">
      {/* Line 1: Identity + track + roadmap link + sync status, all inline */}
      <div className="flex items-center gap-3 flex-wrap text-[0.85rem]">
        <h1 className="text-[1.3rem] font-bold text-white m-0 flex items-center gap-2 tracking-[-0.01em] shrink-0">
          <span className="text-accent">&gt;_</span> Horizon
        </h1>

        <span className="text-card-border">|</span>

        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Track:</span>
          <TrackSwitcher
            tracks={visibleTracks(workspace)}
            activeTrackId={workspace.activeTrackId}
            onSwitch={onSwitchTrack}
            onNewTrack={onNewTrack}
          />
          <button
            onClick={() => setShowTrackSettings(true)}
            className="bg-transparent border-none text-zinc-600 hover:text-white cursor-pointer text-[0.8rem] p-0"
            title="Edit track name/color"
            aria-label="Edit track"
          >
            ✎
          </button>
        </div>

        {/* Every track has its own private, editable roadmap doc. */}
        <span className="text-card-border">|</span>
        {data.isSynced ? (
          <a href="/roadmap" className="link-title !text-accent no-underline font-semibold inline-flex items-center gap-1">
            Full Roadmap
          </a>
        ) : (
          <span className="text-zinc-600 font-semibold cursor-not-allowed" title="Connect Google Drive to unlock roadmap">
            Full Roadmap (Locked)
          </span>
        )}

        <span className="text-card-border">|</span>

        {/* Cloud status, clickable to sync */}
        <div
          onClick={onSync}
          className={`flex items-center gap-2 text-zinc-400 select-none w-fit py-1 px-2 -mx-2 rounded transition-colors duration-200 ${
            syncStatus === "syncing" ? "cursor-not-allowed" : "cursor-pointer hover:bg-white/5"
          }`}
          title={syncStatus === "error" ? syncError : "Click to sync with Google Drive"}
        >
          <div className={`w-2 h-2 rounded-full transition-all duration-300 shrink-0 ${dotColor}`} />
          <span className="font-medium">
            {syncStatus === "syncing" && "Syncing..."}
            {syncStatus === "error" && "Sync Error (retry)"}
            {syncStatus === "success" && "Synced ✓"}
            {syncStatus === "idle" && (workspace.hasUnsyncedChanges ? "Unsynced (Click to Sync)" : "Synced with Cloud")}
          </span>
          <span className="text-zinc-700">•</span>
          <span className="text-zinc-500">{getRelativeTimeString(workspace.lastSyncTime)}</span>
        </div>

        <button
          onClick={onOpenCloudMenu}
          className="flex items-center justify-center w-7 h-7 rounded-md bg-transparent border border-white/10 text-zinc-400 cursor-pointer hover:text-white hover:border-white/25 shrink-0"
          title="Cloud connection & backup"
          aria-label="Cloud connection & backup"
        >
          ⋯
        </button>
      </div>

      {/* Line 2: Compact phase day + progress */}
      <div className="flex items-center gap-4 flex-wrap text-[0.85rem] text-zinc-400">
        <div>
          <span className="text-zinc-500 mr-1.5">Phase Day:</span>
          <span className="text-white font-semibold font-mono">{daysInPhase}</span>
        </div>
        <span className="text-card-border">|</span>
        <div className="flex items-center gap-3 min-w-[250px] flex-1 max-w-[400px]">
          <span className="text-zinc-500">Progress:</span>
          <span className="text-white font-semibold font-mono shrink-0">{daysPassed}/{totalDays}</span>
          <div className="flex-1 h-1.5 bg-white/[0.08] rounded-[3px] overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-300"
              style={{ width: `${Math.min(100, (daysPassed / totalDays) * 100)}%` }}
            />
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
