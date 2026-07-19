"use client";

import React, { useEffect, useState } from "react";
import { fetchAppState } from "@/lib/api";
import { renderMarkdownToHtml } from "@/lib/markdown";

export default function RoadmapPage() {
  const [synced, setSynced] = useState<boolean | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppState()
      .then(async (data) => {
        if (data && data.isSynced) {
          setSynced(true);
          const res = await fetch("/api/roadmap");
          if (res.ok) {
            const json = await res.json();
            setHtmlContent(renderMarkdownToHtml(json.content || "", "<p>No roadmap found.</p>"));
          } else {
            setHtmlContent("<p>Failed to load roadmap content.</p>");
          }
        } else {
          setSynced(false);
        }
      })
      .catch((err) => {
        console.error(err);
        setSynced(false);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "#a1a1aa", fontFamily: "monospace" }}>Loading roadmap...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid var(--card-border)", paddingBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "var(--accent)" }}>&gt;_</span> Master Curriculum
        </h1>
        <a href="/" style={{ fontSize: "0.8rem", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>&larr; Back to Hub</a>
      </div>
      
      {synced ? (
        <div 
          className="notes-preview-pane glass-panel" 
          style={{ padding: "2rem 2.5rem", display: "block" }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      ) : (
        <div 
          className="glass-panel" 
          style={{ 
            padding: "3rem", 
            textAlign: "center", 
            borderRadius: "8px", 
            border: "1px dashed rgba(239, 68, 68, 0.3)",
            background: "rgba(239, 68, 68, 0.02)"
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🔒</div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: "#f87171", marginBottom: "0.5rem" }}>Roadmap Locked</h2>
          <p style={{ color: "#a1a1aa", fontSize: "0.9rem", maxWidth: "450px", margin: "0 auto 1.5rem" }}>
            The master curriculum is private. Please connect your Google Drive account on the main dashboard to unlock and load your personalized developer roadmap.
          </p>
          <a 
            href="/" 
            style={{ 
              display: "inline-block", 
              padding: "0.5rem 1.5rem", 
              background: "var(--accent)", 
              color: "#000", 
              fontWeight: 700, 
              borderRadius: "4px", 
              textDecoration: "none", 
              fontSize: "0.8rem" 
            }}
          >
            Go to Dashboard & Sync
          </a>
        </div>
      )}
    </div>
  );
}
