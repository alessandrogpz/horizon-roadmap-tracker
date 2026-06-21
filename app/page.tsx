"use client";

import React, { useEffect, useState, useRef } from "react";
import { fetchAppState, updateAppState, openLinkOnSystem, syncWorkspace, fetchReflection, saveReflection } from "@/lib/api";
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

const WEEK_SCHEDULE = [
  { name: "Mon", type: "math", label: "Math" },
  { name: "Tue", type: "leetcode", label: "DSA/DOD" },
  { name: "Wed", type: "math", label: "Math" },
  { name: "Thu", type: "implementation", label: "Impl" },
  { name: "Fri", type: "leetcode", label: "DSA/DOD" },
  { name: "Sat", type: "leetcode", label: "DSA/DOD" },
  { name: "Sun", type: "reflection", label: "Ref" }
];

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState("");
  const [dailyExpanded, setDailyExpanded] = useState(false);
  const [todayStr, setTodayStr] = useState("");
  const [reflectionText, setReflectionText] = useState("");
  const [dailyReflectionText, setDailyReflectionText] = useState("");
  const dailySaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reflectionSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dailyReflectionSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const saveReflectionChanges = (text: string) => {
    if (reflectionSaveTimeoutRef.current) {
      clearTimeout(reflectionSaveTimeoutRef.current);
    }
    reflectionSaveTimeoutRef.current = setTimeout(() => {
      handleSaveReflection(text);
    }, 1000);
  };

  const handleSaveReflection = async (text: string) => {
    if (!data) return;
    const weekNum = getWeekNum(data.startDate);

    try {
      await saveReflection(weekNum, todayStr, text, 'Weekly');
    } catch (err) {
      console.error("Failed to save weekly reflection:", err);
    }
  };

  const saveDailyReflectionChanges = (text: string) => {
    if (dailyReflectionSaveTimeoutRef.current) {
      clearTimeout(dailyReflectionSaveTimeoutRef.current);
    }
    dailyReflectionSaveTimeoutRef.current = setTimeout(() => {
      handleSaveDailyReflection(text);
    }, 1000);
  };

  const handleSaveDailyReflection = async (text: string) => {
    if (!data) return;
    const weekNum = getWeekNum(data.startDate);
    const today = new Date();

    const DAYS_MAP = ["Weekly", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = DAYS_MAP[today.getDay()];

    try {
      await saveReflection(weekNum, todayStr, text, currentDayName);
    } catch (err) {
      console.error("Failed to save daily reflection:", err);
    }
  };

  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [reflectionExpanded, setReflectionExpanded] = useState(false);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<any>(null);
  const [selectedPhase, setSelectedPhase] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncError, setSyncError] = useState("");

  const handleSyncWorkspace = async () => {
    setSyncStatus("syncing");
    setSyncError("");
    try {
      const res = await syncWorkspace();
      if (res.success) {
        setSyncStatus("success");
        setTimeout(() => setSyncStatus("idle"), 3000);
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
    // Client-only initialization
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
        if (loadedData && loadedData.lastTasksResetDate !== currentTodayStr) {
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

        // Load reflections for the current week (both weekly and daily)
        if (finalData.startDate) {
          const wNum = getWeekNum(finalData.startDate, today);
          
          try {
            const refData = await fetchReflection(wNum);
            setReflectionText(refData.weekly || "");
            
            const DAYS_MAP = ["Weekly", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const currentDayName = DAYS_MAP[today.getDay()];
            if (currentDayName !== "Weekly") {
              setDailyReflectionText(refData.days?.[currentDayName] || "");
            }
          } catch (err) {
            console.error("Failed to load reflections:", err);
          }
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
      case 5: // Friday
      case 6: // Saturday
        return {
          title: "Today's Focus: LeetCode & DOD (Data Oriented Design)",
          type: "leetcode",
        };
      case 4: // Thursday
        return {
          title: "Today's Focus: Custom Data Structure Implementation",
          type: "implementation",
        };
      case 0: // Sunday
      default:
        return {
          title: "Weekly Reflection",
          type: "reflection",
        };
    }
  };



  const getDaysPassed = () => {
    if (!data || !data.startDate) return 0;
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
    if (!data) return 0;
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
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "nowrap", flex: "0 1 auto" }}>
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

        {/* Weekly Reflection Panel (Only on Sunday) */}
        {routineTask.type === "reflection" && (
          <div className="glass-panel" style={{ borderLeft: "4px solid var(--accent)", padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {/* Weekly Schedule Overview */}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))", 
                gap: "0.4rem", 
                width: "100%", 
                marginBottom: "0.5rem", 
                paddingBottom: "0.75rem", 
                borderBottom: "1px solid var(--card-border)" 
              }}>
                {WEEK_SCHEDULE.map((dayItem, idx) => {
                  const isToday = idx === (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
                  const color = "var(--accent)";
                  
                  return (
                    <div 
                      key={dayItem.name} 
                      onClick={() => setSelectedScheduleDay(dayItem)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        padding: "0.4rem 0.2rem",
                        borderRadius: "6px",
                        background: isToday ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.15)",
                        border: isToday ? `1px solid ${color}` : "1px solid rgba(255, 255, 255, 0.05)",
                        boxShadow: isToday ? `0 0 8px ${color}33` : "none",
                        transition: "all 0.2s ease",
                        cursor: "pointer"
                      }}
                    >
                      <span style={{ 
                        fontSize: "0.7rem", 
                        fontWeight: isToday ? 700 : 500, 
                        color: isToday ? "#fff" : "#71717a",
                        textTransform: "uppercase",
                        letterSpacing: "0.02em"
                      }}>
                        {dayItem.name}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div 
                onClick={() => setDailyExpanded(!dailyExpanded)}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between", 
                  cursor: "pointer",
                  userSelect: "none",
                  width: "100%"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", flex: 1 }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fff", margin: 0 }}>
                    Weekly Reflection (Week {getWeekNum(data.startDate)})
                  </h3>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", background: "rgba(14,165,233,0.15)", color: "var(--accent)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>
                    Weekly
                  </span>
                  <span style={{ 
                    fontSize: "0.8rem", 
                    color: "#71717a", 
                    transform: dailyExpanded ? "rotate(180deg)" : "rotate(0deg)", 
                    transition: "transform 0.2s ease" 
                  }}>
                    ▼
                  </span>
                </div>
              </div>
              
              {dailyExpanded && (
                <div style={{ 
                  marginTop: "0.5rem", 
                  padding: "1rem", 
                  background: "rgba(0, 0, 0, 0.2)", 
                  borderRadius: "6px", 
                  border: "1px solid var(--card-border)",
                  fontSize: "0.85rem",
                  lineHeight: "1.5",
                  color: "#a1a1aa"
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <strong style={{ color: "var(--accent)", fontSize: "0.75rem", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                      WEEKLY REFLECTION:
                    </strong>
                    <textarea
                      value={reflectionText}
                      onChange={(e) => {
                        setReflectionText(e.target.value);
                        saveReflectionChanges(e.target.value);
                      }}
                      onBlur={() => {
                        if (reflectionSaveTimeoutRef.current) {
                          clearTimeout(reflectionSaveTimeoutRef.current);
                        }
                        handleSaveReflection(reflectionText);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      placeholder="Reflect on the week that has passed and outline the plans/goals for the upcoming week..."
                      rows={10}
                      style={{
                        width: "100%",
                        background: "rgba(0, 0, 0, 0.25)",
                        border: "1px solid var(--card-border)",
                        borderRadius: "6px",
                        padding: "0.75rem",
                        color: "#e4e4e7",
                        fontFamily: "inherit",
                        fontSize: "0.85rem",
                        lineHeight: "1.6",
                        resize: "vertical",
                        outline: "none"
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Daily Study Panel (Everyday: Mon-Sat and Sun) */}
        <div className="glass-panel" style={{ borderLeft: "4px solid var(--accent)", padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {/* Weekly Schedule Overview (Only on weekdays, since on Sunday it's in the Weekly Reflection card) */}
            {routineTask.type !== "reflection" && (
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))", 
                gap: "0.4rem", 
                width: "100%",
                marginBottom: "0.5rem",
                paddingBottom: "0.75rem",
                borderBottom: "1px solid var(--card-border)"
              }}>
                {WEEK_SCHEDULE.map((dayItem, idx) => {
                  const isToday = idx === (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
                  const color = "var(--accent)";
                  
                  return (
                    <div 
                      key={dayItem.name} 
                      onClick={() => setSelectedScheduleDay(dayItem)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        padding: "0.4rem 0.2rem",
                        borderRadius: "6px",
                        background: isToday ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.15)",
                        border: isToday ? `1px solid ${color}` : "1px solid rgba(255, 255, 255, 0.05)",
                        boxShadow: isToday ? `0 0 8px ${color}33` : "none",
                        transition: "all 0.2s ease",
                        cursor: "pointer"
                      }}
                    >
                      <span style={{ 
                        fontSize: "0.7rem", 
                        fontWeight: isToday ? 700 : 500, 
                        color: isToday ? "#fff" : "#71717a",
                        textTransform: "uppercase",
                        letterSpacing: "0.02em"
                      }}>
                        {dayItem.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Card Main Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", userSelect: "none", marginTop: "0.5rem", paddingBottom: "0.5rem", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fff", margin: 0 }}>
                Today's Study (Week {getWeekNum(data.startDate)})
              </h3>
            </div>

            {/* Revision Section */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", marginTop: "0.75rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", userSelect: "none" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--accent)", fontWeight: "bold", fontFamily: "monospace", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Revision
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {(() => {
                  const DAYS_SHORT_MAP = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  const todayKey = DAYS_SHORT_MAP[dayOfWeek];
                  const revisionItems = data?.dailyRevisionItems?.[todayKey] || [];
                  
                  if (revisionItems.length === 0) {
                    return <p style={{ color: "#71717a", fontSize: "0.85rem", fontStyle: "italic", margin: 0 }}>No revision items defined for today. Click a day to plan!</p>;
                  }
                  
                  return revisionItems.map((item: any, index: number) => (
                    <div 
                      key={item.id || index}
                      style={{ 
                        display: "flex", 
                        alignItems: "flex-start", 
                        gap: "1rem",
                        padding: "0.2rem 0"
                      }}
                    >
                      <input
                        type="checkbox"
                        className="checkbox-custom"
                        checked={item.completed}
                        onChange={(e) => {
                          const updatedItems = revisionItems.map((it: any) => {
                            if (it.id === item.id) {
                              return { ...it, completed: e.target.checked };
                            }
                            return it;
                          });
                          
                          // Sync streak history & completed items details
                          let newStreakHistory = [...(data.streakHistory || [])];
                          let newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
                          const todayItems = newCompletedItemsHistory[todayStr] || [];

                          if (e.target.checked) {
                            newStreakHistory.push(todayStr);
                            const alreadyExists = todayItems.some((it: any) => (typeof it === 'string' ? it === item.title : it.title === item.title));
                            if (!alreadyExists) {
                              newCompletedItemsHistory[todayStr] = [...todayItems, { title: item.title, description: item.description || "" }];
                            }
                          } else {
                            const index = newStreakHistory.indexOf(todayStr);
                            if (index > -1) {
                              newStreakHistory.splice(index, 1);
                            }
                            newCompletedItemsHistory[todayStr] = todayItems.filter((it: any) => (typeof it === 'string' ? it !== item.title : it.title !== item.title));
                          }
                          
                          const newData = {
                            ...data,
                            dailyRevisionItems: {
                              ...(data.dailyRevisionItems || {}),
                              [todayKey]: updatedItems
                            },
                            streakHistory: newStreakHistory,
                            completedItemsHistory: newCompletedItemsHistory
                          };
                          setData(newData);
                          saveDailyChanges(newData);
                        }}
                        style={{ marginTop: "0.15rem" }}
                      />
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", flex: 1 }}>
                        <span 
                          style={{ 
                            fontSize: "0.9rem", 
                            fontWeight: 600,
                            color: item.completed ? "#71717a" : "var(--foreground)", 
                            textDecoration: item.completed ? "line-through" : "none",
                            transition: "color 0.2s ease" 
                          }}
                        >
                          {item.title}
                        </span>
                        {item.description && (
                          <span 
                            style={{ 
                              fontSize: "0.8rem", 
                              color: "#71717a",
                              textDecoration: item.completed ? "line-through" : "none"
                            }}
                          >
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Focus Section */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", marginTop: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", userSelect: "none" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--accent)", fontWeight: "bold", fontFamily: "monospace", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Focus
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {(() => {
                  const DAYS_SHORT_MAP = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  const todayKey = DAYS_SHORT_MAP[dayOfWeek];
                  const tasks = data?.dailyTasks?.[todayKey] || [];
                  
                  if (tasks.length === 0) {
                    return <p style={{ color: "#71717a", fontSize: "0.85rem", fontStyle: "italic", margin: 0 }}>No focus items defined for today. Click a day to plan!</p>;
                  }
                  
                  return tasks.map((task: any, index: number) => (
                    <div 
                      key={task.id || index}
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "1rem",
                        padding: "0.2rem 0"
                      }}
                    >
                      <input
                        type="checkbox"
                        className="checkbox-custom"
                        checked={task.completed}
                        onChange={(e) => {
                          const updatedTasks = tasks.map((t: any) => {
                            if (t.id === task.id) {
                              return { ...t, completed: e.target.checked };
                            }
                            return t;
                          });
                          
                          // Sync streak history & completed items details
                          let newStreakHistory = [...(data.streakHistory || [])];
                          let newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
                          const todayItems = newCompletedItemsHistory[todayStr] || [];

                          if (e.target.checked) {
                            newStreakHistory.push(todayStr);
                            const alreadyExists = todayItems.some((it: any) => (typeof it === 'string' ? it === task.title : it.title === task.title));
                            if (!alreadyExists) {
                              newCompletedItemsHistory[todayStr] = [...todayItems, { title: task.title }];
                            }
                          } else {
                            const index = newStreakHistory.indexOf(todayStr);
                            if (index > -1) {
                              newStreakHistory.splice(index, 1);
                            }
                            newCompletedItemsHistory[todayStr] = todayItems.filter((it: any) => (typeof it === 'string' ? it !== task.title : it.title !== task.title));
                          }
                          
                          const newData = {
                            ...data,
                            dailyTasks: {
                              ...(data.dailyTasks || {}),
                              [todayKey]: updatedTasks
                            },
                            streakHistory: newStreakHistory,
                            completedItemsHistory: newCompletedItemsHistory
                          };
                          setData(newData);
                          saveDailyChanges(newData);
                        }}
                      />
                      <span 
                        style={{ 
                          flex: 1, 
                          fontSize: "0.9rem", 
                          color: task.completed ? "#71717a" : "var(--foreground)", 
                          textDecoration: task.completed ? "line-through" : "none",
                          transition: "color 0.2s ease" 
                        }}
                      >
                        {task.title}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Daily Reflection Panel (Only on Weekdays: Mon-Sat) */}
        {routineTask.type !== "reflection" && (
          <div className="glass-panel" style={{ borderLeft: "4px solid var(--accent)", padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div 
                onClick={() => setReflectionExpanded(!reflectionExpanded)}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between", 
                  cursor: "pointer",
                  userSelect: "none",
                  width: "100%"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", flex: 1 }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#fff", margin: 0 }}>
                    Daily Reflection (Optional)
                  </h3>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ 
                    fontSize: "0.8rem", 
                    color: "#71717a", 
                    transform: reflectionExpanded ? "rotate(180deg)" : "rotate(0deg)", 
                    transition: "transform 0.2s ease" 
                  }}>
                    ▼
                  </span>
                </div>
              </div>

              {reflectionExpanded && (
                <div style={{ 
                  marginTop: "0.5rem", 
                  padding: "1rem", 
                  background: "rgba(0, 0, 0, 0.2)", 
                  borderRadius: "6px", 
                  border: "1px solid var(--card-border)",
                  fontSize: "0.85rem",
                  lineHeight: "1.5",
                  color: "#a1a1aa"
                }}>
                  <textarea
                    value={dailyReflectionText}
                    onChange={(e) => {
                      setDailyReflectionText(e.target.value);
                      saveDailyReflectionChanges(e.target.value);
                    }}
                    onBlur={() => {
                      if (dailyReflectionSaveTimeoutRef.current) {
                        clearTimeout(dailyReflectionSaveTimeoutRef.current);
                      }
                      handleSaveDailyReflection(dailyReflectionText);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    placeholder="Reflect on today's progress, focus, or achievements (optional)..."
                    rows={4}
                    style={{
                      width: "100%",
                      background: "rgba(0, 0, 0, 0.25)",
                      border: "1px solid var(--card-border)",
                      borderRadius: "6px",
                      padding: "0.75rem",
                      color: "#e4e4e7",
                      fontFamily: "inherit",
                      fontSize: "0.85rem",
                      lineHeight: "1.6",
                      resize: "vertical",
                      outline: "none"
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}



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
          reflectionText={reflectionText}
          setReflectionText={setReflectionText}
          saveReflectionChanges={saveReflectionChanges}
          onClose={() => setSelectedScheduleDay(null)}
          updateAppState={updateAppState}
        />
      )}
    </main>
  );
}
