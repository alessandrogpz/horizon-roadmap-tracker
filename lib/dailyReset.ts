import type { AppState, RevisionItem } from "./types";
import { getWeekNum, parseYMD, DAYS_SHORT } from "./dates";
import { DEFAULT_WEEK_SCHEDULE, DSA_PATTERN_WEEKS, dsaPatternIndex } from "./constants";

/**
 * When a new day starts: snapshot yesterday's completions into weeklyCompletions,
 * uncheck all tasks, and rotate the auto DSA/Math revision items for the new week.
 * Pure — returns the updated state (or the input unchanged if no reset is due).
 */
export function applyDailyResetIfNeeded(loadedData: AppState, todayStr: string): { data: AppState; changed: boolean } {
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
  const resetDailyTasks: AppState["dailyTasks"] = {};
  if (loadedData.dailyTasks) {
    Object.keys(loadedData.dailyTasks).forEach((key) => {
      resetDailyTasks[key] = loadedData.dailyTasks[key].map((t) => ({ ...t, completed: false }));
    });
  }

  // Reset daily revision items
  const resetDailyRevisionItems: AppState["dailyRevisionItems"] = {};
  if (loadedData.dailyRevisionItems) {
    Object.keys(loadedData.dailyRevisionItems).forEach((key) => {
      resetDailyRevisionItems[key] = loadedData.dailyRevisionItems[key].map((it) => ({ ...it, completed: false }));
    });
  }

  // DSA Pattern Auto-Rotation: update revision items based on interleaving schedule
  const dsaStartWeek = loadedData.dsaStartWeek || 1;
  const currentWeekNum = getWeekNum(loadedData.startDate);
  const currentPattern = DSA_PATTERN_WEEKS[dsaPatternIndex(currentWeekNum, dsaStartWeek)];

  // Compute revision days dynamically from schedule
  const schedule = loadedData.weekSchedule || DEFAULT_WEEK_SCHEDULE;
  const mathDayNames = schedule.filter((d) => d.type === "math").map((d) => d.name);

  const isAutoItem = (item: RevisionItem | undefined) =>
    !!item && (item.id?.startsWith("rev_") || item.id?.startsWith("dsa_") || item.id === "math_revision");

  const ALL_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  ALL_WEEKDAYS.forEach((dayKey) => {
    const items = resetDailyRevisionItems[dayKey] || [];
    if (mathDayNames.includes(dayKey)) {
      // DSA revision day (Math study day): populate with auto-rotated DSA pattern
      const autoIdx = items.findIndex((it) => it.id === "dsa_auto");
      const autoItem: RevisionItem = {
        id: "dsa_auto",
        title: currentPattern.pattern,
        description: currentPattern.problems,
        completed: false
      };
      if (autoIdx >= 0) {
        items[autoIdx] = autoItem;
      } else if (items.length > 0 && isAutoItem(items[0])) {
        items[0] = autoItem;
      } else {
        items.unshift(autoItem);
      }
    } else {
      // Math revision day (DSA study day): populate with Linear Algebra revision item
      const mathIdx = items.findIndex((it) => it.id === "math_revision" || it.id === "dsa_auto");
      const mathItem: RevisionItem = {
        id: "math_revision",
        title: "Linear Algebra",
        description: "Practice vector spaces, transforms, and equations",
        completed: false
      };
      if (mathIdx >= 0) {
        items[mathIdx] = mathItem;
      } else if (items.length > 0 && isAutoItem(items[0])) {
        items[0] = mathItem;
      } else {
        items.unshift(mathItem);
      }
    }
    resetDailyRevisionItems[dayKey] = items;
  });

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
