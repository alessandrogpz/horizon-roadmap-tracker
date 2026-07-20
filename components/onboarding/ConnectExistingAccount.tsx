"use client";

import React, { useState } from "react";
import {
  authenticateGoogleDrive,
  getGoogleClientId,
  isGoogleAuthenticated,
  setGoogleClientId,
  syncWithGoogleDrive,
} from "@/lib/googleDrive";
import { fetchWorkspace, visibleTracks } from "@/lib/api";
import type { Workspace } from "@/lib/types";

interface ConnectExistingAccountProps {
  onConnected: (workspace: Workspace) => void;
  onBack: () => void;
}

type Status = "idle" | "connecting" | "empty" | "error";

export default function ConnectExistingAccount({ onConnected, onBack }: ConnectExistingAccountProps) {
  const [clientId, setClientId] = useState(getGoogleClientId());
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleConnect = async () => {
    const trimmed = clientId.trim();
    if (!trimmed) return;

    setStatus("connecting");
    setError("");
    try {
      setGoogleClientId(trimmed);
      if (!isGoogleAuthenticated()) {
        await authenticateGoogleDrive(trimmed);
      }
      const res = await syncWithGoogleDrive();
      if (!res.success) {
        throw new Error(res.error || "Sync failed");
      }
      const workspace = await fetchWorkspace();
      if (visibleTracks(workspace).length > 0) {
        onConnected(workspace);
      } else {
        setStatus("empty");
      }
    } catch (err) {
      console.error("Failed to connect existing account", err);
      setError(err instanceof Error ? err.message : "Failed to connect");
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-[1.1rem] font-semibold text-white m-0">Connect your existing account</h2>
      <p className="text-zinc-400 text-[0.85rem] m-0">
        If you&apos;ve already set up Horizon somewhere else (e.g. your computer) and are opening it here for the first
        time, connect the same Google Drive account to pull down your existing tracks.
      </p>

      <div className="flex flex-col gap-1.5">
        <label className="text-[0.8rem] text-zinc-400">OAuth Client ID</label>
        <input
          type="text"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="xxxxxxxx.apps.googleusercontent.com"
          onKeyDown={(e) => {
            if (e.key === "Enter" && clientId.trim()) handleConnect();
          }}
          className="bg-black/25 border border-card-border rounded-md text-white text-[0.9rem] outline-none px-3 py-2 font-[inherit]"
        />
      </div>

      {status === "empty" && (
        <div className="p-3 bg-card rounded-md border border-card-border text-zinc-300 text-[0.85rem]">
          Connected, but no existing tracks were found in this account. You can start fresh instead.
        </div>
      )}
      {status === "error" && (
        <div className="p-3 bg-card rounded-md border border-red-500/30 text-red-400 text-[0.85rem]">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="btn px-4 py-2 text-[0.85rem] !bg-transparent !text-zinc-400 !border-white/10 hover:!text-white"
        >
          Back
        </button>
        <button
          onClick={handleConnect}
          disabled={!clientId.trim() || status === "connecting"}
          className="btn px-6 py-2 text-[0.85rem] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === "connecting" ? "Connecting..." : "Connect & Sync"}
        </button>
      </div>
    </div>
  );
}
