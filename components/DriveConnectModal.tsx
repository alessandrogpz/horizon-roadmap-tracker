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
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel"
        style={{
          maxWidth: "460px",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          padding: "2rem",
          border: "1px solid var(--accent)",
          position: "relative",
          borderRadius: "8px"
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1.5rem",
            right: "1.5rem",
            background: "transparent",
            border: "none",
            color: "#a1a1aa",
            fontSize: "1.2rem",
            cursor: "pointer",
          }}
        >
          ✕
        </button>

        <div>
          <span style={{
            fontSize: "0.75rem",
            background: "rgba(14, 165, 233, 0.1)",
            color: "var(--accent)",
            padding: "0.15rem 0.5rem",
            borderRadius: "4px",
            fontWeight: 600,
            textTransform: "uppercase",
            fontFamily: "monospace",
            letterSpacing: "0.05em"
          }}>
            Google Drive
          </span>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff", marginTop: "0.5rem", marginBottom: "0.25rem" }}>
            {mode === "connect" ? "Connect Cloud Sync" : "Manage Connection"}
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#a1a1aa", margin: 0, lineHeight: 1.5 }}>
            {mode === "connect"
              ? "Your progress is stored in your own Google Drive (hidden app folder). Enter the OAuth Client ID of your Google Cloud project to connect."
              : `Status: ${isAuthenticated ? "authenticated" : "not authenticated"}. Disconnecting clears the stored Client ID and access token from this browser.`}
          </p>
        </div>

        {mode === "connect" && (
          <div>
            <label style={{ display: "block", fontSize: "0.7rem", color: "#a1a1aa", marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--card-border)",
                color: "#fff",
                outline: "none",
                fontFamily: "inherit",
                fontSize: "0.85rem"
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: mode === "manage" ? "space-between" : "flex-end", gap: "0.75rem", alignItems: "center" }}>
          {mode === "manage" && (
            <button
              onClick={onDisconnect}
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                color: "#ef4444",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "6px",
                padding: "0.5rem 1rem",
                fontSize: "0.85rem",
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            >
              Disconnect Drive
            </button>
          )}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={onClose}
              className="btn"
              style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", background: "transparent", color: "#a1a1aa", border: "1px solid rgba(255, 255, 255, 0.1)" }}
            >
              Cancel
            </button>
            {mode === "connect" && (
              <button
                onClick={() => clientId.trim() && onConnect(clientId.trim())}
                className="btn"
                style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem" }}
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
