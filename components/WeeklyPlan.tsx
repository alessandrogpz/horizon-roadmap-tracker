"use client";

import React from "react";
import type { AppState, WeekDay } from "@/lib/types";
import { getDateForDayName, getWeekNum } from "@/lib/dates";
import { DEFAULT_WEEK_SCHEDULE, DEFAULT_FOCUS_TYPES, DSA_PATTERN_WEEKS, dsaPatternIndex } from "@/lib/constants";

interface WeeklyPlanProps {
  data: AppState;
  todayStr: string;
  dayOfWeek: number;
  weekOffset: number;
  setWeekOffset: (offset: number) => void;
  onDayClick: (day: WeekDay) => void;
  onRotationClick: () => void;
  /** Applies an optimistic state update and schedules a debounced save. */
  applyChange: (newData: AppState) => void;
}

export default function WeeklyPlan({
  data,
  todayStr,
  dayOfWeek,
  weekOffset,
  setWeekOffset,
  onDayClick,
  onRotationClick,
  applyChange,
}: WeeklyPlanProps) {
  const weekLabel = (() => {
    if (!data.isSynced) return "Week --";
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + weekOffset * 7);
    return `Week ${getWeekNum(data.startDate, targetDate)}`;
  })();

  const weeklyAlgorithm = (() => {
    if (!data.isSynced) return "Algorithm (Placeholder)";
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + weekOffset * 7);
    const wn = getWeekNum(data.startDate, targetDate);
    return DSA_PATTERN_WEEKS[dsaPatternIndex(wn, data.dsaStartWeek || 1)].pattern;
  })();

  return (
    <div className="glass-panel" style={{ borderLeft: "4px solid var(--accent)", padding: "1.25rem 1.5rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
          {/* Top Row: Title and Navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fff", margin: 0, whiteSpace: "nowrap" }}>
              Weekly Study Plan
            </h3>

            {/* Week Navigation Pill */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "rgba(255, 255, 255, 0.03)",
              padding: "0.25rem 0.5rem",
              borderRadius: "6px",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              flexShrink: 0
            }}>
              <WeekNavButton label="‹" onClick={() => setWeekOffset(weekOffset - 1)} />
              <span
                style={{
                  color: "#e4e4e7",
                  fontWeight: 500,
                  fontSize: "0.85rem",
                  minWidth: "60px",
                  textAlign: "center",
                  fontFamily: "monospace",
                  whiteSpace: "nowrap"
                }}
              >
                {weekLabel}
                {weekOffset !== 0 && (
                  <span style={{ fontSize: "0.7rem", color: "#71717a", marginLeft: "0.25rem" }}>
                    ({weekOffset > 0 ? `+${weekOffset}` : weekOffset})
                  </span>
                )}
              </span>
              <WeekNavButton label="›" onClick={() => setWeekOffset(weekOffset + 1)} />

              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  style={{
                    marginLeft: "0.5rem",
                    background: "var(--accent)",
                    color: "#000",
                    border: "none",
                    borderRadius: "4px",
                    padding: "0.2rem 0.6rem",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                    transition: "opacity 0.2s",
                    whiteSpace: "nowrap"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = "0.8"}
                  onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
                >
                  Back to Today
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row: Algorithm Focus */}
          <div>
            <div
              onClick={() => { if (data.isSynced) onRotationClick(); }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "rgba(14, 165, 233, 0.08)",
                border: "1px dashed rgba(14, 165, 233, 0.3)",
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                cursor: data.isSynced ? "pointer" : "default",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap"
              }}
              onMouseOver={(e) => {
                if (data.isSynced) {
                  e.currentTarget.style.background = "rgba(14, 165, 233, 0.15)";
                  e.currentTarget.style.borderColor = "rgba(14, 165, 233, 0.5)";
                }
              }}
              onMouseOut={(e) => {
                if (data.isSynced) {
                  e.currentTarget.style.background = "rgba(14, 165, 233, 0.08)";
                  e.currentTarget.style.borderColor = "rgba(14, 165, 233, 0.3)";
                }
              }}
              title={data.isSynced ? "View full 10-week Algorithm plan" : "Connect Google Drive to unlock"}
            >
              <span style={{ fontSize: "0.7rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                Weekly Algorithm:
              </span>
              <span style={{ fontSize: "0.85rem", color: "var(--accent)", fontWeight: 700, fontFamily: "monospace" }}>
                {weeklyAlgorithm}
              </span>
            </div>
          </div>
        </div>

        {/* 7-column grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "0.4rem",
        }}>
          {(data.weekSchedule || DEFAULT_WEEK_SCHEDULE).map((dayItem, idx) => (
            <DayCard
              key={dayItem.name}
              dayItem={dayItem}
              idx={idx}
              data={data}
              todayStr={todayStr}
              dayOfWeek={dayOfWeek}
              weekOffset={weekOffset}
              onDayClick={onDayClick}
              applyChange={applyChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function WeekNavButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "4px",
        color: "#a1a1aa",
        cursor: "pointer",
        padding: "0.1rem 0.4rem",
        fontSize: "0.8rem",
        fontFamily: "monospace",
        lineHeight: 1,
        transition: "all 0.15s ease",
      }}
      onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "#fff"; }}
      onMouseOut={(e) => { e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)"; e.currentTarget.style.color = "#a1a1aa"; }}
    >
      {label}
    </button>
  );
}

interface DayCardProps {
  dayItem: WeekDay;
  idx: number;
  data: AppState;
  todayStr: string;
  dayOfWeek: number;
  weekOffset: number;
  onDayClick: (day: WeekDay) => void;
  applyChange: (newData: AppState) => void;
}

function DayCard({ dayItem, idx, data, todayStr, dayOfWeek, weekOffset, onDayClick, applyChange }: DayCardProps) {
  const isCurrentWeek = weekOffset === 0;
  const isToday = isCurrentWeek && idx === (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  const dayKey = dayItem.name;
  const dayDateStr = getDateForDayName(dayKey, weekOffset);
  const revisionItems = data.dailyRevisionItems?.[dayKey] || [];
  const focusTasks = data.dailyTasks?.[dayKey] || [];

  // Determine completion: for today use live data, for other days use weeklyCompletions
  const weeklyCompletions = data.weeklyCompletions || {};
  const dayCompletions = weeklyCompletions[dayDateStr] || { tasks: [], revisions: [] };

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const dayDate = new Date(dayDateStr + "T00:00:00");
  const isFuture = dayDate > todayDate;

  const getItemCompleted = (itemId: string, isRevision: boolean): boolean => {
    return isRevision
      ? (dayCompletions.revisions || []).includes(itemId)
      : (dayCompletions.tasks || []).includes(itemId);
  };

  const handleToggleItem = (itemId: string, itemTitle: string, itemDesc: string, isRevision: boolean, currentCompleted: boolean) => {
    const newCompleted = !currentCompleted;
    const newWeeklyCompletions = { ...(data.weeklyCompletions || {}) };
    const newStreakHistory = [...(data.streakHistory || [])];
    const newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };

    if (isToday) {
      // Update live data for today
      const updatedList = isRevision
        ? revisionItems.map((it) => it.id === itemId ? { ...it, completed: newCompleted } : it)
        : focusTasks.map((t) => t.id === itemId ? { ...t, completed: newCompleted } : t);

      // Also update weeklyCompletions for today
      const todayComps = newWeeklyCompletions[todayStr] || { tasks: [], revisions: [] };
      const compKey = isRevision ? "revisions" : "tasks";
      if (newCompleted) {
        if (!todayComps[compKey].includes(itemId)) todayComps[compKey] = [...todayComps[compKey], itemId];
      } else {
        todayComps[compKey] = todayComps[compKey].filter((id: string) => id !== itemId);
      }
      newWeeklyCompletions[todayStr] = todayComps;

      // Streak sync for today
      const todayItems = newCompletedItemsHistory[todayStr] || [];
      if (newCompleted) {
        newStreakHistory.push(todayStr);
        const alreadyExists = todayItems.some((it) => (typeof it === 'string' ? it === itemTitle : it.title === itemTitle));
        if (!alreadyExists) {
          newCompletedItemsHistory[todayStr] = [...todayItems, { title: itemTitle, description: itemDesc || "" }];
        }
      } else {
        const sIdx = newStreakHistory.indexOf(todayStr);
        if (sIdx > -1) newStreakHistory.splice(sIdx, 1);
        newCompletedItemsHistory[todayStr] = todayItems.filter((it) => (typeof it === 'string' ? it !== itemTitle : it.title !== itemTitle));
      }

      const dataKey = isRevision ? "dailyRevisionItems" : "dailyTasks";
      applyChange({
        ...data,
        [dataKey]: { ...(data[dataKey] || {}), [dayKey]: updatedList },
        weeklyCompletions: newWeeklyCompletions,
        streakHistory: newStreakHistory,
        completedItemsHistory: newCompletedItemsHistory,
      });
    } else {
      // Update weeklyCompletions for a non-today day
      const dayComps = newWeeklyCompletions[dayDateStr] || { tasks: [], revisions: [] };
      const compKey = isRevision ? "revisions" : "tasks";
      if (newCompleted) {
        if (!dayComps[compKey].includes(itemId)) dayComps[compKey] = [...dayComps[compKey], itemId];
      } else {
        dayComps[compKey] = dayComps[compKey].filter((id: string) => id !== itemId);
      }
      newWeeklyCompletions[dayDateStr] = dayComps;

      // Streak sync for the target date (not today!)
      const targetDateItems = newCompletedItemsHistory[dayDateStr] || [];
      if (newCompleted) {
        newStreakHistory.push(dayDateStr);
        const alreadyExists = targetDateItems.some((it) => (typeof it === 'string' ? it === itemTitle : it.title === itemTitle));
        if (!alreadyExists) {
          newCompletedItemsHistory[dayDateStr] = [...targetDateItems, { title: itemTitle, description: itemDesc || "" }];
        }
      } else {
        const sIdx = newStreakHistory.indexOf(dayDateStr);
        if (sIdx > -1) newStreakHistory.splice(sIdx, 1);
        newCompletedItemsHistory[dayDateStr] = targetDateItems.filter((it) => (typeof it === 'string' ? it !== itemTitle : it.title !== itemTitle));
      }

      applyChange({
        ...data,
        weeklyCompletions: newWeeklyCompletions,
        streakHistory: newStreakHistory,
        completedItemsHistory: newCompletedItemsHistory,
      });
    }
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
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
        padding: "0.6rem 0.5rem",
        borderRadius: "8px",
        background: isToday ? "rgba(14, 165, 233, 0.06)" : "rgba(0, 0, 0, 0.15)",
        border: isToday ? "1px solid var(--accent)" : "1px solid rgba(255, 255, 255, 0.05)",
        boxShadow: isToday ? "0 0 12px rgba(14, 165, 233, 0.15)" : "none",
        cursor: "pointer",
        transition: "all 0.2s ease",
        minHeight: "160px",
        overflow: "hidden",
        opacity: isFuture ? 0.5 : 1,
      }}
    >
      {/* Day name + date */}
      <div style={{ textAlign: "center", paddingBottom: "0.25rem", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
        <span style={{
          fontSize: "0.7rem",
          fontWeight: isToday ? 700 : 600,
          color: isToday ? "#fff" : "#71717a",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          {dayItem.name}
        </span>
        <div style={{ fontSize: "0.55rem", color: "#52525b", marginTop: "0.05rem" }}>
          {data.isSynced ? dayDateStr.slice(5) : "MM-DD"}
        </div>
      </div>

      {/* Focus type tag */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.15rem" }}>
        <span style={{
          fontSize: "0.55rem",
          fontWeight: 600,
          color: data.isSynced ? tag.text : "#71717a",
          background: data.isSynced ? tag.bg : "rgba(113, 113, 122, 0.12)",
          padding: "0.1rem 0.4rem",
          borderRadius: "3px",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          whiteSpace: "nowrap",
        }}>
          {data.isSynced ? dayItem.label : "UN-ASSIGNED"}
        </span>
      </div>

      {/* Revision section */}
      {revisionItems.length > 0 && (
        <div>
          <span style={{ fontSize: "0.55rem", color: "var(--accent)", fontWeight: "bold", fontFamily: "monospace", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Revision
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", marginTop: "0.15rem" }}>
            {revisionItems.map((item, i) => {
              const completed = getItemCompleted(item.id, true);
              return (
                <div key={item.id || i} style={{ display: "flex", alignItems: "flex-start", gap: "0.3rem" }}>
                  <input
                    type="checkbox"
                    className="checkbox-custom"
                    checked={completed}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    onChange={() => handleToggleItem(item.id, item.title, item.description || "", true, completed)}
                    style={{ marginTop: "0.1rem", transform: "scale(0.8)" }}
                  />
                  <span style={{
                    fontSize: "0.72rem",
                    color: completed ? "#52525b" : (isToday ? "var(--foreground)" : "#a1a1aa"),
                    textDecoration: completed ? "line-through" : "none",
                    lineHeight: 1.3,
                  }}>
                    {item.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Focus tasks section */}
      {focusTasks.length > 0 && (
        <div style={{ marginTop: "0.1rem" }}>
          <span style={{ fontSize: "0.55rem", color: "var(--accent)", fontWeight: "bold", fontFamily: "monospace", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Focus
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", marginTop: "0.15rem" }}>
            {focusTasks.map((task, i) => {
              const completed = getItemCompleted(task.id, false);
              return (
                <div key={task.id || i} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <input
                    type="checkbox"
                    className="checkbox-custom"
                    checked={completed}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    onChange={() => handleToggleItem(task.id, task.title, "", false, completed)}
                    style={{ transform: "scale(0.8)" }}
                  />
                  <span style={{
                    fontSize: "0.72rem",
                    color: completed ? "#52525b" : (isToday ? "var(--foreground)" : "#a1a1aa"),
                    textDecoration: completed ? "line-through" : "none",
                    lineHeight: 1.3,
                  }}>
                    {task.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {revisionItems.length === 0 && focusTasks.length === 0 && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "0.7rem", color: "#3f3f46", fontStyle: "italic" }}>No tasks</span>
        </div>
      )}
    </div>
  );
}
