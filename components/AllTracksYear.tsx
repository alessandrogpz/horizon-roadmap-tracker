"use client";

import { useEffect, useMemo, useRef } from "react";
import { Flame } from "lucide-react";
import type { TrackState } from "@/lib/types";
import { MONTH_NAMES, timelineStats, yearCalendar, yearRuler } from "@/lib/stats";
import { restScheduleOf, trackStreak } from "@/lib/restDays";
import TrackRing from "@/components/TrackRing";
import TrackYearStrip from "@/components/TrackYearStrip";
import { trackInkVariables } from "@/lib/trackAccent";

/**
 * Every track's year at once: one strip per track, stacked.
 *
 * A person running three tracks has three grids and no way to ask the one
 * question that spans them — did I do *anything* yesterday, and how does this
 * one's summer compare with that one's winter. Stacking them answers it, and
 * only works because every row is the same calendar year: the same Tuesday is
 * the same column on every row.
 *
 * The names and their progress rings are pinned at the left and the years
 * scroll under them, so a narrow window loses the far end of the year rather
 * than losing track of whose row is whose.
 */

const CELL = 11;
const GAP = 3;
const COLUMN = CELL + GAP;

export default function AllTracksYear({
  tracks,
  year,
  today,
  weekStartsOn,
}: {
  tracks: TrackState[];
  year: number;
  today: string;
  weekStartsOn: "sun" | "mon";
}) {
  const rows = useMemo(
    () =>
      tracks.map((track) => ({
        track,
        color: track.meta.color || "var(--accent)",
        days: yearCalendar(track.completedItemsHistory ?? {}, track.startDate, year, today, weekStartsOn),
        pct: timelineStats(track).progressPct,
        streak: trackStreak(track, today),
        // Each row's own days off: two tracks stacked here rarely rest on the
        // same day, and a shared answer would mark one of them wrongly.
        rest: restScheduleOf(track),
      })),
    [today, tracks, weekStartsOn, year]
  );

  // The scale the rows are hung on. Shared with the phone, which draws the
  // same stacked year — see `yearRuler`.
  const { columns, marks } = useMemo(() => yearRuler(year, today, weekStartsOn), [today, weekStartsOn, year]);

  /**
   * Opened at the recent end.
   *
   * A year starts in January and a track rarely does, so left to itself the
   * view opened on however many blank months came before the first real day —
   * in one case five of them, with the actual history off the right edge.
   * Jumped rather than animated, and once per year: this is where the graph
   * starts, not somewhere it travels to while you watch.
   */
  const strips = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = strips.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, [columns, year]);

  if (columns === 0 || rows.length === 0) return null;

  return (
    <div className="flex gap-3">
      {/* Narrower on a phone: a fixed 128 left only about ten weeks of strip
          beside it on a 375-point screen, which is not enough of a year to be
          worth stacking. */}
      <div className="w-[104px] shrink-0 sm:w-[128px]">
        {/* Level with the strips, which start one label-row lower. */}
        <div style={{ height: 16 }} />
        {rows.map((row) => (
          <div key={row.track.meta.id} className="flex items-start gap-1.5" style={{ height: 7 * CELL + 6 * GAP, marginBottom: 12 }}>
            <TrackRing
              pct={row.pct}
              color={row.color}
              title={`${row.track.meta.name}: ${Math.round(row.pct)}% through its timeline`}
            />
            <div className="min-w-0 flex flex-col gap-1">
              <span className="type-label font-semibold text-foreground line-clamp-2">
                {row.track.meta.name}
              </span>
              {row.streak > 0 && (
                <span
                  className="track-ink inline-flex items-center gap-1 self-start rounded px-1.5 py-px type-micro font-bold"
                  style={{ ...trackInkVariables(row.color), background: "var(--surface-hover)" } as React.CSSProperties}
                >
                  <Flame size={9} strokeWidth={2.5} />
                  {row.streak}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div ref={strips} className="min-w-0 flex-1 overflow-x-auto">
        <div style={{ width: columns * COLUMN }}>
          <div className="relative type-micro text-subtle-foreground" style={{ height: 16 }}>
            {marks.map((mark) => (
              <span key={mark.month} className="absolute top-0" style={{ left: mark.column * COLUMN }}>
                {MONTH_NAMES[mark.month]}
              </span>
            ))}
          </div>

          {rows.map((row) => (
            <TrackYearStrip
              key={row.track.meta.id}
              days={row.days}
              color={row.color}
              cell={CELL}
              gap={GAP}
              start={row.track.startDate}
              today={today}
              rest={row.rest}
              // Never padded out to a full fifty-three weeks here, which is
              // what the strip does when it is one of a list of different
              // ages. These rows are already the same length as each other
              // and as the ruler the month names are placed along — a year
              // capped at today, blank where a track had not started —
              // because `yearCalendar` pads them. Padding again added the
              // thirteen weeks between today and New Year's Eve to the front
              // of every row, so each row's days began thirteen columns to
              // the right of the month they were under.
              pad={false}
              className="mb-3"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
