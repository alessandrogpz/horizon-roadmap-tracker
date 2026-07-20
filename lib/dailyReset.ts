import type { TrackState } from "./types";
import { getWeekNum, parseYMD, DAYS_SHORT } from "./dates";
import { computeRotationItemsForDay, isRotationItem } from "./rotation";

/**
 * When a new day starts: snapshot yesterday's completions into weeklyCompletions,
 * uncheck all tasks, and (for tracks with any configured rotations) refresh
 * each rotation's item for the new week.
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

  // Rotations: each independently-configured recurring item list (e.g. an
  // algorithm rotation on Mon/Wed/Fri, a reading rotation on Tue/Thu) writes
  // its current item into either the day's Revision or Focus list, on
  // whichever days it's set to run. Tracks with none simply skip this.
  const rotations = loadedData.rotations || [];
  if (rotations.length > 0) {
    const currentWeekNum = getWeekNum(loadedData.startDate);
    const ALL_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    ALL_WEEKDAYS.forEach((dayKey) => {
      const { revisions, focus } = computeRotationItemsForDay(rotations, currentWeekNum, dayKey);

      const manualRevisions = (resetDailyRevisionItems[dayKey] || []).filter((it) => !isRotationItem(it));
      resetDailyRevisionItems[dayKey] = [...revisions, ...manualRevisions];

      const manualFocus = (resetDailyTasks[dayKey] || []).filter((it) => !isRotationItem(it));
      resetDailyTasks[dayKey] = [...focus, ...manualFocus];
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
