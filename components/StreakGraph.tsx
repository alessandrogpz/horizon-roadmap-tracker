"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CompletedItem } from "@/lib/types";
import { formatDateYMD, parseYMD } from "@/lib/dates";

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

  const weeks: { dateStr: string; count: number }[][] = [];
  let currentWeek: { dateStr: string; count: number }[] = [];

  const tempDate = new Date(startDateObj);
  // Render up to today
  while (tempDate <= today) {
    const dateStr = formatDateYMD(tempDate);
    const count = dateCounts[dateStr] || 0;

    currentWeek.push({ dateStr, count });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    tempDate.setDate(tempDate.getDate() + 1);
  }

  // Handle remaining days for current week
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ dateStr: '', count: 0 });
    }
    weeks.push(currentWeek);
  }

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
      <h2 className="section-title">Consistency Streak</h2>
      <div className="flex gap-1 py-2.5">
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="flex flex-col gap-1">
            {week.map((day, dIdx) => (
              <div
                key={dIdx}
                onClick={() => day.dateStr && setSelectedDateDetails(day.dateStr)}
                className={`w-2.5 h-2.5 rounded-sm transition-colors duration-300 ${day.dateStr ? "cursor-pointer" : "cursor-default"}`}
                style={{ backgroundColor: day.dateStr ? getColorClass(day.count) : 'transparent' }}
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
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel max-w-[400px] w-full p-6 border !border-accent rounded-lg relative flex flex-col gap-4 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5),0_10px_10px_-5px_rgba(0,0,0,0.4)]"
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedDateDetails(null)}
              className="absolute top-4 right-4 bg-transparent border-none text-zinc-400 text-[1.1rem] cursor-pointer"
            >
              ✕
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
                          <span className="text-accent text-[0.95rem]">✓</span>
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
