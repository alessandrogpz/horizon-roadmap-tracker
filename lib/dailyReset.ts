import type { TrackState } from "./types";
import { getWeekNum, parseYMD, DAYS_SHORT } from "./dates";
import { DEFAULT_WEEK_SCHEDULE } from "./constants";
import { computeAutoRevisionItem, isAutoRevisionItem } from "./rotation";

/**
 * When a new day starts: snapshot yesterday's completions into weeklyCompletions,
 * uncheck all tasks, and (for tracks that opt into one via rotationConfig)
 * rotate the auto revision items for the new week.
 * Pure — returns the updated track (or the input unchanged if no reset is due).
 */
export function applyDailyResetIfNeeded(loadedData: TrackState, todayStr: string): { data: TrackState; changed: boolean } {
  if (!loadedData || !loadedData.isSynced || loadedData.lastTasksResetDate === todayStr) {
    return { data: loadedData, changed: false };
  }

  // Snapshot yesterday's completions into weeklyCompletions before resetting
  const prevWeeklyCompletions = { ...(loadedData.weeklyCompletions || {}) };
  const prevDateStr = loadedData.lastTasksResetDate;
  if (prevDateStr) {
    // Find which day name corresponds to the previous date
    const prevDayName = DAYS_SHORT[parseYMD(prevDateStr).getDay()];
    // Only save task/revision IDs for that specific day
    const dayTasks = loadedData.dailyTasks?.[prevDayName] || [];
    const dayRevisions = loadedData.dailyRevisionItems?.[prevDayName] || [];
    prevWeeklyCompletions[prevDateStr] = {
      tasks: dayTasks.filter((t) => t.completed).map((t) => t.id),
      revisions: dayRevisions.filter((it) => it.completed).map((it) => it.id),
    };
  }

  // Reset all tasks in all phases to completed: false
  const resetPhases = loadedData.phases.map((phase) => ({
    ...phase,
    tasks: phase.tasks.map((t) => ({ ...t, completed: false }))
  }));

  // Reset daily tasks
  const resetDailyTasks: TrackState["dailyTasks"] = {};
  if (loadedData.dailyTasks) {
    Object.keys(loadedData.dailyTasks).forEach((key) => {
      resetDailyTasks[key] = loadedData.dailyTasks[key].map((t) => ({ ...t, completed: false }));
    });
  }

  // Reset daily revision items
  const resetDailyRevisionItems: TrackState["dailyRevisionItems"] = {};
  if (loadedData.dailyRevisionItems) {
    Object.keys(loadedData.dailyRevisionItems).forEach((key) => {
      resetDailyRevisionItems[key] = loadedData.dailyRevisionItems[key].map((it) => ({ ...it, completed: false }));
    });
  }

  // Auto-rotation: only for tracks that opt into one (e.g. the Game Engine
  // & Graphics template's DSA/math interleaving). Tracks without a
  // rotationConfig (fitness, learning, blank) simply skip this whole block.
  const rotation = loadedData.rotationConfig;
  if (rotation) {
    const startWeek = loadedData.dsaStartWeek || 1;
    const currentWeekNum = getWeekNum(loadedData.startDate);
    const schedule = loadedData.weekSchedule || DEFAULT_WEEK_SCHEDULE;

    const ALL_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    ALL_WEEKDAYS.forEach((dayKey) => {
      const items = resetDailyRevisionItems[dayKey] || [];
      const autoItem = computeAutoRevisionItem(rotation, schedule, currentWeekNum, startWeek, dayKey);
      if (autoItem) {
        const autoIdx = items.findIndex((it) => isAutoRevisionItem(it));
        if (autoIdx >= 0) items[autoIdx] = autoItem;
        else items.unshift(autoItem);
      }
      resetDailyRevisionItems[dayKey] = items;
    });
  }

  return {
    changed: true,
    data: {
      ...loadedData,
      phases: resetPhases,
      dailyTasks: {
        ...(loadedData.dailyTasks || {}),
        ...resetDailyTasks
      },
      dailyRevisionItems: {
        ...(loadedData.dailyRevisionItems || {}),
        ...resetDailyRevisionItems
      },
      weeklyCompletions: prevWeeklyCompletions,
      lastTasksResetDate: todayStr
    },
  };
}
