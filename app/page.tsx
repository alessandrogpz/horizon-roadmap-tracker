"use client";

import React, { useEffect, useState, useRef } from "react";
import { fetchAppState, updateAppState, openLinkOnSystem, syncWorkspace } from "@/lib/api";
import { 
  isGoogleAuthenticated, 
  getGoogleClientId, 
  authenticateGoogleDrive, 
  syncWithGoogleDrive, 
  setGoogleClientId,
  loadGoogleGisScript
} from "@/lib/googleDrive";
import StreakGraph from "@/components/StreakGraph";
import PhaseTracker from "@/components/PhaseTracker";
import PortfolioTracker from "@/components/PortfolioTracker";
import MaterialsTracker from "@/components/MaterialsTracker";
import PhaseDetailModal from "@/components/PhaseDetailModal";
import ScheduleDayModal from "@/components/ScheduleDayModal";
import PomodoroTimer from "@/components/PomodoroTimer";

function getMondayOfDateWeek(date: Date): Date {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekNum(startDateStr: string, targetDate: Date = new Date()): number {
  if (!startDateStr) return 1;
  const parts = startDateStr.split("-");
  const start = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  start.setHours(0, 0, 0, 0);
  
  const startMonday = getMondayOfDateWeek(start);
  
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - startMonday.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.floor(diffDays / 7) + 1;
}

const DEFAULT_WEEK_SCHEDULE = [
  { name: "Mon", type: "math", label: "Math" },
  { name: "Tue", type: "dsapattern", label: "DSA Pattern" },
  { name: "Wed", type: "math", label: "Math" },
  { name: "Thu", type: "dsapattern", label: "DSA Pattern" },
  { name: "Fri", type: "math", label: "Math" },
  { name: "Sat", type: "implementation", label: "DS Implementation" },
  { name: "Sun", type: "free", label: "Free" }
];

// Default focus type color palette
const DEFAULT_FOCUS_TYPES: Record<string, { label: string; color: string }> = {
  math: { label: "Math", color: "#a78bfa" },
  dsapattern: { label: "DSA Pattern", color: "#34d399" },
  dsapractice: { label: "DSA Practice", color: "#22d3ee" },
  implementation: { label: "DS Implementation", color: "#fbbf24" },
  free: { label: "Free", color: "#a1a1aa" },
};

// 10-week DSA pattern rotation (matches DSA_Study_Guide.md ordering)
const DSA_PATTERN_WEEKS = [
  { pattern: "Hash Map Patterns", problems: "Two Sum, Group Anagrams, Top K Frequent Elements, Longest Consecutive Sequence" },
  { pattern: "Two Pointers", problems: "Valid Palindrome, Two Sum II, 3Sum, Container With Most Water, Trapping Rain Water" },
  { pattern: "Sliding Window", problems: "Best Time to Buy/Sell Stock, Longest Substring Without Repeating, Longest Repeating Character Replacement, Minimum Window Substring" },
  { pattern: "Binary Search (Advanced)", problems: "Search a 2D Matrix, Find Min in Rotated Array, Search in Rotated Array, Koko Eating Bananas" },
  { pattern: "Stack & Monotonic Stack", problems: "Valid Parentheses, Min Stack, Daily Temperatures, Largest Rectangle in Histogram" },
  { pattern: "Heap / Priority Queue", problems: "Kth Largest Element, K Closest Points, Find Median from Data Stream, Merge k Sorted Lists" },
  { pattern: "Trees / DFS / BFS", problems: "Invert Binary Tree, Max Depth, Validate BST, Level Order Traversal, Lowest Common Ancestor" },
  { pattern: "Interval Problems", problems: "Merge Intervals, Insert Interval, Non-overlapping Intervals, Meeting Rooms" },
  { pattern: "DP Basics", problems: "Climbing Stairs, House Robber, Coin Change, Longest Increasing Subsequence, Unique Paths" },
  { pattern: "Graphs & Union-Find", problems: "Number of Islands, Clone Graph, Course Schedule, Redundant Connection" },
];

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState("");
  const [dailyExpanded, setDailyExpanded] = useState(false);
  const [todayStr, setTodayStr] = useState("");
  const dailySaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveDailyChanges = (newData: any) => {
    if (dailySaveTimeoutRef.current) {
      clearTimeout(dailySaveTimeoutRef.current);
    }
    dailySaveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateAppState(newData);
      } catch (err) {
        console.error("Failed to auto-save daily changes", err);
      }
    }, 1000);
  };

  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<any>(null);
  const [showRotationModal, setShowRotationModal] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedPhase, setSelectedPhase] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncError, setSyncError] = useState("");

  // Compute the actual calendar date string for a given day name (Mon-Sun) at a given week offset
  const getDateForDayName = (dayName: string, offset: number = 0): string => {
    const dayNameToIndex: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
    const targetDayIndex = dayNameToIndex[dayName] ?? 0;
    const today = new Date();
    const currentMonday = getMondayOfDateWeek(today);
    const mondayOfTargetWeek = new Date(currentMonday);
    mondayOfTargetWeek.setDate(currentMonday.getDate() + offset * 7);
    // Calculate diff from Monday
    const diff = targetDayIndex === 0 ? 6 : targetDayIndex - 1; // Mon=0, Tue=1, ..., Sun=6
    const targetDate = new Date(mondayOfTargetWeek);
    targetDate.setDate(mondayOfTargetWeek.getDate() + diff);
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleSyncWorkspace = async (e: React.MouseEvent) => {
    // Shift click to disconnect Google Drive
    if (e.shiftKey) {
      if (confirm("Disconnect Google Drive and clear client configuration?")) {
        localStorage.removeItem("google_drive_client_id");
        localStorage.removeItem("google_drive_access_token");
        localStorage.removeItem("google_drive_token_expiry");
        alert("Google Drive disconnected.");
      }
      return;
    }

    setSyncStatus("syncing");
    setSyncError("");
    try {
      if (!isGoogleAuthenticated()) {
        let clientId = getGoogleClientId();
        if (!clientId) {
          clientId = prompt("Enter your Google OAuth Client ID to connect Google Drive:") || "";
          if (!clientId) {
            setSyncStatus("idle");
            return;
          }
          setGoogleClientId(clientId);
        }
        await authenticateGoogleDrive(clientId);
      }

      const res = await syncWithGoogleDrive();
      if (res.success) {
        setSyncStatus("success");
        setTimeout(() => setSyncStatus("idle"), 3000);
        // Refresh local UI state and assert isSynced flag is true
        const loadedData = await fetchAppState();
        const updatedData = { ...loadedData, isSynced: true };
        await updateAppState(updatedData);
        setData(updatedData);
      } else {
        throw new Error(res.error || "Unknown sync error");
      }
    } catch (err: any) {
      console.error("Workspace sync failed:", err);
      setSyncStatus("error");
      setSyncError(err.message || "Failed to sync workspace");
      setTimeout(() => setSyncStatus("idle"), 5000);
    }
  };

  useEffect(() => {
    // Client-only initialization and service worker registration for PWA
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").then(
          (reg) => console.log("SW registered:", reg.scope),
          (err) => console.error("SW registration failed:", err)
        );
      });
    }

    // Pre-load Google GIS script to prevent popup blocker issues
    loadGoogleGisScript().catch(err => console.error("Failed to preload Google GIS:", err));

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const currentTodayStr = `${year}-${month}-${day}`;
    
    setTodayStr(currentTodayStr);
    setDayOfWeek(today.getDay());

    fetchAppState()
      .then(async (loadedData) => {
        let finalData = loadedData;
        if (loadedData && loadedData.isSynced && loadedData.lastTasksResetDate !== currentTodayStr) {
          // Snapshot yesterday's completions into weeklyCompletions before resetting
          const prevWeeklyCompletions = { ...(loadedData.weeklyCompletions || {}) };
          const prevDateStr = loadedData.lastTasksResetDate;
          if (prevDateStr) {
            const completedTaskIds: string[] = [];
            const completedRevisionIds: string[] = [];
            if (loadedData.dailyTasks) {
              Object.values(loadedData.dailyTasks).forEach((tasks: any) => {
                (tasks || []).forEach((t: any) => {
                  if (t.completed && t.id) completedTaskIds.push(t.id);
                });
              });
            }
            if (loadedData.dailyRevisionItems) {
              Object.values(loadedData.dailyRevisionItems).forEach((items: any) => {
                (items || []).forEach((it: any) => {
                  if (it.completed && it.id) completedRevisionIds.push(it.id);
                });
              });
            }
            // Find which day name corresponds to the previous date
            const prevDate = new Date(prevDateStr + "T00:00:00");
            const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const prevDayName = DAYS_SHORT[prevDate.getDay()];
            // Only save task/revision IDs for that specific day
            const dayTasks = loadedData.dailyTasks?.[prevDayName] || [];
            const dayRevisions = loadedData.dailyRevisionItems?.[prevDayName] || [];
            prevWeeklyCompletions[prevDateStr] = {
              tasks: dayTasks.filter((t: any) => t.completed).map((t: any) => t.id),
              revisions: dayRevisions.filter((it: any) => it.completed).map((it: any) => it.id),
            };
          }

          // Reset all tasks in all phases to completed: false
          const resetPhases = loadedData.phases.map((phase: any) => ({
            ...phase,
            tasks: phase.tasks.map((t: any) => ({ ...t, completed: false }))
          }));
          // Reset daily tasks
          const resetDailyTasks: any = {};
          if (loadedData.dailyTasks) {
            Object.keys(loadedData.dailyTasks).forEach((key) => {
              resetDailyTasks[key] = loadedData.dailyTasks[key].map((t: any) => ({ ...t, completed: false }));
            });
          }
          // Reset daily revision items
          const resetDailyRevisionItems: any = {};
          if (loadedData.dailyRevisionItems) {
            Object.keys(loadedData.dailyRevisionItems).forEach((key) => {
              resetDailyRevisionItems[key] = loadedData.dailyRevisionItems[key].map((it: any) => ({ ...it, completed: false }));
            });
          }

          // DSA Pattern Auto-Rotation: update revision items based on interleaving schedule
          const dsaStartWeek = loadedData.dsaStartWeek || 1;
          const currentWeekNum = getWeekNum(loadedData.startDate, today);
          const dsaWeekIndex = ((currentWeekNum - dsaStartWeek) % DSA_PATTERN_WEEKS.length + DSA_PATTERN_WEEKS.length) % DSA_PATTERN_WEEKS.length;
          const currentPattern = DSA_PATTERN_WEEKS[dsaWeekIndex];

          // Compute revision days dynamically from schedule
          const schedule = loadedData.weekSchedule || DEFAULT_WEEK_SCHEDULE;
          const mathDayNames = schedule.filter((d: any) => d.type === "math").map((d: any) => d.name);
          const nonMathDayNames = schedule.filter((d: any) => d.type !== "math" && d.type !== "free").map((d: any) => d.name);

          const ALL_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          ALL_WEEKDAYS.forEach((dayKey) => {
            const items = resetDailyRevisionItems[dayKey] || [];
            if (mathDayNames.includes(dayKey)) {
              // DSA revision day (Math study day): populate with auto-rotated DSA pattern
              const autoIdx = items.findIndex((it: any) => it.id === "dsa_auto");
              const autoItem = {
                id: "dsa_auto",
                title: currentPattern.pattern,
                description: currentPattern.problems,
                completed: false
              };
              if (autoIdx >= 0) {
                items[autoIdx] = autoItem;
              } else {
                if (items.length > 0 && (items[0].id?.startsWith("rev_") || items[0].id?.startsWith("dsa_") || items[0].id === "math_revision")) {
                  items[0] = autoItem;
                } else {
                  items.unshift(autoItem);
                }
              }
            } else {
              // Math revision day (DSA study day): populate with Linear Algebra revision item
              const mathIdx = items.findIndex((it: any) => it.id === "math_revision" || it.id === "dsa_auto");
              const mathItem = {
                id: "math_revision",
                title: "Linear Algebra",
                description: "Practice vector spaces, transforms, and equations",
                completed: false
              };
              if (mathIdx >= 0) {
                items[mathIdx] = mathItem;
              } else {
                if (items.length > 0 && (items[0].id?.startsWith("rev_") || items[0].id?.startsWith("dsa_") || items[0].id === "math_revision")) {
                  items[0] = mathItem;
                } else {
                  items.unshift(mathItem);
                }
              }
            }
            resetDailyRevisionItems[dayKey] = items;
          });
          const updatedData = {
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
            lastTasksResetDate: currentTodayStr
          };
          finalData = updatedData;
          setData(updatedData);
          
          try {
            await updateAppState({ ...updatedData, isReset: true });
          } catch (err) {
            console.error("Failed to auto-reset daily tasks on date change:", err);
          }
        } else {
          setData(loadedData);
        }


      })
      .catch((err: any) => {
        console.error("Initialization fetch error:", err);
        setInitError(err.message || String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  // Determine dynamic daily routine task based on day of week
  const getDailyRoutineTask = () => {
    switch (dayOfWeek) {
      case 1: // Monday
      case 3: // Wednesday
        return {
          title: "Today's Focus: Mathematics",
          type: "math",
        };
      case 2: // Tuesday
      case 4: // Thursday
        return {
          title: "Today's Focus: DSA Pattern Study",
          type: "dsapattern",
        };
      case 5: // Friday
        return {
          title: "Today's Focus: DSA Practice",
          type: "dsapractice",
        };
      case 6: // Saturday
        return {
          title: "Today's Focus: Custom Data Structure Implementation",
          type: "implementation",
        };
      case 0: // Sunday
      default:
        return {
          title: "Today's Focus: Free / Catch-up",
          type: "free",
        };
    }
  };



  const getDaysPassed = () => {
    if (!data || !data.startDate || !data.isSynced) return 0;
    // Parse YYYY-MM-DD local parameters to avoid timezone offset conversion shifts
    const parts = data.startDate.split("-");
    const start = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const today = new Date();
    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays) + 1;
  };

  const getDaysInCurrentPhase = () => {
    if (!data || !data.isSynced) return "--";
    const phaseStartStr = data.currentPhaseStartDate || data.startDate;
    if (!phaseStartStr) return 0;
    const parts = phaseStartStr.split("-");
    const start = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const today = new Date();
    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays) + 1;
  };

  const handleRoutineToggle = async () => {
    if (!data) return;

    const isCurrentlyChecked = data.lastDailyRoutineCheck === todayStr;
    const nextCheckState = isCurrentlyChecked ? "" : todayStr;

    let newStreakHistory = [...(data.streakHistory || [])];
    let newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
    const todayItems = newCompletedItemsHistory[todayStr] || [];

    if (!isCurrentlyChecked) {
      newStreakHistory.push(todayStr);
      if (!todayItems.includes(routineTask.title)) {
        newCompletedItemsHistory[todayStr] = [...todayItems, routineTask.title];
      }
    } else {
      const index = newStreakHistory.indexOf(todayStr);
      if (index > -1) {
        newStreakHistory.splice(index, 1);
      }
      newCompletedItemsHistory[todayStr] = todayItems.filter((item: string) => item !== routineTask.title);
    }

    const newData = {
      ...data,
      lastDailyRoutineCheck: nextCheckState,
      streakHistory: newStreakHistory,
      completedItemsHistory: newCompletedItemsHistory
    };
    setData(newData);

    try {
      await updateAppState(newData);
    } catch (err) {
      console.error("Failed to sync routine toggle", err);
    }
  };

  const handleMaterialChange = async (materialId: string, newStatus: string) => {
    if (!data) return;

    const updatedMaterials = data.materials.map((m: any) => {
      if (m.id !== materialId) return m;
      return { ...m, status: newStatus };
    });

    let newStreakHistory = [...(data.streakHistory || [])];
    let newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
    const todayItems = newCompletedItemsHistory[todayStr] || [];
    const matTitle = data.materials.find((m: any) => m.id === materialId)?.title || "Study Material";
    const oldStatus = data.materials.find((m: any) => m.id === materialId)?.status;

    if (newStatus === "Completed" && oldStatus !== "Completed") {
      newStreakHistory.push(todayStr);
      if (!todayItems.includes(matTitle)) {
        newCompletedItemsHistory[todayStr] = [...todayItems, matTitle];
      }
    } else if (newStatus !== "Completed" && oldStatus === "Completed") {
      const index = newStreakHistory.indexOf(todayStr);
      if (index > -1) {
        newStreakHistory.splice(index, 1);
      }
      newCompletedItemsHistory[todayStr] = todayItems.filter((item: string) => item !== matTitle);
    }

    const newData = { 
      ...data, 
      materials: updatedMaterials, 
      streakHistory: newStreakHistory,
      completedItemsHistory: newCompletedItemsHistory
    };
    setData(newData);

    try {
      await updateAppState(newData);
    } catch (err) {
      console.error("Failed to sync material status", err);
    }
  };

  const handleMaterialProgressChange = async (materialId: string, fields: any) => {
    if (!data) return;

    const updatedMaterials = data.materials.map((m: any) => {
      if (m.id !== materialId) return m;
      return { ...m, ...fields };
    });

    const newData = { ...data, materials: updatedMaterials };
    setData(newData);

    try {
      await updateAppState(newData);
    } catch (err) {
      console.error("Failed to sync material progress", err);
    }
  };

  const handleAddMaterial = async (newMaterial: any) => {
    if (!data) return;

    const id = `m_${Date.now()}`;
    const materialWithId = { id, ...newMaterial };
    const newData = {
      ...data,
      materials: [...(data.materials || []), materialWithId],
    };
    setData(newData);

    try {
      await updateAppState(newData);
    } catch (err) {
      console.error("Failed to add material", err);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!data) return;

    const newData = {
      ...data,
      materials: data.materials.filter((m: any) => m.id !== materialId),
    };
    setData(newData);

    try {
      await updateAppState(newData);
    } catch (err) {
      console.error("Failed to delete material", err);
    }
  };

  const handleOpenLink = async (link: string) => {
    if (!link) return;
    if (link.startsWith("http://") || link.startsWith("https://")) {
      window.open(link, "_blank", "noopener,noreferrer");
    } else {
      try {
        await openLinkOnSystem(link);
      } catch (err) {
        console.error("Failed to open local link", err);
      }
    }
  };

  const handlePortfolioToggle = async (projectId: string) => {
    if (!data) return;

    let isNowCompleted = false;
    const updatedPortfolio = data.portfolio.map((p: any) => {
      if (p.id !== projectId) return p;
      isNowCompleted = !p.completed;
      return { ...p, completed: !p.completed };
    });

    let newStreakHistory = [...(data.streakHistory || [])];
    let newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
    const todayItems = newCompletedItemsHistory[todayStr] || [];
    const projTitle = data.portfolio.find((p: any) => p.id === projectId)?.title || "Portfolio Project";

    if (isNowCompleted) {
      newStreakHistory.push(todayStr);
      if (!todayItems.includes(projTitle)) {
        newCompletedItemsHistory[todayStr] = [...todayItems, projTitle];
      }
    } else {
      const index = newStreakHistory.indexOf(todayStr);
      if (index > -1) {
        newStreakHistory.splice(index, 1);
      }
      newCompletedItemsHistory[todayStr] = todayItems.filter((item: string) => item !== projTitle);
    }

    const newData = {
      ...data,
      portfolio: updatedPortfolio,
      streakHistory: newStreakHistory,
      completedItemsHistory: newCompletedItemsHistory
    };
    setData(newData);

    try {
      await updateAppState(newData);
    } catch (err) {
      console.error("Failed to sync portfolio toggle", err);
    }
  };

  const handlePhaseChange = async (newPhaseId: number) => {
    if (!data) return;

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const newData = { 
      ...data, 
      currentPhase: newPhaseId,
      currentPhaseStartDate: todayStr
    };
    setData(newData);

    try {
      await updateAppState(newData);
    } catch (err) {
      console.error("Failed to update phase", err);
    }
  };

  const handleTaskToggle = async (phaseId: number, taskId: string) => {
    if (!data) return;

    let taskCompletedState = false;
    const updatedPhases = data.phases.map((phase: any) => {
      if (phase.id !== phaseId) return phase;
      return {
        ...phase,
        tasks: phase.tasks.map((t: any) => {
          if (t.id !== taskId) return t;
          taskCompletedState = !t.completed;
          return { ...t, completed: !t.completed };
        }),
      };
    });

    let newStreakHistory = [...(data.streakHistory || [])];
    let newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
    const todayItems = newCompletedItemsHistory[todayStr] || [];
    let taskTitle = "Task";
    data.phases.forEach((phase: any) => {
      const t = phase.tasks.find((task: any) => task.id === taskId);
      if (t) taskTitle = t.title;
    });

    if (taskCompletedState) {
      newStreakHistory.push(todayStr);
      if (!todayItems.includes(taskTitle)) {
        newCompletedItemsHistory[todayStr] = [...todayItems, taskTitle];
      }
    } else {
      const index = newStreakHistory.indexOf(todayStr);
      if (index > -1) {
        newStreakHistory.splice(index, 1);
      }
      newCompletedItemsHistory[todayStr] = todayItems.filter((item: string) => item !== taskTitle);
    }

    const newData = {
      ...data,
      phases: updatedPhases,
      streakHistory: newStreakHistory,
      completedItemsHistory: newCompletedItemsHistory
    };
    setData(newData);

    try {
      await updateAppState(newData);
    } catch (err) {
      console.error("Failed to sync task toggle", err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", backgroundColor: "#09090b", color: "#e4e4e7" }}>
        <span className="animate-spin" style={{ fontSize: "2rem" }}>↻</span>
        <p>Loading your engine dev workspace...</p>
      </div>
    );
  }

  if (initError || !data) {
    return (
      <div style={{ display: "flex", height: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", backgroundColor: "#09090b", color: "#e4e4e7", fontFamily: "monospace", textAlign: "center" }}>
        <h2 style={{ color: "#f59e0b", marginBottom: "1rem", textTransform: 'uppercase', letterSpacing: '0.05em' }}>Initialization Failed</h2>
        <p style={{ color: "#a1a1aa", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          The app failed to connect to the backend server.
        </p>
        <div style={{ padding: "1rem", backgroundColor: "#121214", borderRadius: "6px", border: "1px solid var(--card-border)", color: "#f87171", marginBottom: "1.5rem", maxWidth: "500px", wordBreak: "break-all" }}>
          {initError || "No data was returned by the server."}
        </div>
        <button className="btn" onClick={() => window.location.reload()}>Retry Connection</button>
      </div>
    );
  }

  const currentPhaseData = data.phases.find((p: any) => p.id === data.currentPhase);
  const routineTask = getDailyRoutineTask();
  const isRoutineChecked = data.lastDailyRoutineCheck === todayStr;

  return (
    <main className="container">
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {/* Main Header */}
        <header 
          className="main-header"
          style={{ 
            width: "100%",
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            flexWrap: "wrap", 
            gap: "1.5rem", 
            borderBottom: "1px solid var(--card-border)", 
            paddingBottom: "1.5rem" 
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", letterSpacing: "-0.01em" }}>
              <span style={{ color: "var(--accent)" }}>&gt;_</span> Engine Developer Hub
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <p style={{ color: "#a1a1aa", fontSize: "0.85rem", margin: 0 }}>12-Month Graphics Programming Tracker</p>
              <span style={{ color: "var(--card-border)", fontSize: "0.8rem" }}>|</span>
              {data?.isSynced ? (
                <a 
                  href="/roadmap" 
                  style={{ 
                    color: "var(--accent)", 
                    fontSize: "0.85rem", 
                    textDecoration: "none", 
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem"
                  }}
                  className="link-title"
                >
                  Full Roadmap
                </a>
              ) : (
                <span 
                  style={{ 
                    color: "#52525b", 
                    fontSize: "0.85rem", 
                    fontWeight: 600,
                    cursor: "not-allowed"
                  }}
                  title="Connect Google Drive to unlock roadmap"
                >
                  Full Roadmap (Locked)
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "nowrap", flex: "0 1 auto" }}>
            {/* Sync Workspace Button */}
            <button
              onClick={handleSyncWorkspace}
              disabled={syncStatus === "syncing"}
              className="glass-panel"
              style={{
                padding: "0 1.25rem",
                display: "flex",
                alignItems: "center",
                height: "38px",
                margin: 0,
                borderRadius: "6px",
                boxShadow: "none",
                whiteSpace: "nowrap",
                flexShrink: 0,
                background: syncStatus === "success" ? "rgba(16, 185, 129, 0.12)" : syncStatus === "error" ? "rgba(239, 68, 68, 0.12)" : "rgba(255, 255, 255, 0.03)",
                border: `1px solid ${syncStatus === "success" ? "rgba(16, 185, 129, 0.3)" : syncStatus === "error" ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.05)"}`,
                cursor: syncStatus === "syncing" ? "not-allowed" : "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseOver={(e) => {
                if (syncStatus === "idle") {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                  e.currentTarget.style.borderColor = "var(--accent)";
                }
              }}
              onMouseOut={(e) => {
                if (syncStatus === "idle") {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.05)";
                }
              }}
              title={syncStatus === "error" ? syncError : "Backup and Sync to Google Drive (Shift+Click to disconnect)"}
            >
              <span style={{ fontSize: "0.6rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginRight: "0.4rem" }}>
                Cloud Sync:
              </span>
              <span style={{ 
                fontSize: "0.8rem", 
                fontWeight: 600, 
                color: syncStatus === "success" ? "var(--success)" : syncStatus === "error" ? "#ef4444" : "var(--accent)", 
                fontFamily: "monospace" 
              }}>
                {syncStatus === "idle" && "Sync Now"}
                {syncStatus === "syncing" && "Syncing..."}
                {syncStatus === "success" && "Success ✓"}
                {syncStatus === "error" && "Error ✕"}
              </span>
            </button>

            {/* Days in current Phase badge */}
            <div 
              className="glass-panel" 
              style={{ 
                padding: "0 1rem", 
                display: "flex", 
                alignItems: "center", 
                height: "38px",
                margin: 0,
                borderRadius: "6px",
                boxShadow: "none",
                whiteSpace: "nowrap",
                flexShrink: 0
              }}
            >
              <span style={{ fontSize: "0.6rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginRight: "0.4rem" }}>
                Phase Day
              </span>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--accent)", fontFamily: "monospace" }}>
                {getDaysInCurrentPhase()}
              </span>
            </div>

            {/* Overall Plan Progress */}
            <div 
              className="glass-panel" 
              style={{ 
                padding: "0 1rem", 
                display: "flex", 
                alignItems: "center", 
                gap: "1rem", 
                minWidth: "200px", 
                height: "38px",
                margin: 0,
                borderRadius: "6px",
                boxShadow: "none"
              }}
            >
              <div style={{ flexShrink: 0, display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.6rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>Progress</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fff", fontFamily: "monospace" }}>
                  {getDaysPassed()}/365
                </span>
              </div>
              <div style={{ flex: 1, height: "4px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                <div 
                  style={{ 
                    width: `${Math.min(100, (getDaysPassed() / 365) * 100)}%`, 
                    height: "100%", 
                    backgroundColor: "var(--accent)",
                    transition: "width 0.3s ease" 
                  }} 
                />
              </div>
            </div>
          </div>
        </header>

        {/* Phase recommendation alert */}
        {(() => {
          const days = getDaysPassed();
          const recPhase = days <= 90 ? 1 : days <= 210 ? 2 : days <= 300 ? 3 : 4;
          if (data.currentPhase !== recPhase) {
            return (
              <div className="glass-panel" style={{ borderLeft: "4px solid #f59e0b", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem" }}>
                <span style={{ fontSize: "0.9rem", color: "#f3f4f6" }}>
                  Schedule suggestion: Time to transition to Phase {recPhase} (Day {days})
                </span>
                <button 
                  onClick={() => handlePhaseChange(recPhase)} 
                  className="btn" 
                  style={{ padding: "0.25rem 0.75rem", fontSize: "0.85rem", background: "#d97706" }}
                >
                  Switch Now
                </button>
              </div>
            );
          }
          return null;
        })()}

        {/* Weekly Study Plan */}
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
                  <button
                    onClick={() => setWeekOffset(weekOffset - 1)}
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
                    ‹
                  </button>
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
                    {(() => {
                      if (!data || !data.isSynced) return "Week --";
                      const targetDate = new Date();
                      targetDate.setDate(targetDate.getDate() + weekOffset * 7);
                      const wn = getWeekNum(data.startDate, targetDate);
                      return `Week ${wn}`;
                    })()}
                    {weekOffset !== 0 && (
                      <span style={{ fontSize: "0.7rem", color: "#71717a", marginLeft: "0.25rem" }}>
                        ({weekOffset > 0 ? `+${weekOffset}` : weekOffset})
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => setWeekOffset(weekOffset + 1)}
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
                    ›
                  </button>
                  
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
                  onClick={() => { if (data?.isSynced) setShowRotationModal(true); }}
                  style={{ 
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    background: "rgba(14, 165, 233, 0.08)",
                    border: "1px dashed rgba(14, 165, 233, 0.3)",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "6px",
                    cursor: data?.isSynced ? "pointer" : "default",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap"
                  }}
                  onMouseOver={(e) => { 
                    if (data?.isSynced) {
                      e.currentTarget.style.background = "rgba(14, 165, 233, 0.15)"; 
                      e.currentTarget.style.borderColor = "rgba(14, 165, 233, 0.5)"; 
                    }
                  }}
                  onMouseOut={(e) => { 
                    if (data?.isSynced) {
                      e.currentTarget.style.background = "rgba(14, 165, 233, 0.08)"; 
                      e.currentTarget.style.borderColor = "rgba(14, 165, 233, 0.3)"; 
                    }
                  }}
                  title={data?.isSynced ? "View full 10-week Algorithm plan" : "Connect Google Drive to unlock"}
                >
                  <span style={{ fontSize: "0.7rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    Weekly Algorithm:
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "var(--accent)", fontWeight: 700, fontFamily: "monospace" }}>
                    {(() => {
                      if (!data || !data.isSynced) return "Algorithm (Placeholder)";
                      const targetDate = new Date();
                      targetDate.setDate(targetDate.getDate() + weekOffset * 7);
                      const wn = getWeekNum(data.startDate, targetDate);
                      const idx = ((wn - (data.dsaStartWeek || 1)) % DSA_PATTERN_WEEKS.length + DSA_PATTERN_WEEKS.length) % DSA_PATTERN_WEEKS.length;
                      return DSA_PATTERN_WEEKS[idx].pattern;
                    })()}
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
              {(data.weekSchedule || DEFAULT_WEEK_SCHEDULE).map((dayItem: any, idx: number) => {
                const isCurrentWeek = weekOffset === 0;
                const isToday = isCurrentWeek && idx === (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
                const dayKey = dayItem.name;
                const dayDateStr = getDateForDayName(dayKey, weekOffset);
                const revisionItems = data?.dailyRevisionItems?.[dayKey] || [];
                const focusTasks = data?.dailyTasks?.[dayKey] || [];

                // Determine completion: for today use live data, for other days use weeklyCompletions
                const weeklyCompletions = data.weeklyCompletions || {};
                const dayCompletions = weeklyCompletions[dayDateStr] || { tasks: [], revisions: [] };
                
                // Check if this day is in the past relative to today (within current week)
                const todayDate = new Date();
                todayDate.setHours(0, 0, 0, 0);
                const dayDate = new Date(dayDateStr + "T00:00:00");
                const isPast = dayDate < todayDate;
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
                      ? revisionItems.map((it: any) => it.id === itemId ? { ...it, completed: newCompleted } : it)
                      : focusTasks.map((t: any) => t.id === itemId ? { ...t, completed: newCompleted } : t);
                    
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
                      const alreadyExists = todayItems.some((it: any) => (typeof it === 'string' ? it === itemTitle : it.title === itemTitle));
                      if (!alreadyExists) {
                        newCompletedItemsHistory[todayStr] = [...todayItems, { title: itemTitle, description: itemDesc || "" }];
                      }
                    } else {
                      const sIdx = newStreakHistory.indexOf(todayStr);
                      if (sIdx > -1) newStreakHistory.splice(sIdx, 1);
                      newCompletedItemsHistory[todayStr] = todayItems.filter((it: any) => (typeof it === 'string' ? it !== itemTitle : it.title !== itemTitle));
                    }

                    const dataKey = isRevision ? "dailyRevisionItems" : "dailyTasks";
                    const newData = {
                      ...data,
                      [dataKey]: { ...(data[dataKey] || {}), [dayKey]: updatedList },
                      weeklyCompletions: newWeeklyCompletions,
                      streakHistory: newStreakHistory,
                      completedItemsHistory: newCompletedItemsHistory,
                    };
                    setData(newData);
                    saveDailyChanges(newData);
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
                      const alreadyExists = targetDateItems.some((it: any) => (typeof it === 'string' ? it === itemTitle : it.title === itemTitle));
                      if (!alreadyExists) {
                        newCompletedItemsHistory[dayDateStr] = [...targetDateItems, { title: itemTitle, description: itemDesc || "" }];
                      }
                    } else {
                      const sIdx = newStreakHistory.indexOf(dayDateStr);
                      if (sIdx > -1) newStreakHistory.splice(sIdx, 1);
                      newCompletedItemsHistory[dayDateStr] = targetDateItems.filter((it: any) => (typeof it === 'string' ? it !== itemTitle : it.title !== itemTitle));
                    }

                    const newData = {
                      ...data,
                      weeklyCompletions: newWeeklyCompletions,
                      streakHistory: newStreakHistory,
                      completedItemsHistory: newCompletedItemsHistory,
                    };
                    setData(newData);
                    saveDailyChanges(newData);
                  }
                };

                const tagColors: Record<string, { bg: string; text: string }> = {};
                const focusTypes = data.focusTypes || DEFAULT_FOCUS_TYPES;
                Object.entries(focusTypes).forEach(([key, val]: [string, any]) => {
                  const c = val.color || "#a1a1aa";
                  const r = parseInt(c.slice(1, 3), 16);
                  const g = parseInt(c.slice(3, 5), 16);
                  const b = parseInt(c.slice(5, 7), 16);
                  tagColors[key] = { bg: `rgba(${r}, ${g}, ${b}, 0.2)`, text: c };
                });
                const tag = tagColors[dayItem.type] || { bg: "rgba(113, 113, 122, 0.2)", text: "#a1a1aa" };

                return (
                  <div
                    key={dayItem.name}
                    onClick={() => setSelectedScheduleDay(dayItem)}
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
                        {data?.isSynced ? dayDateStr.slice(5) : "MM-DD"}
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
                          {revisionItems.map((item: any, i: number) => {
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
                          {focusTasks.map((task: any, i: number) => {
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
              })}
            </div>
          </div>
        </div>


        {/* Phase Tracker */}
        <PhaseTracker phases={data.phases} currentPhase={data.currentPhase} onPhaseClick={setSelectedPhase} />

        {/* Streak Graph */}
        <StreakGraph 
          streakHistory={data.streakHistory} 
          completedItemsHistory={data.completedItemsHistory || {}} 
          startDate={data.startDate}
        />

        {/* Pomodoro Timer */}
        <PomodoroTimer />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {/* Portfolio Tracker sidebar */}
        <PortfolioTracker portfolio={data.portfolio} onToggle={handlePortfolioToggle} />

        {/* Materials Tracker */}
        <MaterialsTracker
          materials={data.materials || []}
          onStatusChange={handleMaterialChange}
          onProgressChange={handleMaterialProgressChange}
          onAddMaterial={handleAddMaterial}
          onDeleteMaterial={handleDeleteMaterial}
          onOpenLink={handleOpenLink}
        />
      </div>
      {selectedPhase && (
        <PhaseDetailModal 
          phase={selectedPhase} 
          currentPhaseId={data.currentPhase}
          onClose={() => setSelectedPhase(null)} 
          onActivatePhase={handlePhaseChange}
        />
      )}
      {selectedScheduleDay && (
        <ScheduleDayModal
          day={selectedScheduleDay}
          data={data}
          setData={setData}
          saveDailyChanges={saveDailyChanges}
          onClose={() => setSelectedScheduleDay(null)}
          updateAppState={updateAppState}
          weekOffset={weekOffset}
        />
      )}
      {showRotationModal && (
        <div 
          onClick={() => setShowRotationModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="glass-panel"
            style={{
              maxWidth: "600px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              padding: "2rem",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
              border: "1px solid var(--accent)",
              position: "relative",
              borderRadius: "8px"
            }}
          >
            {/* Close Button */}
            <button 
              onClick={() => setShowRotationModal(false)}
              style={{
                position: "absolute",
                top: "1.5rem",
                right: "1.5rem",
                background: "transparent",
                border: "none",
                color: "#a1a1aa",
                fontSize: "1.2rem",
                cursor: "pointer",
              }}
            >
              ✕
            </button>

            {/* Modal Header */}
            <div>
              <span style={{ 
                fontSize: "0.75rem", 
                background: "rgba(14, 165, 233, 0.1)", 
                color: "var(--accent)", 
                padding: "0.15rem 0.5rem", 
                borderRadius: "4px", 
                fontWeight: 600,
                textTransform: "uppercase",
                fontFamily: "monospace",
                letterSpacing: "0.05em"
              }}>
                10-Week Rotation Cycle
              </span>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff", marginTop: "0.5rem", marginBottom: "0.25rem" }}>
                DSA Pattern Rotation
              </h2>
              <p style={{ fontSize: "0.85rem", color: "#a1a1aa", margin: 0 }}>
                Currently on Week {getWeekNum(data.startDate)} of curriculum.
              </p>
            </div>

            {/* Rotation list */}
            <div style={{ 
              display: "flex", 
              flexDirection: "column", 
              gap: "0.6rem", 
              maxHeight: "350px", 
              overflowY: "auto",
              paddingRight: "0.5rem"
            }}>
              {(() => {
                const currentWeekNum = getWeekNum(data.startDate);
                const dsaStartWeek = data.dsaStartWeek || 1;
                const activeIndex = ((currentWeekNum - dsaStartWeek) % DSA_PATTERN_WEEKS.length + DSA_PATTERN_WEEKS.length) % DSA_PATTERN_WEEKS.length;

                return DSA_PATTERN_WEEKS.map((patternItem, idx) => {
                  const isActive = idx === activeIndex;

                  return (
                    <div 
                      key={patternItem.pattern}
                      onClick={() => {
                        const newDsaStartWeek = currentWeekNum - idx;
                        const currentPattern = DSA_PATTERN_WEEKS[idx];
                        
                        // Update existing auto-revision items to match the newly selected pattern immediately
                        const updatedRevisionItems = { ...(data.dailyRevisionItems || {}) };
                        Object.keys(updatedRevisionItems).forEach((dayKey) => {
                          updatedRevisionItems[dayKey] = (updatedRevisionItems[dayKey] || []).map((item: any) => {
                            if (item.id === "dsa_auto") {
                              return {
                                ...item,
                                title: currentPattern.pattern,
                                description: currentPattern.problems
                              };
                            }
                            return item;
                          });
                        });

                        const newData = {
                          ...data,
                          dsaStartWeek: newDsaStartWeek,
                          dailyRevisionItems: updatedRevisionItems
                        };
                        setData(newData);
                        saveDailyChanges(newData);
                      }}
                      onMouseOver={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.05)";
                        }
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                        padding: "0.75rem 1rem",
                        borderRadius: "6px",
                        background: isActive ? "rgba(14, 165, 233, 0.08)" : "rgba(255, 255, 255, 0.02)",
                        border: isActive ? "1px solid var(--accent)" : "1px solid rgba(255, 255, 255, 0.05)",
                        boxShadow: isActive ? "0 0 10px rgba(14, 165, 233, 0.1)" : "none",
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ 
                          fontSize: "0.8rem", 
                          fontWeight: 700, 
                          color: isActive ? "#fff" : "#a1a1aa" 
                        }}>
                          Week {idx + 1}: {patternItem.pattern}
                        </span>
                        {isActive && (
                          <span style={{ 
                            fontSize: "0.65rem", 
                            background: "var(--accent)", 
                            color: "#000", 
                            padding: "0.05rem 0.35rem", 
                            borderRadius: "3px",
                            fontWeight: 700,
                            textTransform: "uppercase"
                          }}>
                            Active Week
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "0.75rem", color: isActive ? "#e4e4e7" : "#71717a", lineHeight: 1.4 }}>
                        Problems: {patternItem.problems}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Links and Actions */}
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              borderTop: "1px solid rgba(255, 255, 255, 0.05)",
              paddingTop: "1rem",
              marginTop: "0.5rem"
            }}>
              <a 
                href="/dsa" 
                onClick={() => setShowRotationModal(false)}
                className="btn"
                style={{ 
                  padding: "0.5rem 1rem", 
                  fontSize: "0.8rem",
                  textDecoration: "none",
                  display: "inline-block"
                }}
              >
                Go to DSA Page
              </a>
              <button 
                onClick={() => setShowRotationModal(false)} 
                className="btn" 
                style={{ 
                  padding: "0.5rem 1rem", 
                  fontSize: "0.8rem",
                  background: "transparent",
                  color: "#a1a1aa",
                  border: "1px solid rgba(255, 255, 255, 0.1)"
                }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}
