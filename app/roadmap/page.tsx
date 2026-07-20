"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchWorkspace } from "@/lib/api";
import { renderMarkdownToHtml } from "@/lib/markdown";

type AccessState = "loading" | "wrong-track" | "unsynced" | "available";

export default function RoadmapPage() {
  const [access, setAccess] = useState<AccessState>("loading");
  const [htmlContent, setHtmlContent] = useState<string>("");

  useEffect(() => {
    fetchWorkspace()
      .then(async (workspace) => {
        const data = workspace.tracks[workspace.activeTrackId];
        // This curriculum doc only applies to the Game Engine & Graphics
        // track — never shown for any other track.
        if (!data || data.meta.templateId !== "engine-graphics") {
          setAccess("wrong-track");
          return;
        }
        if (!data.isSynced) {
          setAccess("unsynced");
          return;
        }
        const res = await fetch("/api/roadmap");
        if (res.ok) {
          const json = await res.json();
          setHtmlContent(renderMarkdownToHtml(json.content || "", "<p>No roadmap found.</p>"));
        } else {
          setHtmlContent("<p>Failed to load roadmap content.</p>");
        }
        setAccess("available");
      })
      .catch((err) => {
        console.error(err);
        setAccess("wrong-track");
      });
  }, []);

  if (access === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-zinc-400 font-mono">Loading roadmap...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8">
      <div className="flex justify-between items-center mb-6 border-b border-card-border pb-4">
        <h1 className="text-2xl font-bold m-0 flex items-center gap-2">
          <span className="text-accent">&gt;_</span> Master Curriculum
        </h1>
        <Link href="/" className="text-[0.8rem] text-accent no-underline font-semibold">&larr; Back to Hub</Link>
      </div>

      {access === "available" && (
        <div
          className="notes-preview-pane glass-panel block px-10 py-8"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )}

      {access === "wrong-track" && (
        <div className="glass-panel p-12 text-center rounded-lg !border !border-dashed !border-white/10">
          <h2 className="text-[1.2rem] font-semibold text-white mb-2">Not Available for This Track</h2>
          <p className="text-zinc-400 text-[0.9rem] max-w-[450px] mx-auto mb-6">
            This master curriculum belongs to the Game Engine &amp; Graphics track. Switch to that track from the
            dashboard to view it.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-accent text-black font-bold rounded no-underline text-[0.8rem]"
          >
            Back to Dashboard
          </Link>
        </div>
      )}

      {access === "unsynced" && (
        <div className="glass-panel p-12 text-center rounded-lg !border !border-dashed !border-red-500/30 !bg-red-500/[0.02]">
          <h2 className="text-[1.2rem] font-semibold text-red-400 mb-2">Roadmap Locked</h2>
          <p className="text-zinc-400 text-[0.9rem] max-w-[450px] mx-auto mb-6">
            The master curriculum is private. Please connect your Google Drive account on the main dashboard to unlock and load your personalized developer roadmap.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-accent text-black font-bold rounded no-underline text-[0.8rem]"
          >
            Go to Dashboard & Sync
          </Link>
        </div>
      )}
    </div>
  );
}
