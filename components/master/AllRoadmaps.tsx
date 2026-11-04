"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Lock } from "lucide-react";
import { renderMarkdownToHtml } from "@/lib/markdown";
import { masterRoadmaps, masterSources } from "@/lib/masterTrack";
import { orderedTracks } from "@/lib/selectors";
import { useAppSettings } from "@/lib/useAppSettings";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";

/**
 * Every track's roadmap, on one page.
 *
 * Not stacked end to end. Six roadmaps printed one after another is a document
 * nobody reads to the bottom of, and a reader who wants the fitness plan has
 * to scroll past the database one to find it. So the page keeps a list of them
 * down the side and shows one at a time — the same information, arranged so
 * that reading any one of them is still possible.
 *
 * Read-only, like everything else in the master view. The editable version of
 * each of these is one click away, in the track itself.
 */
export default function AllRoadmaps() {
  const { workspace, status } = useWorkspace();
  const settings = useAppSettings();

  const roadmaps = useMemo(() => {
    if (!workspace) return [];
    return masterRoadmaps(masterSources(orderedTracks(workspace), settings.masterExcluded));
  }, [settings.masterExcluded, workspace]);

  const [openId, setOpenId] = useState<string | null>(null);
  const current = roadmaps.find((entry) => entry.track.id === openId) ?? roadmaps[0];

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-muted-foreground">Loading roadmaps...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-card-border pb-4">
        <h1 className="m-0 flex items-center gap-2 text-2xl font-bold">
          <span className="text-accent">&gt;_</span> All roadmaps
          <span
            className="inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-card-border bg-surface-muted px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.05em] text-subtle-foreground"
            title="Open a track to edit its roadmap."
          >
            <Lock size={10} strokeWidth={2.5} />
            Read only
          </span>
        </h1>
        <Link href="/" className="shrink-0 text-[0.8rem] font-semibold text-accent no-underline">
          &larr; Back to Hub
        </Link>
      </div>

      {roadmaps.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 rounded-lg py-16 text-center">
          <FileText size={28} strokeWidth={1.75} className="text-muted-foreground" />
          <p className="m-0 text-sm font-medium text-foreground">No roadmaps written yet</p>
          <p className="m-0 max-w-[380px] text-xs text-subtle-foreground">
            A track&apos;s roadmap is its own private document — the plan behind the phases. Open a
            track and write one, and it will show up here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
          {/* The index. Sticky on a desk, an ordinary row of chips on a phone
              — a 220-point column beside a document is most of a phone. */}
          <nav className="flex flex-row flex-wrap gap-2 lg:sticky lg:top-6 lg:h-fit lg:flex-col">
            {roadmaps.map((entry) => {
              const on = entry.track.id === current?.track.id;
              const color = entry.track.color || "var(--accent)";
              return (
                <button
                  key={entry.track.id}
                  onClick={() => setOpenId(entry.track.id)}
                  aria-current={on}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-left text-[0.85rem] font-semibold transition-colors ${
                    on ? "text-foreground" : "border-card-border bg-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  }`}
                  style={on ? { borderColor: color, background: `color-mix(in srgb, ${color} 12%, transparent)` } : undefined}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="min-w-0 flex-1 truncate">{entry.track.name}</span>
                </button>
              );
            })}
          </nav>

          {current && (
            <div className="glass-panel block min-w-0">
              <div className="flex items-center justify-between gap-3 border-b border-card-border px-6 py-3">
                <span className="flex min-w-0 items-center gap-2">
                  {/* The track's colour, as a dot on its name rather than a
                      stripe down the side of the card. Same information, and
                      it sits with the thing it identifies. */}
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: current.track.color || "var(--accent)" }}
                  />
                  <span className="min-w-0 truncate text-[0.95rem] font-semibold text-foreground">
                    {current.track.name}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[0.7rem] text-subtle-foreground">
                  {current.content.trim().split(/\s+/).length} words
                </span>
              </div>
              <div
                className="notes-preview-pane px-10 py-8"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdownToHtml(current.content, "<p>Nothing written yet.</p>"),
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
