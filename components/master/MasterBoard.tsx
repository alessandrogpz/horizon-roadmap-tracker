"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Layers, Lock, ScrollText } from "lucide-react";
import type { TrackState } from "@/lib/types";
import { masterRoadmaps, masterSources } from "@/lib/masterTrack";
import {
  MasterConsistencyPanel,
  MasterDeliverablesPanel,
  MasterMaterialsPanel,
  MasterPhasesPanel,
  MasterTodoPanel,
  MasterWeekPanel,
} from "./MasterPanels";

/**
 * Every track at once, in the shape of the dashboard.
 *
 * The same two columns, the same panels in the same places — because the whole
 * value of this view is that it is the thing you already know how to read,
 * with more in it. What it is not is a dashboard you can arrange: the panels
 * here do not drag and cannot be closed, which is the same answer as
 * everything else about this view. There is nothing to save, so there is
 * nothing to arrange.
 *
 * Read-only is stated once, in the band at the top, rather than repeated as a
 * disabled control on every row. A disabled button is a thing that looks like
 * it should work.
 */
export default function MasterBoard({
  tracks,
  excluded,
  onToggleTrack,
  weekOffset,
  setWeekOffset,
}: {
  /** Every visible track, in the order the list is in. */
  tracks: TrackState[];
  /** Ids switched off. */
  excluded: readonly string[];
  onToggleTrack: (trackId: string) => void;
  weekOffset: number;
  setWeekOffset: (offset: number) => void;
}) {
  const sources = useMemo(() => masterSources(tracks, excluded), [excluded, tracks]);
  const roadmaps = useMemo(() => masterRoadmaps(sources), [sources]);

  return (
    <>
      <div className="col-span-full flex flex-col gap-3">
        <TrackPicker tracks={tracks} excluded={excluded} onToggle={onToggleTrack} roadmaps={roadmaps.length} />
      </div>

      {sources.length === 0 ? (
        <div className="col-span-full glass-panel flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Layers size={28} strokeWidth={1.75} className="text-muted-foreground" />
          <p className="m-0 type-body font-medium text-foreground">Every track is switched off</p>
          <p className="m-0 max-w-[360px] type-caption text-subtle-foreground">
            Turn one back on above. Switching a track off here only leaves it out of this view — the
            track itself is untouched.
          </p>
        </div>
      ) : (
        <>
          {/* The same two columns the dashboard puts these panels in, so the
              master view is the board you already know how to read with more
              in it: the week, the phases and the grid on the left, the lists
              on the right. */}
          <div className="flex flex-col gap-8">
            <MasterWeekPanel tracks={sources} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
            <MasterPhasesPanel tracks={sources} />
            <MasterConsistencyPanel tracks={sources} />
          </div>
          <div className="flex flex-col gap-8">
            <MasterDeliverablesPanel tracks={sources} />
            <MasterMaterialsPanel tracks={sources} />
            <MasterTodoPanel tracks={sources} />
          </div>
        </>
      )}
    </>
  );
}

/**
 * Which tracks are in the view.
 *
 * One row of switches rather than a menu: with six tracks the question "what
 * am I looking at" is asked constantly, and an answer behind a click is an
 * answer you stop checking. Switching one off changes nothing but this view —
 * said in the line underneath, because a switch next to a track's name in an
 * app that can delete tracks deserves to be unambiguous.
 */
function TrackPicker({
  tracks,
  excluded,
  onToggle,
  roadmaps,
}: {
  tracks: TrackState[];
  excluded: readonly string[];
  onToggle: (trackId: string) => void;
  roadmaps: number;
}) {
  const off = new Set(excluded);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="glass-panel flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="section-title !mb-0">
          <Layers size={14} strokeWidth={2.5} className="section-icon" />
          All tracks
        </h2>
        <span
          className="inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-card-border bg-surface-muted px-2 py-0.5 type-caption font-semibold text-subtle-foreground"
          title="Nothing in this view can be edited. Open a track to change it."
        >
          <Lock size={10} strokeWidth={2.5} />
          Read only
        </span>

        {roadmaps > 0 && (
          <Link
            href="/roadmap?all=1"
            className="ml-auto inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-card-border bg-surface-muted px-2.5 py-1 type-label font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ScrollText size={13} strokeWidth={2} />
            All {roadmaps} roadmap{roadmaps === 1 ? "" : "s"}
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {tracks.map((track) => {
          const on = !off.has(track.meta.id);
          const color = track.meta.color || "var(--accent)";
          return (
            <button
              key={track.meta.id}
              onClick={() => onToggle(track.meta.id)}
              aria-pressed={on}
              title={on ? `Leave ${track.meta.name} out of this view` : `Put ${track.meta.name} back in this view`}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border px-2.5 py-1.5 type-label font-semibold transition-colors ${
                on ? "text-foreground" : "border-card-border bg-transparent text-subtle-foreground hover:text-muted-foreground"
              }`}
              style={on ? { borderColor: color, background: `color-mix(in srgb, ${color} 12%, transparent)` } : undefined}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: on ? color : "var(--card-border-hover)" }}
              />
              <span className="max-w-[11rem] truncate">{track.meta.name}</span>
              {on ? (
                <Eye size={12} strokeWidth={2.2} className="shrink-0 opacity-70" />
              ) : (
                <EyeOff size={12} strokeWidth={2.2} className="shrink-0 opacity-70" />
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setShowHelp((v) => !v)}
        className="w-fit cursor-pointer border-none bg-transparent p-0 text-left type-caption text-subtle-foreground underline"
      >
        {showHelp ? "Hide" : "What is this?"}
      </button>
      {showHelp && (
        <p className="m-0 max-w-2xl type-label text-muted-foreground">
          Every track you have, in one board. The week shows what each one asks of each day, the
          grid puts every track&apos;s days in one square — divided, not blended, so you can still
          see whose is whose — and the lists, phases and numbers run across all of them. Progress is
          averaged by how long each goal is, so a three-year track is not outvoted by a three-week
          one. Switching a track off here leaves it out of this view only; nothing about the track
          itself changes, and nothing in this view can be edited.
        </p>
      )}
    </div>
  );
}
