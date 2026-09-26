"use client";

import React, { useMemo, useState } from "react";
import { Activity, Check, Flame, Layers, X } from "lucide-react";
import type { CompletedItem, TrackState } from "@/lib/types";
import { parseYMD, todayYMD } from "@/lib/dates";
import { currentStreakLength } from "@/lib/streak";
import { streakCalendar } from "@/lib/stats";
import { useAppSettings } from "@/lib/useAppSettings";
import AllTracksYear from "@/components/AllTracksYear";
import Portal from "@/components/Portal";
import StreakGrid, { type StreakCell } from "@/components/StreakGrid";

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
  const settings = useAppSettings();
  const today = todayYMD();
  const canCombine = tracks.length > 1;
  const combined = scope === "all" && canCombine;

  // Walking every day from startDate to today is real work on a year-long
  // track, so memoize it — otherwise it re-runs on every unrelated re-render.
  const days = useMemo(
    () =>
      streakCalendar(
        { startDate: startDate || "", completedItemsHistory },
        todayYMD(),
        settings.weekStartsOn
      ),
    [completedItemsHistory, startDate, settings.weekStartsOn]
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

  // streakCalendar already returns week-major order, which is exactly how
  // StreakGrid flows: column-first over seven rows, one week per column.
  const cells: StreakCell[] = days.map((day, i) => {
    if (!day.date) return { id: `pad-${i}`, level: 0, filled: false };
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
  });

  return (
    <div className="glass-panel">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
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
          {canCombine && (
            <button
              onClick={() => setScope(combined ? "track" : "all")}
              aria-pressed={combined}
              title={combined ? "Show only this track" : "Show every track"}
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[0.7rem] font-semibold border transition-colors cursor-pointer ${
                combined
                  ? "border-accent-muted bg-accent/10 text-accent"
                  : "border-card-border bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers size={11} strokeWidth={2.5} />
              {combined ? "All tracks" : "This track"}
            </button>
          )}
        </div>
      </div>
      <div className="py-2.5">
        {combined ? (
          <AllTracksYear
            tracks={tracks}
            year={parseYMD(today).getFullYear()}
            today={today}
            weekStartsOn={settings.weekStartsOn}
          />
        ) : (
          <StreakGrid cells={cells} onCellClick={setSelectedDateDetails} />
        )}
      </div>

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
