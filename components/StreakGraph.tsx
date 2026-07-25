"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Check, Flame, X } from "lucide-react";
import type { CompletedItem } from "@/lib/types";
import { formatDateYMD, parseYMD, todayYMD } from "@/lib/dates";
import { currentStreakLength } from "@/lib/streak";

export default function StreakGraph({
  streakHistory = [],
  completedItemsHistory = {},
  startDate
}: {
  streakHistory?: string[];
  completedItemsHistory?: { [date: string]: CompletedItem[] };
  startDate?: string;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedDateDetails, setSelectedDateDetails] = useState<string | null>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [streakHistory]);

  // Building the ~53-week grid walks every day from startDate to today, so
  // memoize it — otherwise it re-runs on every unrelated parent re-render.
  const weeks = useMemo(() => {
    // Count achievements per date from completedItemsHistory
    const dateCounts: { [key: string]: number } = {};
    Object.entries(completedItemsHistory || {}).forEach(([date, items]) => {
      if (Array.isArray(items)) {
        dateCounts[date] = items.length;
      }
    });

    const today = new Date();
    let startDateObj: Date;

    if (startDate) {
      startDateObj = parseYMD(startDate);
    } else {
      // Fallback: 53 weeks ago if startDate not provided
      startDateObj = new Date(today);
      startDateObj.setDate(today.getDate() - 370);
    }
    startDateObj.setHours(0, 0, 0, 0);

    // Align start date to Sunday (so weeks represent Sun-Sat rows)
    const startDayOfWeek = startDateObj.getDay();
    startDateObj.setDate(startDateObj.getDate() - startDayOfWeek);

    const result: { dateStr: string; count: number }[][] = [];
    let currentWeek: { dateStr: string; count: number }[] = [];

    const tempDate = new Date(startDateObj);
    // Render up to today
    while (tempDate <= today) {
      const dateStr = formatDateYMD(tempDate);
      const count = dateCounts[dateStr] || 0;

      currentWeek.push({ dateStr, count });

      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }

      tempDate.setDate(tempDate.getDate() + 1);
    }

    // Handle remaining days for current week
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ dateStr: '', count: 0 });
      }
      result.push(currentWeek);
    }

    return result;
  }, [completedItemsHistory, startDate]);

  const streak = useMemo(() => currentStreakLength(streakHistory, todayYMD()), [streakHistory]);
  const totalActive = streakHistory.length;

  // Helper to color cells based on contribution level
  const getColorClass = (count: number) => {
    if (count === 0) return 'var(--streak-0)';
    if (count <= 1) return 'var(--streak-1)';
    if (count <= 2) return 'var(--streak-2)';
    if (count <= 3) return 'var(--streak-3)';
    return 'var(--streak-4)';
  };

  const itemAsObject = (it: CompletedItem) => (typeof it === "string" ? { title: it, description: "" } : { description: "", ...it });

  return (
    <div ref={scrollContainerRef} className="glass-panel p-6 overflow-x-auto">
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
      <div className="flex gap-1 py-2.5">
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="flex flex-col gap-1">
            {week.map((day, dIdx) => (
              <div
                key={dIdx}
                onClick={() => day.dateStr && setSelectedDateDetails(day.dateStr)}
                className={`w-2.5 h-2.5 transition-transform duration-150 ${day.dateStr ? "cursor-pointer hover:scale-[1.35] hover:ring-1 hover:ring-accent/50" : "cursor-default"}`}
                style={{ 
                  backgroundColor: day.dateStr ? getColorClass(day.count) : 'transparent',
                  borderRadius: '2px'
                }}
                title={
                  day.dateStr
                    ? `${day.dateStr}: ${day.count} update${day.count !== 1 ? 's' : ''}${
                        completedItemsHistory[day.dateStr] && completedItemsHistory[day.dateStr].length > 0
                          ? `\nAccomplished:\n• ${completedItemsHistory[day.dateStr]
                              .map((it) => {
                                const itemObj = itemAsObject(it);
                                return itemObj.description
                                  ? `${itemObj.title} (${itemObj.description})`
                                  : itemObj.title;
                              })
                              .join('\n• ')}`
                          : ''
                      }`
                    : ''
                }
              />
            ))}
          </div>
        ))}
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
              <h3 className="text-[1.1rem] font-bold text-white mt-2 mb-0">
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
                        className="flex flex-col gap-1 bg-black/15 px-3 py-2 rounded-md border border-white/5 w-full"
                      >
                        <div className="flex items-center gap-3">
                          <Check size={15} strokeWidth={2.5} className="text-accent shrink-0" />
                          <span className="text-[0.85rem] text-white font-semibold">{itemObj.title}</span>
                        </div>
                        {itemObj.description && (
                          <span className="text-xs text-zinc-500 ml-[1.65rem]">
                            {itemObj.description}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-zinc-500 text-[0.85rem] italic m-0 text-center py-4">
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
