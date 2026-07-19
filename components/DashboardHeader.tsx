"use client";

import React from "react";
import type { AppState } from "@/lib/types";
import { daysSince } from "@/lib/dates";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

interface DashboardHeaderProps {
  data: AppState;
  syncStatus: SyncStatus;
  syncError: string;
  onSync: (e: React.MouseEvent) => void;
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

export default function DashboardHeader({ data, syncStatus, syncError, onSync }: DashboardHeaderProps) {
  const daysPassed = data.startDate && data.isSynced ? daysSince(data.startDate) : 0;
  const daysInPhase: number | string = data.isSynced
    ? daysSince(data.currentPhaseStartDate || data.startDate)
    : "--";

  const dotColor = syncStatus === "syncing"
    ? "bg-accent shadow-[0_0_8px_var(--accent)]"
    : syncStatus === "error"
      ? "bg-red-500 shadow-[0_0_8px_#ef4444]"
      : data.hasUnsyncedChanges
        ? "bg-yellow-500 shadow-[0_0_8px_#eab308]"
        : "bg-emerald-500 shadow-[0_0_8px_#10b981]";

  return (
    <header className="main-header w-full flex flex-col gap-3 border-b border-card-border pb-6">
      {/* Line 1: Title */}
      <h1 className="text-[1.75rem] font-bold text-white m-0 flex items-center gap-2 tracking-[-0.01em]">
        <span className="text-accent">&gt;_</span> Engine Developer Hub
      </h1>

      {/* Line 2: 12-Month subtitle & roadmap link */}
      <div className="flex items-center gap-3 flex-wrap text-[0.85rem]">
        <span className="text-zinc-400">12-Month Graphics Programming Tracker</span>
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
      </div>

      {/* Line 3: Cloud status line, clickable to sync */}
      <div
        onClick={onSync}
        className={`flex items-center gap-2 text-[0.85rem] text-zinc-400 select-none w-fit py-1 px-2 rounded -ml-2 transition-colors duration-200 ${
          syncStatus === "syncing" ? "cursor-not-allowed" : "cursor-pointer hover:bg-white/5"
        }`}
        title={syncStatus === "error" ? syncError : "Click to sync with Google Drive (Shift+Click to manage connection)"}
      >
        <div className={`w-2 h-2 rounded-full transition-all duration-300 shrink-0 ${dotColor}`} />
        <span className="font-medium">
          {syncStatus === "syncing" && "Syncing with cloud..."}
          {syncStatus === "error" && "Sync Error (Click to retry)"}
          {syncStatus === "success" && "Sync Complete ✓"}
          {syncStatus === "idle" && (data.hasUnsyncedChanges ? "Unsynced Changes (Click to Sync)" : "Synced with Cloud")}
        </span>
        <span className="text-zinc-700">•</span>
        <span className="text-zinc-500">Last Sync: {getRelativeTimeString(data.lastSyncTime)}</span>
      </div>

      {/* Line 4: Phase day and Year Progress */}
      <div className="flex items-center gap-4 flex-wrap text-[0.85rem] text-zinc-400 mt-1">
        <div>
          <span className="text-zinc-500 mr-1.5">Phase Day:</span>
          <span className="text-white font-semibold font-mono">{daysInPhase}</span>
        </div>
        <span className="text-card-border">|</span>
        <div className="flex items-center gap-3 min-w-[250px]">
          <span className="text-zinc-500">Progress:</span>
          <span className="text-white font-semibold font-mono shrink-0">{daysPassed}/365</span>
          <div className="flex-1 h-1.5 bg-white/[0.08] rounded-[3px] overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-300"
              style={{ width: `${Math.min(100, (daysPassed / 365) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
