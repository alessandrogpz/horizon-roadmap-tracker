"use client";

import React, { useState } from "react";
import type { Phase } from "@/lib/types";
import { renderMarkdownToHtml } from "@/lib/markdown";

interface RoadmapStepProps {
  trackName: string;
  phases: Phase[];
  content: string;
  onChange: (content: string) => void;
}

/** Barebones markdown outline built from what the user has already filled
 *  in — a starting point, not a final answer. */
export function buildRoadmapOutline(trackName: string, phases: Phase[]): string {
  const phaseSections = phases
    .map((p) => `### ${p.title}\n\n${p.description || "_What does this phase involve?_"}\n`)
    .join("\n");

  return `# ${trackName || "My Roadmap"}\n\n## Overview\n\n_What's the bigger goal this all builds toward?_\n\n## Phases\n\n${phaseSections}`;
}

export default function RoadmapStep({ trackName, phases, content, onChange }: RoadmapStepProps) {
  const [tab, setTab] = useState<"write" | "preview">("write");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[1.1rem] font-semibold text-foreground m-0">Write your full roadmap</h2>
        <button
          onClick={() => onChange(buildRoadmapOutline(trackName, phases))}
          className="bg-transparent border-none text-accent text-xs cursor-pointer font-mono p-0 underline"
        >
          Regenerate outline
        </button>
      </div>
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
