"use client";

import React, { useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { Phase } from "@/lib/types";
import { renderMarkdownToHtml } from "@/lib/markdown";
import { hasAIConfigured } from "@/lib/ai/provider";
import { generateRoadmapDoc } from "@/lib/ai/generateRoadmap";
import { useGeneration } from "@/lib/ai/useGeneration";

interface RoadmapStepProps {
  trackName: string;
  phases: Phase[];
  content: string;
  onChange: (content: string) => void;
  /** The user's original goal text, when they arrived via AI generation. Gives
   *  the draft something to aim at beyond the phase titles. */
  goal?: string;
}

/** Barebones markdown outline built from what the user has already filled
 *  in — a starting point, not a final answer. */
export function buildRoadmapOutline(trackName: string, phases: Phase[]): string {
  const phaseSections = phases
    .map((p) => `### ${p.title}\n\n${p.description || "_What does this phase involve?_"}\n`)
    .join("\n");

  return `# ${trackName || "My Roadmap"}\n\n## Overview\n\n_What's the bigger goal this all builds toward?_\n\n## Phases\n\n${phaseSections}`;
}

export default function RoadmapStep({ trackName, phases, content, onChange, goal }: RoadmapStepProps) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  // Read once on mount: settings can't change while the wizard is open, and a
  // lazy initializer keeps this off the server render.
  const [aiReady] = useState(hasAIConfigured);
  const { busy, error, canRetry, run, cancel, retry } = useGeneration<string>();

  const draftWithAI = () => {
    setConfirmOverwrite(false);
    void run(
      (signal) => generateRoadmapDoc(trackName, goal ?? "", phases, signal),
      (markdown) => {
        onChange(markdown);
        setTab("preview");
      },
    );
  };

  // Same rule the wizard applies at the Phases step: never silently replace
  // something the user wrote themselves.
  //
  // "Themselves" is the operative word. Leaving the Phases step auto-fills this
  // box with buildRoadmapOutline(), so a plain length check would prompt the
  // user to confirm overwriting text they never typed. Comparing against the
  // outline we generate distinguishes the two without tracking extra state.
  const isUntouchedOutline = content.trim() === buildRoadmapOutline(trackName, phases).trim();

  const handleDraftClick = () => {
    if (content.trim().length > 0 && !isUntouchedOutline) setConfirmOverwrite(true);
    else draftWithAI();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[1.1rem] font-semibold text-foreground m-0">Write your full roadmap</h2>
        <div className="flex items-center gap-3">
          {aiReady && (
            busy ? (
              <button
                onClick={cancel}
                className="bg-transparent border-none text-muted-foreground text-xs cursor-pointer font-mono p-0 underline"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={handleDraftClick}
                className="bg-transparent border-none text-accent text-xs cursor-pointer font-mono p-0 underline"
              >
                Draft this for me
              </button>
            )
          )}
          <button
            onClick={() => onChange(buildRoadmapOutline(trackName, phases))}
            disabled={busy}
            className="bg-transparent border-none text-accent text-xs cursor-pointer font-mono p-0 underline disabled:opacity-40"
          >
            Regenerate outline
          </button>
        </div>
      </div>

      {busy && (
        <div className="flex items-center gap-2 rounded-md border border-card-border bg-surface-muted p-3 text-[0.8rem] text-muted-foreground">
          <LoaderCircle className="animate-spin text-accent" size={14} strokeWidth={2.5} />
          Drafting your roadmap…
        </div>
      )}

      {confirmOverwrite && (
        <div className="flex flex-col gap-2 rounded-md border border-card-border bg-surface-muted p-3">
          <span className="text-[0.82rem] text-foreground">
            Replace what you&apos;ve already written with an AI draft?
          </span>
          <div className="flex gap-2">
            <button onClick={draftWithAI} className="btn px-3 py-1 text-[0.78rem]">
              Replace it
            </button>
            <button
              onClick={() => setConfirmOverwrite(false)}
              className="btn px-3 py-1 text-[0.78rem] !bg-transparent !text-muted-foreground !border-card-border"
            >
              Keep mine
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex flex-col gap-2 rounded-md border border-red-500/30 bg-card p-3">
          <span className="whitespace-pre-line text-[0.85rem] text-red-400">{error}</span>
          {/* Only offered when another attempt could actually succeed — a
              rejected key will fail identically however many times you ask. */}
          {canRetry && !busy && (
            <button onClick={retry} className="btn self-start px-3 py-1 text-[0.78rem]">
              Try again
            </button>
          )}
        </div>
      )}
      <p className="text-muted-foreground text-[0.85rem] m-0">
        This is your own document — private to this track, nobody else can see it. Started from your phases above;
        add as much detail as you want. You can keep editing it anytime from the dashboard.
      </p>

      <div className="flex border-b border-card-border">
        <button
          className={`px-4 py-2 text-[0.8rem] font-semibold uppercase tracking-[0.05em] border-b-2 -mb-px cursor-pointer bg-transparent ${
            tab === "write" ? "text-accent border-accent" : "text-muted-foreground border-transparent hover:text-foreground"
          }`}
          onClick={() => setTab("write")}
        >
          Write
        </button>
        <button
          className={`px-4 py-2 text-[0.8rem] font-semibold uppercase tracking-[0.05em] border-b-2 -mb-px cursor-pointer bg-transparent ${
            tab === "preview" ? "text-accent border-accent" : "text-muted-foreground border-transparent hover:text-foreground"
          }`}
          onClick={() => setTab("preview")}
        >
          Preview
        </button>
      </div>

      {tab === "write" ? (
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your full roadmap using Markdown..."
          className="bg-input-bg border border-card-border rounded-md text-foreground text-[0.85rem] outline-none p-4 font-[inherit] leading-relaxed min-h-[320px] resize-y"
        />
      ) : (
        <div
          className="notes-preview-pane glass-panel min-h-[320px]"
          dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(content, "<p>Nothing written yet.</p>") }}
        />
      )}
    </div>
  );
}
