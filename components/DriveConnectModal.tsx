"use client";

import React, { useState } from "react";

export type DriveModalMode = "connect" | "manage";

interface DriveConnectModalProps {
  mode: DriveModalMode;
  initialClientId: string;
  isAuthenticated: boolean;
  onConnect: (clientId: string) => void;
  onDisconnect: () => void;
  onClose: () => void;
}

export default function DriveConnectModal({
  mode,
  initialClientId,
  isAuthenticated,
  onConnect,
  onDisconnect,
  onClose,
}: DriveConnectModalProps) {
  const [clientId, setClientId] = useState(initialClientId);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel max-w-[460px] w-full flex flex-col gap-5 p-8 border !border-accent relative rounded-lg"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 bg-transparent border-none text-zinc-400 text-[1.2rem] cursor-pointer"
        >
          ✕
        </button>

        <div>
          <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded font-semibold uppercase font-mono tracking-[0.05em]">
            Google Drive
          </span>
          <h2 className="text-[1.3rem] font-bold text-white mt-2 mb-1">
            {mode === "connect" ? "Connect Cloud Sync" : "Manage Connection"}
          </h2>
          <p className="text-[0.85rem] text-zinc-400 m-0 leading-normal">
            {mode === "connect"
              ? "Your progress is stored in your own Google Drive (hidden app folder). Enter the OAuth Client ID of your Google Cloud project to connect."
              : `Status: ${isAuthenticated ? "authenticated" : "not authenticated"}. Disconnecting clears the stored Client ID and access token from this browser.`}
          </p>
        </div>

        {mode === "connect" && (
          <div>
            <label className="block text-[0.7rem] text-zinc-400 mb-1.5 uppercase tracking-[0.05em]">
              OAuth Client ID
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="xxxxxxxx.apps.googleusercontent.com"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && clientId.trim()) onConnect(clientId.trim());
              }}
              className="w-full px-3 py-2 rounded-md bg-black/30 border border-card-border text-white outline-none font-[inherit] text-[0.85rem]"
            />
          </div>
        )}

        <div className={`flex ${mode === "manage" ? "justify-between" : "justify-end"} gap-3 items-center`}>
          {mode === "manage" && (
            <button
              onClick={onDisconnect}
              className="bg-red-500/10 text-red-500 border border-red-500/30 rounded-md px-4 py-2 text-[0.85rem] cursor-pointer font-[inherit]"
            >
              Disconnect Drive
            </button>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn px-4 py-2 text-[0.85rem] !bg-transparent !text-zinc-400 !border-white/10 hover:!text-white"
            >
              Cancel
            </button>
            {mode === "connect" && (
              <button
                onClick={() => clientId.trim() && onConnect(clientId.trim())}
                className="btn px-5 py-2 text-[0.85rem] disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!clientId.trim()}
              >
                Connect & Sync
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
