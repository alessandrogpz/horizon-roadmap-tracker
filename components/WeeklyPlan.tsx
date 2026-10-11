"use client";

import React from "react";
import { CalendarDays } from "lucide-react";
import type { TrackState, WeekDay } from "@/lib/types";
import { getDateForDayName, getWeekNum } from "@/lib/dates";
import { DEFAULT_WEEK_SCHEDULE, DEFAULT_FOCUS_TYPES } from "@/lib/constants";
import { computeRotationItemsForDay, isRotationItem } from "@/lib/rotation";
import { isItemCompleted, setItemCompletion, type ItemKind } from "@/lib/completions";

interface WeeklyPlanProps {
  data: TrackState;
  dayOfWeek: number;
  weekOffset: number;
  setWeekOffset: (offset: number) => void;
  onDayClick: (day: WeekDay) => void;
  /** null opens the "create a new rotation" flow; a string opens that rotation for viewing/editing. */
  onRotationClick: (rotationId: string | null) => void;
  /** Applies an optimistic state update and schedules a debounced save. */
  applyChange: (updater: (previous: TrackState) => TrackState) => void;
}

export default function WeeklyPlan({
  data,
  dayOfWeek,
  weekOffset,
  setWeekOffset,
  onDayClick,
  onRotationClick,
  applyChange,
}: WeeklyPlanProps) {
  const viewedWeekNum = (() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + weekOffset * 7);
    return getWeekNum(data.startDate, targetDate);
  })();

  const weekLabel = data.isSynced ? `Week ${viewedWeekNum}` : "Week --";

  const rotations = data.rotations || [];

  return (
    <div className="glass-panel border-l-4 border-accent-muted px-6 py-5">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex flex-col gap-3 pb-3 border-b border-card-border">
          {/* Top Row: Title and Navigation */}
          <div className="flex items-center gap-4">
            <h3 className="text-[1.1rem] font-semibold text-foreground m-0 whitespace-nowrap inline-flex items-center gap-2">
              <CalendarDays size={16} strokeWidth={2.5} className="text-muted-foreground" />
              Weekly Overview
            </h3>

            {/* Week Navigation Pill */}
            <div className="flex items-center gap-1.5 bg-surface-muted px-2 py-1 rounded-md border border-card-border shrink-0">
              <WeekNavButton label="‹" onClick={() => setWeekOffset(weekOffset - 1)} />
              <span className="text-foreground font-medium text-[0.85rem] min-w-[60px] text-center font-mono whitespace-nowrap">
                {weekLabel}
                {weekOffset !== 0 && (
                  <span className="text-[0.7rem] text-muted-foreground ml-1">
                    ({weekOffset > 0 ? `+${weekOffset}` : weekOffset})
                  </span>
                )}
              </span>
              <WeekNavButton label="›" onClick={() => setWeekOffset(weekOffset + 1)} />

              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="ml-2 bg-accent text-black border-none rounded px-2.5 py-0.5 text-[0.7rem] font-semibold cursor-pointer uppercase tracking-[0.03em] transition-opacity duration-200 whitespace-nowrap hover:opacity-80"
                >
                  Back to Today
                </button>
              )}
            </div>
          </div>

          {/* Bottom row: one pill per rotation, plus a button to add another */}
          <div className="flex flex-wrap items-center gap-2">
            {rotations.map((rotation) => {
              const len = rotation.items.length;
              const idx = len > 0 ? (((viewedWeekNum - rotation.startWeek) % len) + len) % len : 0;
              const current = data.isSynced ? (rotation.items[idx]?.title || "") : "(Placeholder)";
              return (
                <div
                  key={rotation.id}
                  onClick={() => { if (data.isSynced) onRotationClick(rotation.id); }}
                  className={`inline-flex items-center gap-2 bg-accent/[0.08] border border-dashed border-accent/30 px-3 py-1.5 rounded-md transition-all duration-200 whitespace-nowrap ${
                    data.isSynced ? "cursor-pointer hover:bg-accent/15 hover:border-accent/50" : "cursor-default"
                  }`}
                  title={data.isSynced ? "View full rotation cycle" : "Connect Google Drive to unlock"}
                >
                  <span className="text-[0.7rem] text-muted-foreground uppercase tracking-[0.05em] font-semibold">
                    {rotation.label}:
                  </span>
                  <span className="text-[0.85rem] text-accent font-bold font-mono">
                    {current}
                  </span>
                </div>
              );
            })}

            {data.isSynced && (
              <button
                onClick={() => onRotationClick(null)}
                className="inline-flex items-center gap-1 border border-dashed border-card-border-hover px-3 py-1.5 rounded-md text-[0.7rem] text-muted-foreground uppercase tracking-[0.05em] font-semibold cursor-pointer transition-all duration-200 hover:text-foreground hover:border-card-border-hover"
              >
                + New Rotation
              </button>
            )}
          </div>
        </div>

        {/* 7-column grid (scrolls horizontally on small screens) */}
        <div className="week-grid-scroll">
          <div className="week-grid">
            {(data.weekSchedule || DEFAULT_WEEK_SCHEDULE).map((dayItem, idx) => (
              <DayCard
                key={dayItem.name}
                dayItem={dayItem}
                idx={idx}
                data={data}
                dayOfWeek={dayOfWeek}
                weekOffset={weekOffset}
                viewedWeekNum={viewedWeekNum}
                onDayClick={onDayClick}
                applyChange={applyChange}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekNavButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-transparent border border-card-border rounded text-muted-foreground cursor-pointer px-1.5 py-0.5 text-[0.8rem] font-mono leading-none transition-all duration-150 hover:border-accent hover:text-foreground"
    >
      {label}
    </button>
  );
}

interface DayCardProps {
  dayItem: WeekDay;
  idx: number;
  data: TrackState;
  dayOfWeek: number;
  weekOffset: number;
  viewedWeekNum: number;
  onDayClick: (day: WeekDay) => void;
  applyChange: (updater: (previous: TrackState) => TrackState) => void;
}

/**
 * One tickable line in a day card: the whole row, not just the box.
 *
 * The box was an 18-point checkbox scaled to 0.8, and a transform shrinks the
 * hit area along with the drawing — so the target was about fourteen points,
 * under half what a thumb needs and fiddly even with a mouse. It is drawn at
 * its full size again, and the label around it makes the title part of the
 * target, which is where the eye goes anyway. The padding takes the row past
 * twenty-four points tall without widening the column, and the negative
 * margin keeps the text aligned with the headings above it.
 *
 * The row swallows its click. The card behind it opens the day's editor, and
 * ticking something off is not a request to open anything.
 */
const ITEM_ROW =
  "-mx-1 flex cursor-pointer items-start gap-[0.4rem] rounded px-1 py-[0.25rem] transition-colors hover:bg-surface-hover";

function DayCard({ dayItem, idx, data, dayOfWeek, weekOffset, viewedWeekNum, onDayClick, applyChange }: DayCardProps) {
  const isCurrentWeek = weekOffset === 0;
  const isToday = isCurrentWeek && idx === (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  const dayKey = dayItem.name;
  const dayDateStr = getDateForDayName(dayKey, weekOffset);
  const storedRevisionItems = data.dailyRevisionItems?.[dayKey] || [];
  const storedFocusTasks = data.dailyTasks?.[dayKey] || [];

  // Rotation-sourced items reflect whichever week is actually currently
  // active in storage — recompute them for the week being *viewed* so
  // navigating weeks previews the correct upcoming/past content instead of
  // repeating this week's. Manually added items pass through as-is.
  const rotations = data.rotations || [];
  const { revisions: rotationRevisions, focus: rotationFocus } = rotations.length > 0
    ? computeRotationItemsForDay(rotations, viewedWeekNum, dayKey)
    : { revisions: [], focus: [] };

  const revisionItems = rotations.length > 0
    ? [...rotationRevisions, ...storedRevisionItems.filter((it) => !isRotationItem(it))]
    : storedRevisionItems;
  const focusTasks = rotations.length > 0
    ? [...rotationFocus, ...storedFocusTasks.filter((it) => !isRotationItem(it))]
    : storedFocusTasks;

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const dayDate = new Date(dayDateStr + "T00:00:00");
  const isFuture = dayDate > todayDate;

  const getItemCompleted = (itemId: string, kind: ItemKind) => isItemCompleted(data, dayDateStr, kind, itemId);

  /** Completion is always recorded against this card's calendar date, so
   *  ticking a box on a past day lands on that day rather than today. The
   *  stored item's own flag is only synced for the live (today) card — on any
   *  other day the flag belongs to a different date's checklist. */
  const handleToggleItem = (
    kind: ItemKind,
    item: { id: string; title: string; description?: string },
    completed: boolean
  ) => {
    applyChange((previous) =>
      setItemCompletion(previous, { dateStr: dayDateStr, dayKey: isToday ? dayKey : undefined, kind, ...item }, completed)
    );
  };

  const focusTypes = data.focusTypes || DEFAULT_FOCUS_TYPES;
  const tagColors: Record<string, { bg: string; text: string }> = {};
  Object.entries(focusTypes).forEach(([key, val]) => {
    const c = val.color || "#a1a1aa";
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    tagColors[key] = { bg: `rgba(${r}, ${g}, ${b}, 0.2)`, text: c };
  });
  const tag = tagColors[dayItem.type] || { bg: "rgba(113, 113, 122, 0.2)", text: "#a1a1aa" };

  return (
    <div
      onClick={() => onDayClick(dayItem)}
      className={`flex flex-col gap-[0.35rem] px-2 py-[0.6rem] rounded-lg cursor-pointer transition-all duration-200 min-h-[160px] overflow-hidden ${
        isToday
          ? "bg-accent/[0.06] border border-accent shadow-[0_0_12px_rgba(14,165,233,0.15)]"
          : "bg-input-bg border border-card-border"
      } ${isFuture ? "opacity-50" : ""}`}
    >
      {/* Day name + date */}
      <div className="text-center pb-1 border-b border-card-border">
        <span className={`text-[0.7rem] uppercase tracking-[0.05em] ${isToday ? "font-bold text-foreground" : "font-semibold text-muted-foreground"}`}>
          {dayItem.name}
        </span>
        <div className="text-[0.55rem] text-subtle-foreground mt-px">
          {data.isSynced ? dayDateStr.slice(5) : "MM-DD"}
        </div>
      </div>

      {/* Focus type tag */}
      <div className="flex justify-center mb-[0.15rem]">
        <span
          className="text-[0.55rem] font-semibold px-1.5 py-px rounded-[3px] uppercase tracking-[0.03em] whitespace-nowrap"
          style={data.isSynced ? { color: tag.text, background: tag.bg } : { color: "#71717a", background: "rgba(113, 113, 122, 0.12)" }}
        >
          {data.isSynced ? dayItem.label : "UN-ASSIGNED"}
        </span>
      </div>

      {/* Revision section */}
      {revisionItems.length > 0 && (
        <div>
          <span className="text-[0.55rem] text-accent font-bold font-mono tracking-[0.05em] uppercase">
            Revision
          </span>
          <div className="flex flex-col gap-[0.15rem] mt-[0.15rem]">
            {revisionItems.map((item, i) => {
              const completed = getItemCompleted(item.id, "revision");
              return (
                <label key={item.id || i} className={ITEM_ROW} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="checkbox-custom mt-px shrink-0"
                    checked={completed}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    onChange={(e) =>
                      handleToggleItem("revision", { id: item.id, title: item.title, description: item.description }, e.target.checked)
                    }
                  />
                  <span className={`text-[0.72rem] leading-[1.3] ${completed ? "text-subtle-foreground line-through" : isToday ? "text-foreground" : "text-muted-foreground"}`}>
                    {item.title}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Focus tasks section */}
      {focusTasks.length > 0 && (
        <div className="mt-[0.1rem]">
          <span className="text-[0.55rem] text-accent font-bold font-mono tracking-[0.05em] uppercase">
            Focus
          </span>
          <div className="flex flex-col gap-[0.15rem] mt-[0.15rem]">
            {focusTasks.map((task, i) => {
              const completed = getItemCompleted(task.id, "focus");
              return (
                <label key={task.id || i} className={ITEM_ROW} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="checkbox-custom mt-px shrink-0"
                    checked={completed}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    onChange={(e) => handleToggleItem("focus", { id: task.id, title: task.title }, e.target.checked)}
                  />
                  <span className={`text-[0.72rem] leading-[1.3] ${completed ? "text-subtle-foreground line-through" : isToday ? "text-foreground" : "text-muted-foreground"}`}>
                    {task.title}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {revisionItems.length === 0 && focusTasks.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[0.7rem] text-subtle-foreground italic">No tasks</span>
        </div>
      )}
    </div>
  );
}
