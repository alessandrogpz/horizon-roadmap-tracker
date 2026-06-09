"use client";

import React, { useEffect, useState, useRef } from "react";
import { fetchAppState, updateAppState, openLinkOnSystem, syncWorkspace, fetchReflection, saveReflection } from "@/lib/api";
import StreakGraph from "@/components/StreakGraph";
import PhaseTracker from "@/components/PhaseTracker";
import PortfolioTracker from "@/components/PortfolioTracker";
import MaterialsTracker from "@/components/MaterialsTracker";
import PhaseDetailModal from "@/components/PhaseDetailModal";

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
  { name: "Tue", type: "leetcode", label: "DSA" },
  { name: "Wed", type: "math", label: "Math" },
  { name: "Thu", type: "implementation", label: "Impl" },
  { name: "Fri", type: "math", label: "Math" },
  { name: "Sat", type: "leetcode", label: "DSA" },
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
          const updatedData = {
            ...loadedData,
            phases: resetPhases,
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
      case 5: // Friday
        return {
          title: "Revision of the day: Mathematics",
          type: "math",
        };
      case 2: // Tuesday
      case 6: // Saturday
        return {
          title: "Revision of the day: LeetCode (DSA)",
          type: "leetcode",
        };
      case 4: // Thursday
        return {
          title: "Revision of the day: Custom Data Structure Implementation",
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
    if (!isCurrentlyChecked) {
      newStreakHistory.push(todayStr);
    } else {
      const index = newStreakHistory.indexOf(todayStr);
      if (index > -1) {
        newStreakHistory.splice(index, 1);
      }
    }

    const newData = {
      ...data,
      lastDailyRoutineCheck: nextCheckState,
      streakHistory: newStreakHistory,
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
    if (newStatus === "Completed" && !newStreakHistory.includes(todayStr)) {
      newStreakHistory.push(todayStr);
    }

    const newData = { ...data, materials: updatedMaterials, streakHistory: newStreakHistory };
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
    if (isNowCompleted) {
      newStreakHistory.push(todayStr);
    } else {
      const index = newStreakHistory.indexOf(todayStr);
      if (index > -1) {
        newStreakHistory.splice(index, 1);
      }
    }

    const newData = {
      ...data,
      portfolio: updatedPortfolio,
      streakHistory: newStreakHistory,
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
    if (taskCompletedState) {
      newStreakHistory.push(todayStr);
    } else {
      const index = newStreakHistory.indexOf(todayStr);
      if (index > -1) {
        newStreakHistory.splice(index, 1);
      }
    }

    const newData = {
      ...data,
      phases: updatedPhases,
      streakHistory: newStreakHistory,
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
            <button
              onClick={handleSyncWorkspace}
              disabled={syncStatus === "syncing"}
              className="btn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                borderColor: syncStatus === "success" ? "var(--success)" : syncStatus === "error" ? "var(--warning)" : "var(--accent)",
                color: syncStatus === "success" ? "var(--success)" : syncStatus === "error" ? "var(--warning)" : "#fff",
                background: syncStatus === "success" ? "rgba(16, 185, 129, 0.05)" : syncStatus === "error" ? "rgba(245, 158, 11, 0.05)" : "transparent",
                fontSize: "0.8rem",
                padding: "0 1rem",
                height: "38px",
                borderRadius: "6px",
                whiteSpace: "nowrap",
                fontWeight: 600,
                letterSpacing: "0.02em"
              }}
            >
              {syncStatus === "syncing" && (
                <>
                  <span className="animate-spin">↻</span>
                  <span>Syncing...</span>
                </>
              )}
              {syncStatus === "success" && "Synced ✓"}
              {syncStatus === "error" && (
                <span title={syncError} style={{ cursor: "help" }}>
                  Sync Error ⚠
                </span>
              )}
              {syncStatus === "idle" && "Sync Workspace"}
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

        {/* Daily Revision & Reflection Panels */}
        {routineTask.type === "reflection" ? (
          /* Sunday Weekly Reflection Panel */
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
                  const typeColors: Record<string, string> = {
                    math: "var(--accent)",
                    leetcode: "#f59e0b",
                    implementation: "#d946ef",
                    reflection: "#10b981"
                  };
                  const color = typeColors[dayItem.type] || "#fff";
                  
                  return (
                    <div 
                      key={dayItem.name} 
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        padding: "0.4rem 0.2rem",
                        borderRadius: "6px",
                        background: isToday ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.15)",
                        border: isToday ? `1px solid ${color}` : "1px solid rgba(255, 255, 255, 0.05)",
                        boxShadow: isToday ? `0 0 8px ${color}33` : "none",
                        transition: "all 0.2s ease"
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
                      <span style={{ 
                        fontSize: "0.55rem", 
                        fontWeight: 600, 
                        color: isToday ? color : "#52525b",
                        marginTop: "0.15rem",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        width: "100%"
                      }}>
                        {dayItem.label}
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
        ) : (
          /* Weekdays Daily Revision and Daily Reflection Panels */
          <>
            {/* Daily Revision Panel */}
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
                    const typeColors: Record<string, string> = {
                      math: "var(--accent)",
                      leetcode: "#f59e0b",
                      implementation: "#d946ef",
                      reflection: "#10b981"
                    };
                    const color = typeColors[dayItem.type] || "#fff";
                    
                    return (
                      <div 
                        key={dayItem.name} 
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          padding: "0.4rem 0.2rem",
                          borderRadius: "6px",
                          background: isToday ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.15)",
                          border: isToday ? `1px solid ${color}` : "1px solid rgba(255, 255, 255, 0.05)",
                          boxShadow: isToday ? `0 0 8px ${color}33` : "none",
                          transition: "all 0.2s ease"
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
                        <span style={{ 
                          fontSize: "0.55rem", 
                          fontWeight: 600, 
                          color: isToday ? color : "#52525b",
                          marginTop: "0.15rem",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          width: "100%"
                        }}>
                          {dayItem.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem", width: "100%" }}>
                  <input
                    type="checkbox"
                    className="checkbox-custom"
                    checked={isRoutineChecked}
                    onChange={handleRoutineToggle}
                  />
                  <div 
                    onClick={() => setDailyExpanded(!dailyExpanded)}
                    style={{ 
                      flex: 1, 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between", 
                      cursor: "pointer",
                      userSelect: "none"
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", flex: 1 }}>
                      <span style={{ 
                        fontWeight: 600, 
                        fontSize: "1.05rem", 
                        color: isRoutineChecked ? "#71717a" : "#fff",
                        textDecoration: isRoutineChecked ? "line-through" : "none",
                        transition: "all 0.2s ease"
                      }}>
                        {routineTask.title}
                      </span>
                      {data && data.dailyFocus?.[routineTask.type] && (
                        <span style={{ 
                          fontSize: "0.8rem", 
                          color: isRoutineChecked ? "#52525b" : "#a1a1aa",
                          fontStyle: "italic",
                          transition: "all 0.2s ease"
                        }}>
                          ↳ Next Focus: {data.dailyFocus[routineTask.type]}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.75rem", background: "rgba(14,165,233,0.15)", color: "var(--accent)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>
                        Daily
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
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {/* Custom focus/target input */}
                      <div style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "0.5rem", 
                        marginBottom: "0.75rem", 
                        paddingBottom: "0.75rem", 
                        borderBottom: "1px solid var(--card-border)" 
                      }}>
                        <span style={{ fontSize: "0.7rem", color: "var(--accent)", fontWeight: "bold", fontFamily: "monospace", letterSpacing: "0.05em" }}>TARGET / NEXT FOCUS:</span>
                        <input
                          type="text"
                          value={data.dailyFocus?.[routineTask.type] || ""}
                          onChange={(e) => {
                            const updatedFocus = {
                              ...(data.dailyFocus || {}),
                              [routineTask.type]: e.target.value
                            };
                            const newData = { ...data, dailyFocus: updatedFocus };
                            setData(newData);
                            saveDailyChanges(newData);
                          }}
                          onBlur={async () => {
                            if (dailySaveTimeoutRef.current) {
                              clearTimeout(dailySaveTimeoutRef.current);
                            }
                            try {
                              await updateAppState(data);
                            } catch (err) {
                              console.error("Failed to save daily focus", err);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          placeholder={`Specify what to focus on or improve in the next session...`}
                          style={{ 
                            flex: 1, 
                            background: "transparent", 
                            border: "none", 
                            borderBottom: "1px dashed var(--card-border)", 
                            color: "#fff", 
                            fontFamily: "inherit", 
                            fontSize: "0.85rem", 
                            outline: "none",
                            padding: "0.1rem 0",
                            cursor: "text",
                            position: "relative",
                            zIndex: 10
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
                        <strong style={{ color: "var(--accent)", fontSize: "0.75rem", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                          {routineTask.type === "math" 
                            ? "MATH STUDY POINTS & REMINDERS:" 
                            : routineTask.type === "leetcode" 
                            ? "LEETCODE STUDY POINTS & REMINDERS:" 
                            : routineTask.type === "implementation" 
                            ? "IMPLEMENTATION STUDY POINTS & REMINDERS:" 
                            : "WEEKLY REVIEW POINTS:"}
                        </strong>
                        <textarea
                          value={data.dailyStudyPoints?.[routineTask.type] || ""}
                          onChange={(e) => {
                            const updatedPoints = {
                              ...(data.dailyStudyPoints || {}),
                              [routineTask.type]: e.target.value
                            };
                            const newData = { ...data, dailyStudyPoints: updatedPoints };
                            setData(newData);
                            saveDailyChanges(newData);
                          }}
                          onBlur={async () => {
                            if (dailySaveTimeoutRef.current) {
                              clearTimeout(dailySaveTimeoutRef.current);
                            }
                            try {
                              await updateAppState(data);
                            } catch (err) {
                              console.error("Failed to save daily study points", err);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          placeholder="List things to improve, study, or review in the next session (one per line)..."
                          rows={6}
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
                  </div>
                )}
              </div>
            </div>

            {/* Daily Reflection Panel */}
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
          </>
        )}

        {/* Today's Focus Panel */}
        <div className="glass-panel">
          <h2 className="section-title">Today's Focus</h2>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {currentPhaseData && currentPhaseData.tasks.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {currentPhaseData.tasks.map((task: any, idx: number) => (
                  <div 
                    key={task.id} 
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "1rem", 
                      padding: "0.75rem 0",
                      borderBottom: idx === currentPhaseData.tasks.length - 1 ? "none" : "1px solid var(--card-border)"
                    }}
                  >
                    <input
                      type="checkbox"
                      className="checkbox-custom"
                      checked={task.completed}
                      onChange={() => handleTaskToggle(data.currentPhase, task.id)}
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
                ))}
              </div>
            ) : (
              <p style={{ color: "#a1a1aa", fontSize: "0.9rem", padding: "0.5rem 0" }}>No phase tasks today.</p>
            )}
          </div>
        </div>

        {/* Phase Tracker */}
        <PhaseTracker phases={data.phases} currentPhase={data.currentPhase} onPhaseClick={setSelectedPhase} />

        {/* Streak Graph */}
        <StreakGraph streakHistory={data.streakHistory} />
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
    </main>
  );
}
