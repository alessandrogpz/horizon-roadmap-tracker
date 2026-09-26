"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Check, ChevronLeft, ChevronRight, Flame, Layers, X } from "lucide-react";
import type { CompletedItem, TrackState } from "@/lib/types";
import { parseYMD, todayYMD } from "@/lib/dates";
import { currentStreakLength } from "@/lib/streak";
import { monthCalendar, yearCalendar, yearsWithHistory } from "@/lib/stats";
import { useAppSettings } from "@/lib/useAppSettings";
import AllTracksYear from "@/components/AllTracksYear";
import Portal from "@/components/Portal";
import StreakGrid, { type StreakCell } from "@/components/StreakGrid";

/** The two ways of laying the same days out. */
const SHAPES = [
  { value: "months", label: "By month" },
  { value: "continuous", label: "Continuous" },
] as const;

/** One step through the years. Disabled rather than hidden at the ends, so the
 *  control keeps its shape and the year stays where the eye left it. */
function YearStep({
  direction,
  disabled,
  onClick,
}: {
  direction: -1 | 1;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === -1 ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === -1 ? "Previous year" : "Next year"}
      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-card-border bg-surface-muted text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon size={13} strokeWidth={2.5} />
    </button>
  );
}

export default function StreakGraph({
  streakHistory = [],
  completedItemsHistory = {},
  startDate,
  color,
  tracks = [],
}: {
  streakHistory?: string[];
  completedItemsHistory?: { [date: string]: CompletedItem[] };
  startDate?: string;
  /** The open track's colour, for the key. The grid itself is painted through
   *  `--streak-1` … `--streak-4`, which the track's accent already rewrote. */
  color?: string;
  /** Every visible track, for the stacked view. Left empty, the control that
   *  reaches it is not drawn at all. */
  tracks?: TrackState[];
}) {
  const [selectedDateDetails, setSelectedDateDetails] = useState<string | null>(null);
  /**
   * Whose days these are: this track's, or every track's stacked.
   *
   * A person running three tracks has three panels and no way to ask the one
   * question that spans them — did I do *anything* yesterday. Only offered
   * when there is more than one track, because with one there is nothing to
   * stack and the control would be a switch between a thing and itself.
   */
  const [scope, setScope] = useState<"track" | "all">("track");
  /**
   * By month is the default, as it is on the phone: a calendar year as one
   * unbroken ribbon of weeks is hard to read a month out of, because nothing
   * marks where one ends. The continuous shape is still worth having for
   * seeing a long run at a glance, so it is a toggle rather than a
   * replacement.
   */
  const [byMonth, setByMonth] = useState(true);
  const settings = useAppSettings();
  const today = todayYMD();
  const [year, setYear] = useState(() => parseYMD(today).getFullYear());
  const canCombine = tracks.length > 1;
  const combined = scope === "all" && canCombine;

  /**
   * One calendar year, always — not the whole track.
   *
   * The grid used to run from the track's first day to today, so it grew as
   * the track did: by month twelve it was fifty-odd columns squeezed into a
   * half-width panel, at a few points a day. A year is a shape you can hold
   * in your head, it fits at a size you can actually see and click, and it
   * gives the arrows something to step through.
   */
  const days = useMemo(
    () => yearCalendar(completedItemsHistory, startDate || "", year, today, settings.weekStartsOn),
    [completedItemsHistory, settings.weekStartsOn, startDate, today, year]
  );

  const months = useMemo(
    () => monthCalendar(completedItemsHistory, startDate || "", year, today, settings.weekStartsOn),
    [completedItemsHistory, settings.weekStartsOn, startDate, today, year]
  );

  const years = useMemo(
    () => yearsWithHistory(completedItemsHistory, startDate || "", today),
    [completedItemsHistory, startDate, today]
  );

  const streak = useMemo(() => currentStreakLength(streakHistory, todayYMD()), [streakHistory]);
  const totalActive = streakHistory.length;

  // How many updates a day needs to reach each shade.
  const levelFor = (count: number) => {
    if (count === 0) return 0;
    if (count <= 1) return 1;
    if (count <= 2) return 2;
    if (count <= 3) return 3;
    return 4;
  };

  const itemAsObject = (it: CompletedItem) => (typeof it === "string" ? { title: it, description: "" } : { description: "", ...it });

  /** One day, as the grid wants it. Shared by both shapes so a square means
   *  the same thing, and is the same size, whichever way it is arranged. */
  const cellFor = (day: { date: string; count: number } | null, key: string): StreakCell => {
    if (!day) return { id: key, level: 0, filled: false };
    const items = completedItemsHistory[day.date] || [];
    const accomplishments = items.length
      ? `\nAccomplished:\n• ${items
          .map((it) => {
            const itemObj = itemAsObject(it);
            return itemObj.description ? `${itemObj.title} (${itemObj.description})` : itemObj.title;
          })
          .join("\n• ")}`
      : "";
    return {
      id: day.date,
      level: levelFor(day.count),
      mark: day.date === startDate ? "start" : day.date === today ? "today" : undefined,
      title:
        `${day.date}: ${day.count} update${day.count !== 1 ? "s" : ""}` +
        (day.date === startDate ? " — the day this track started" : "") +
        accomplishments,
    };
  };

  // `yearCalendar` returns week-major order, which is exactly how StreakGrid
  // flows: column-first over seven rows, one week per column.
  //
  // The weeks before the track existed are dropped, the same way months with
  // nothing in them are: a track that began in June otherwise opens on five
  // months of transparent squares, and every one of them is width you have to
  // scroll past to reach a day.
  const cells: StreakCell[] = useMemo(() => {
    let from = 0;
    while (from + 7 <= days.length && days.slice(from, from + 7).every((day) => !day.date)) from += 7;
    return days.slice(from).map((day, index) => cellFor(day.date ? day : null, `pad-${index}`));
    // `cellFor` closes over the history and the dates, which are the deps that
    // matter; it is redefined every render and would defeat the memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedItemsHistory, days, startDate, today]);

  /**
   * Both shapes open at the recent end, with today at the right.
   *
   * A year runs left to right and the question anyone opens this for is about
   * now, so the far end is where it should start — the beginning of the year
   * is the part you scroll back to, not the part you land on. Jumped rather
   * than animated: this is where the graph starts, not somewhere it travels
   * to while you watch.
   */
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, [byMonth, combined, cells.length, months.length, year]);

  /**
   * And again whenever the panel changes width, which the effect above cannot
   * see: a phone turning, the dashboard's two columns collapsing into one.
   * The content is the same, so nothing in the dependencies moves, and the
   * graph is left sitting on January at whatever offset the old width had.
   *
   * Only on a width change — a scroll does not resize anything, so scrolling
   * back through the year is never yanked forward.
   */
  const lastWidth = useRef(0);
  useEffect(() => {
    const node = scroller.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (node.clientWidth === lastWidth.current) return;
      lastWidth.current = node.clientWidth;
      node.scrollLeft = node.scrollWidth;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [byMonth, combined]);

  return (
    <div className="glass-panel">
      {/* The right-hand end stops short of the panel's hover chrome — the
          hide and drag buttons live in that corner, and although they are
          invisible until the panel is hovered, they still take the tap.
          Nothing clickable belongs under them. */}
      <div className="flex items-center justify-between gap-3 flex-wrap pr-16">
        <h2 className="section-title !mb-0">
          <Activity size={14} strokeWidth={2.5} className="section-icon" />
          Consistency
        </h2>
        <div className="flex items-center gap-3 text-[0.75rem] font-mono">
          <span className="inline-flex items-center gap-1 text-warning font-semibold">
            <Flame size={13} strokeWidth={2} />
            {streak} day{streak === 1 ? "" : "s"}
          </span>
          <span className="text-muted-foreground">{totalActive} active</span>
        </div>
      </div>

      {/* Shape, year and scope on one line of their own, below the heading
          and clear of the chrome. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!combined && (
          <div className="flex rounded-[var(--radius-control)] border border-card-border bg-surface-muted p-0.5">
            {SHAPES.map((shape) => {
              const on = (shape.value === "months") === byMonth;
              return (
                <button
                  key={shape.value}
                  onClick={() => setByMonth(shape.value === "months")}
                  aria-pressed={on}
                  className={`cursor-pointer rounded-[calc(var(--radius-control)-2px)] px-2.5 py-1 text-[0.72rem] font-semibold transition-colors ${
                    on ? "bg-card text-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {shape.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1">
          <YearStep
            direction={-1}
            disabled={year <= years.first}
            onClick={() => setYear(year - 1)}
          />
          <span className="min-w-[3.2rem] text-center font-mono text-[0.78rem] font-bold text-foreground">{year}</span>
          <YearStep
            direction={1}
            disabled={year >= years.last}
            onClick={() => setYear(year + 1)}
          />
        </div>

        {canCombine && (
          <button
            onClick={() => setScope(combined ? "track" : "all")}
            aria-pressed={combined}
            title={combined ? "Show only this track" : "Show every track"}
            className={`sm:ml-auto inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-control)] border px-2.5 py-1 text-[0.72rem] font-semibold transition-colors ${
              combined
                ? "border-accent-muted bg-accent/10 text-accent"
                : "border-card-border bg-surface-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers size={11} strokeWidth={2.5} />
            {combined ? "All tracks" : "This track"}
          </button>
        )}
      </div>

      {/* One row, always, whichever shape — the recent end at the right, and
          as much of the past as you care to scroll back to. Months used to
          wrap onto a second and third line, which puts the current month in
          the middle of the panel and the oldest one in the corner your eye
          starts at. */}
      {combined ? (
        // Not inside the scroller below: the stacked view keeps its own, with
        // the track names pinned outside it. Nested, the names would slide
        // away with the years and the rows would stop saying whose they are.
        <div className="py-3">
          <AllTracksYear tracks={tracks} year={year} today={today} weekStartsOn={settings.weekStartsOn} />
        </div>
      ) : (
      <div ref={scroller} className="-mx-1 overflow-x-auto px-1 py-3">
        {byMonth ? (
          <div className="flex w-max gap-5">
            {months.map((month) => (
              <div key={month.key} className="flex flex-col gap-1.5">
                <span className="text-[0.68rem] font-semibold text-muted-foreground">{month.label}</span>
                {/* Each block starts on the weekday its 1st fell on, which is
                    what makes a month recognisable as that month. */}
                <StreakGrid
                  cells={month.cells.map((day, index) => cellFor(day, `${month.key}-pad-${index}`))}
                  onCellClick={setSelectedDateDetails}
                />
              </div>
            ))}
            {months.length === 0 && (
              <span className="text-[0.85rem] italic text-muted-foreground">Nothing recorded in {year}.</span>
            )}
          </div>
        ) : (
          <StreakGrid cells={cells} onCellClick={setSelectedDateDetails} />
        )}
      </div>
      )}

      {/* The key. Four strengths of the track's own colour, and the day it
          began in the page's opposite — which is why the colours a track can
          wear stop short of white and black. */}
      {!combined && (
        <div className="flex items-center gap-1.5 text-[0.68rem] text-subtle-foreground">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{ backgroundColor: `var(--streak-${level})` }}
            />
          ))}
          <span>More</span>
          {startDate && (
            <>
              <span className="ml-3 h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: "var(--foreground)" }} />
              <span>started</span>
            </>
          )}
          {color && <span className="sr-only">Drawn in this track&apos;s colour, {color}.</span>}
        </div>
      )}

      {/* Into <body>, not here: this modal is position:fixed inside a panel
          that carries a transform while it's being dragged, which would make
          "fixed" mean "relative to the panel". See components/Portal.tsx. */}
      {selectedDateDetails && (
        <Portal>
        <div
          onClick={() => setSelectedDateDetails(null)}
          className="fixed inset-0 modal-overlay flex items-center justify-center z-[1000] p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-surface max-w-[400px] w-full p-6 border-accent-muted relative flex flex-col gap-4"
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedDateDetails(null)}
              className="absolute top-4 right-4 flex items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label="Close"
            >
              <X size={16} strokeWidth={2} />
            </button>

            {/* Header */}
            <div>
              <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded font-semibold font-mono tracking-[0.05em]">
                Streak Achievement
              </span>
              <h3 className="text-[1.1rem] font-bold text-foreground mt-2 mb-0">
                Accomplished on {selectedDateDetails}
              </h3>
            </div>

            {/* Completed Items List */}
            <div className="flex flex-col gap-2">
              {completedItemsHistory[selectedDateDetails] && completedItemsHistory[selectedDateDetails].length > 0 ? (
                <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto">
                  {completedItemsHistory[selectedDateDetails].map((it, idx) => {
                    const itemObj = itemAsObject(it);
                    return (
                      <div
                        key={idx}
                        className="flex flex-col gap-1 bg-input-bg px-3 py-2 rounded-md border border-card-border w-full"
                      >
                        <div className="flex items-center gap-3">
                          <Check size={15} strokeWidth={2.5} className="text-accent shrink-0" />
                          <span className="text-[0.85rem] text-foreground font-semibold">{itemObj.title}</span>
                        </div>
                        {itemObj.description && (
                          <span className="text-xs text-muted-foreground ml-[1.65rem]">
                            {itemObj.description}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-[0.85rem] italic m-0 text-center py-4">
                  No accomplishments recorded on this day.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedDateDetails(null)}
                className="btn px-5 py-1.5 text-[0.8rem]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
