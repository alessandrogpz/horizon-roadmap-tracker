"use client";

import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import Link from "next/link";
import { fetchWorkspace, updateWorkspace } from "@/lib/api";
import { renderMarkdownToHtml } from "@/lib/markdown";
import type { TrackState, Workspace } from "@/lib/types";

type LoadState = "loading" | "unsynced" | "ready";

export default function RoadmapPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [content, setContent] = useState("");
  const [tab, setTab] = useState<"write" | "preview">("preview");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchWorkspace()
      .then((ws) => {
        const data = ws.tracks[ws.activeTrackId];
        if (!data || !data.isSynced) {
          setLoadState("unsynced");
          return;
        }
        setWorkspace(ws);
        setContent(data.roadmapContent || "");
        setTab(data.roadmapContent ? "preview" : "write");
        setLoadState("ready");
      })
      .catch((err) => {
        console.error(err);
        setLoadState("unsynced");
      });
  }, []);

  const activeTrack: TrackState | null = workspace ? workspace.tracks[workspace.activeTrackId] : null;

  const persist = (newContent: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus("saving");
    saveTimeoutRef.current = setTimeout(async () => {
      if (!workspace || !activeTrack) return;
      const newWorkspace: Workspace = {
        ...workspace,
        tracks: { ...workspace.tracks, [workspace.activeTrackId]: { ...activeTrack, roadmapContent: newContent } },
      };
      setWorkspace(newWorkspace);
      try {
        await updateWorkspace(newWorkspace);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Failed to save roadmap", err);
        setSaveStatus("idle");
      }
    }, 800);
  };

  const handleChange = (value: string) => {
    setContent(value);
    persist(value);
  };

  if (loadState === "loading") {
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
          <span className="text-accent">&gt;_</span> {activeTrack ? `${activeTrack.meta.name}: Full Roadmap` : "Full Roadmap"}
        </h1>
        <Link href="/" className="text-[0.8rem] text-accent no-underline font-semibold">&larr; Back to Hub</Link>
      </div>

      {loadState === "unsynced" && (
        <div className="glass-panel p-12 text-center rounded-lg !border !border-dashed !border-red-500/30 !bg-red-500/[0.02]">
          <h2 className="text-[1.2rem] font-semibold text-red-400 mb-2">Roadmap Locked</h2>
          <p className="text-zinc-400 text-[0.9rem] max-w-[450px] mx-auto mb-6">
            Please connect your Google Drive account on the main dashboard to unlock your roadmap.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-accent text-black font-bold rounded no-underline text-[0.8rem]"
          >
            Go to Dashboard & Sync
          </Link>
        </div>
      )}

      {loadState === "ready" && (
        <div className="glass-panel block">
          <div className="flex items-center justify-between border-b border-card-border px-6 pt-4">
            <div className="flex gap-1">
              <button
                className={`px-4 py-2 text-[0.8rem] font-semibold uppercase tracking-[0.05em] border-b-2 -mb-px cursor-pointer bg-transparent ${
                  tab === "write" ? "text-accent border-accent" : "text-zinc-500 border-transparent hover:text-white"
                }`}
                onClick={() => setTab("write")}
              >
                Write
              </button>
              <button
                className={`px-4 py-2 text-[0.8rem] font-semibold uppercase tracking-[0.05em] border-b-2 -mb-px cursor-pointer bg-transparent ${
                  tab === "preview" ? "text-accent border-accent" : "text-zinc-500 border-transparent hover:text-white"
                }`}
                onClick={() => setTab("preview")}
              >
                Preview
              </button>
            </div>
            <span className="text-[0.7rem] font-mono text-zinc-500 inline-flex items-center gap-1">
              {saveStatus === "saving" && "Saving..."}
              {saveStatus === "saved" && (<><Check size={12} strokeWidth={2.5} /> Saved</>)}
              {saveStatus === "idle" && "This track's own private roadmap — autosaves"}
            </span>
          </div>

          {tab === "write" ? (
            <textarea
              value={content}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Write your full roadmap using Markdown..."
              className="notes-editor-textarea min-h-[500px] px-10 py-8"
            />
          ) : content ? (
            <div
              className="notes-preview-pane px-10 py-8"
              dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(content, "<p>Nothing written yet.</p>") }}
            />
          ) : (
            <div className="px-10 py-16 text-center">
              <p className="text-zinc-400 text-[0.9rem] mb-4">You haven&apos;t written a roadmap for this track yet.</p>
              <button onClick={() => setTab("write")} className="btn px-5 py-2 text-[0.85rem]">
                Start Writing
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
