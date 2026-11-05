"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { renderMarkdownToHtml } from "@/lib/markdown";
import AllRoadmaps from "@/components/master/AllRoadmaps";
import { WorkspaceProvider, useWorkspace, useWorkspaceActions } from "@/components/workspace/WorkspaceProvider";
import { LIMITS } from "@/lib/limits";

const SAVE_DEBOUNCE_MS = 800;

function RoadmapEditor() {
  const { track, status } = useWorkspace();
  const { updateTrack, flush } = useWorkspaceActions();

  const [content, setContent] = useState("");
  const [tab, setTab] = useState<"write" | "preview">("preview");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Seeded once from the loaded track. Re-seeding on later renders would fight
  // the user's cursor, since our own saves flow back through the same state.
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current || !track) return;
    seededRef.current = true;
    setContent(track.roadmapContent || "");
    setTab(track.roadmapContent ? "preview" : "write");
  }, [track]);

  const handleChange = (value: string) => {
    setContent(value);
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      updateTrack((previous) => ({ ...previous, roadmapContent: value }));
      await flush();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, SAVE_DEBOUNCE_MS);
  };

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-muted-foreground font-mono">Loading roadmap...</p>
      </div>
    );
  }

  const locked = !track || !track.isSynced;

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8">
      <div className="flex justify-between items-center mb-6 border-b border-card-border pb-4">
        <h1 className="type-display-sm font-bold m-0 flex items-center gap-2">
          <span className="text-accent">&gt;_</span> {track ? `${track.meta.name}: Full Roadmap` : "Full Roadmap"}
        </h1>
        <Link href="/" className="type-label text-accent no-underline font-semibold">&larr; Back to Hub</Link>
      </div>

      {locked && (
        <div className="glass-panel text-center rounded-lg [--panel-pad:3rem] !border !border-dashed !border-danger/30 !bg-danger/[0.02]">
          <h2 className="type-heading font-semibold text-danger mb-2">Roadmap Locked</h2>
          <p className="text-muted-foreground type-subhead max-w-[450px] mx-auto mb-6">
            Please connect your Google Drive account on the main dashboard to unlock your roadmap.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-accent text-black font-bold rounded no-underline type-label"
          >
            Go to Dashboard &amp; Sync
          </Link>
        </div>
      )}

      {!locked && (
        <div className="glass-panel block">
          <div className="flex items-center justify-between border-b border-card-border px-6 pt-4">
            <div className="flex gap-1">
              <button
                className={`px-4 py-2 type-label font-semibold border-b-2 -mb-px cursor-pointer bg-transparent ${
                  tab === "write" ? "text-accent border-accent" : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
                onClick={() => setTab("write")}
              >
                Write
              </button>
              <button
                className={`px-4 py-2 type-label font-semibold border-b-2 -mb-px cursor-pointer bg-transparent ${
                  tab === "preview" ? "text-accent border-accent" : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
                onClick={() => setTab("preview")}
              >
                Preview
              </button>
            </div>
            <span className="type-caption font-mono text-muted-foreground inline-flex items-center gap-1">
              {saveStatus === "saving" && "Saving..."}
              {saveStatus === "saved" && (<><Check size={12} strokeWidth={2.5} /> Saved</>)}
              {saveStatus === "idle" && "This track's own private roadmap — autosaves"}
            </span>
          </div>

          {tab === "write" ? (
            <textarea
            maxLength={LIMITS.document}
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
              <p className="text-muted-foreground type-subhead mb-4">You haven&apos;t written a roadmap for this track yet.</p>
              <button onClick={() => setTab("write")} className="btn px-5 py-2 type-body">
                Start Writing
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** One track's roadmap, or every track's. `?all=1` is how the master view
 *  reaches this page; without it nothing about this route has changed. */
function Roadmap() {
  const all = useSearchParams().get("all") === "1";
  return all ? <AllRoadmaps /> : <RoadmapEditor />;
}

export default function RoadmapPage() {
  return (
    <WorkspaceProvider>
      {/* `useSearchParams` reads something that only exists once the request
          is known, so the route would otherwise opt the whole page out of
          static rendering. */}
      <React.Suspense fallback={null}>
        <Roadmap />
      </React.Suspense>
    </WorkspaceProvider>
  );
}
