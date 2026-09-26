"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import TrackRing from "@/components/TrackRing";
import TrackYearStrip from "@/components/TrackYearStrip";
import { formatDayMonthYear, parseYMD } from "@/lib/dates";
import { PREVIEW_TODAY, PREVIEW_TRACKS } from "./phoneData";

/**
 * Three tracks, three colours, one calendar year — and you can pick about in
 * it.
 *
 * The real component the app draws in Consistency, at the same cell size,
 * from the same data. It was `aria-hidden` and inert, which is the wrong
 * thing to put next to a paragraph claiming the stack is readable at a
 * glance: the way to show that is to let someone read it.
 *
 * Picking a row brings it forward and pushes the others back, and picking a
 * day says what was done on it. Both are what the app does — the second
 * exactly, the first because a stack of three is worth being able to isolate.
 */
export default function TrackStackPreview() {
  const [focused, setFocused] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<{ track: string; date: string } | null>(null);

  const detail = openDay
    ? (PREVIEW_TRACKS.find((track) => track.id === openDay.track)?.history[openDay.date] ?? [])
    : [];

  return (
    <div className="glass-panel landing-preview flex min-w-0 select-none flex-col gap-3 overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 border-b border-card-border pb-3">
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Consistency · all tracks
        </span>
        <span className="font-mono text-[0.65rem] text-muted-foreground">2026</span>
      </div>

      <div className="flex gap-3">
        <div className="flex w-[104px] shrink-0 flex-col gap-3 sm:w-[132px]">
          {PREVIEW_TRACKS.map((track) => {
            const dimmed = focused !== null && focused !== track.id;
            return (
              <button
                key={track.id}
                onClick={() => {
                  setFocused((current) => (current === track.id ? null : track.id));
                  setOpenDay(null);
                }}
                aria-pressed={focused === track.id}
                title={`${track.name} — click to bring this row forward`}
                className="flex cursor-pointer items-start gap-2 rounded text-left transition-opacity"
                style={{ height: 7 * 11 + 6 * 3, opacity: dimmed ? 0.35 : 1 }}
              >
                <TrackRing pct={track.pct} color={track.color} />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-[0.72rem] font-semibold leading-tight text-foreground">{track.name}</span>
                  <span
                    className="inline-flex items-center gap-1 self-start rounded px-1.5 py-px text-[0.6rem] font-bold"
                    style={{ color: track.color, background: "var(--surface-hover)" }}
                  >
                    <Flame size={9} strokeWidth={2.5} />
                    {track.streak}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Faded at the right rather than cut, so the year reading off the
            edge is obviously deliberate. */}
        <div
          className="flex min-w-0 flex-col gap-3 overflow-hidden"
          style={{
            maskImage: "linear-gradient(to right, #000 82%, transparent)",
            WebkitMaskImage: "linear-gradient(to right, #000 82%, transparent)",
          }}
        >
          {PREVIEW_TRACKS.map((track) => (
            <div
              key={track.id}
              className="transition-opacity"
              style={{ opacity: focused !== null && focused !== track.id ? 0.3 : 1 }}
            >
              <TrackYearStrip
                days={track.days}
                color={track.color}
                cell={11}
                gap={3}
                start={track.startDate}
                today={PREVIEW_TODAY}
                pad={false}
                onDayClick={(date) => setOpenDay((current) => (current?.date === date && current.track === track.id ? null : { track: track.id, date }))}
              />
            </div>
          ))}
        </div>
      </div>

      {openDay && (
        <div className="flex flex-col gap-1 rounded-md border border-accent-muted bg-card/95 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.7rem] font-semibold">
              {formatDayMonthYear(parseYMD(openDay.date))} ·{" "}
              {PREVIEW_TRACKS.find((track) => track.id === openDay.track)?.name}
            </span>
            <button onClick={() => setOpenDay(null)} className="cursor-pointer text-subtle-foreground hover:text-foreground">
              ✕
            </button>
          </div>
          {detail.length > 0 ? (
            detail.slice(0, 3).map((item, index) => (
              <span key={index} className="text-[0.68rem] text-muted-foreground">
                · {typeof item === "string" ? item : item.title}
              </span>
            ))
          ) : (
            <span className="text-[0.68rem] italic text-subtle-foreground">Nothing logged on this day.</span>
          )}
        </div>
      )}
    </div>
  );
}
