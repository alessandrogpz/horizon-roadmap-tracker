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

  return (
    <header
      className="main-header"
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        borderBottom: "1px solid var(--card-border)",
        paddingBottom: "1.5rem"
      }}
    >
      {/* Line 1: Title */}
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", letterSpacing: "-0.01em" }}>
        <span style={{ color: "var(--accent)" }}>&gt;_</span> Engine Developer Hub
      </h1>

      {/* Line 2: 12-Month subtitle & roadmap link */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.85rem" }}>
        <span style={{ color: "#a1a1aa" }}>12-Month Graphics Programming Tracker</span>
        <span style={{ color: "var(--card-border)" }}>|</span>
        {data.isSynced ? (
          <a
            href="/roadmap"
            style={{
              color: "var(--accent)",
              textDecoration: "none",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem"
            }}
            className="link-title"
          >
            Full Roadmap
          </a>
        ) : (
          <span
            style={{ color: "#52525b", fontWeight: 600, cursor: "not-allowed" }}
            title="Connect Google Drive to unlock roadmap"
          >
            Full Roadmap (Locked)
          </span>
        )}
      </div>

      {/* Line 3: Cloud status line, clickable to sync */}
      <div
        onClick={onSync}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.85rem",
          color: "#a1a1aa",
          cursor: syncStatus === "syncing" ? "not-allowed" : "pointer",
          userSelect: "none",
          width: "fit-content",
          padding: "0.2rem 0.5rem",
          borderRadius: "4px",
          marginLeft: "-0.5rem",
          transition: "background 0.2s ease"
        }}
        onMouseOver={(e) => {
          if (syncStatus !== "syncing") {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
          }
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
        title={syncStatus === "error" ? syncError : "Click to sync with Google Drive (Shift+Click to disconnect)"}
      >
        <div style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: syncStatus === "syncing" ? "var(--accent)" : syncStatus === "error" ? "#ef4444" : (data.hasUnsyncedChanges ? "#eab308" : "#10b981"),
          boxShadow: syncStatus === "syncing" ? "0 0 8px var(--accent)" : syncStatus === "error" ? "0 0 8px #ef4444" : (data.hasUnsyncedChanges ? "0 0 8px #eab308" : "0 0 8px #10b981"),
          transition: "all 0.3s ease",
          flexShrink: 0
        }} />
        <span style={{ fontWeight: 500 }}>
          {syncStatus === "syncing" && "Syncing with cloud..."}
          {syncStatus === "error" && "Sync Error (Click to retry)"}
          {syncStatus === "success" && "Sync Complete ✓"}
          {syncStatus === "idle" && (data.hasUnsyncedChanges ? "Unsynced Changes (Click to Sync)" : "Synced with Cloud")}
        </span>
        <span style={{ color: "#3f3f46" }}>•</span>
        <span style={{ color: "#71717a" }}>Last Sync: {getRelativeTimeString(data.lastSyncTime)}</span>
      </div>

      {/* Line 4: Phase day and Year Progress */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", fontSize: "0.85rem", color: "#a1a1aa", marginTop: "0.25rem" }}>
        <div>
          <span style={{ color: "#71717a", marginRight: "0.4rem" }}>Phase Day:</span>
          <span style={{ color: "#fff", fontWeight: 600, fontFamily: "monospace" }}>{daysInPhase}</span>
        </div>
        <span style={{ color: "var(--card-border)" }}>|</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: "250px" }}>
          <span style={{ color: "#71717a" }}>Progress:</span>
          <span style={{ color: "#fff", fontWeight: 600, fontFamily: "monospace", flexShrink: 0 }}>{daysPassed}/365</span>
          <div style={{ flex: 1, height: "6px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(100, (daysPassed / 365) * 100)}%`,
                height: "100%",
                backgroundColor: "var(--accent)",
                transition: "width 0.3s ease"
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
