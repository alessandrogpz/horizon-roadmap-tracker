"use client";

import React, { useMemo, useState } from "react";
import { Activity, Check, Flame, X } from "lucide-react";
import type { CompletedItem } from "@/lib/types";
import { todayYMD } from "@/lib/dates";
import { currentStreakLength } from "@/lib/streak";
import { streakCalendar } from "@/lib/stats";
import { useAppSettings } from "@/lib/useAppSettings";
import StreakGrid, { type StreakCell } from "@/components/StreakGrid";

export default function StreakGraph({
  streakHistory = [],
  completedItemsHistory = {},
  startDate
}: {
  streakHistory?: string[];
  completedItemsHistory?: { [date: string]: CompletedItem[] };
  startDate?: string;
}) {
  const [selectedDateDetails, setSelectedDateDetails] = useState<string | null>(null);
  const settings = useAppSettings();

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
      title: `${day.date}: ${day.count} update${day.count !== 1 ? "s" : ""}${accomplishments}`,
    };
  });

  return (
    <div className="glass-panel">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h2 className="section-title !mb-0">
          <Activity size={14} strokeWidth={2.5} className="section-icon" />
          Consistency Streak
        </h2>
        <div className="flex items-center gap-3 text-[0.75rem] font-mono">
          <span className="inline-flex items-center gap-1 text-warning font-semibold">
            <Flame size={13} strokeWidth={2} />
            {streak} day{streak === 1 ? "" : "s"}
          </span>
          <span className="text-muted-foreground">{totalActive} active</span>
        </div>
      </div>
      <div className="py-2.5">
        <StreakGrid cells={cells} onCellClick={setSelectedDateDetails} />
      </div>

      {selectedDateDetails && (
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
      )}
    </div>
  );
}
