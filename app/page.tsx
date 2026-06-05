"use client";

import React, { useEffect, useState } from "react";
import { fetchAppState, updateAppState, openLinkOnSystem, syncWorkspace } from "@/lib/api";
import StreakGraph from "@/components/StreakGraph";
import PhaseTracker from "@/components/PhaseTracker";
import PortfolioTracker from "@/components/PortfolioTracker";
import MaterialsTracker from "@/components/MaterialsTracker";
import PhaseDetailModal from "@/components/PhaseDetailModal";

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [todayStr, setTodayStr] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(0);
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
    setTodayStr(`${year}-${month}-${day}`);
    setDayOfWeek(today.getDay());

    fetchAppState()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Determine dynamic daily routine task based on day of week
  const getDailyRoutineTask = () => {
    switch (dayOfWeek) {
      case 1: // Monday
      case 3: // Wednesday
      case 5: // Friday
        return {
          title: "Revision of the day: Linear Algebra",
          type: "math",
        };
      case 2: // Tuesday
      case 4: // Thursday
      case 0: // Sunday
        return {
          title: "Revision of the day: Algorithms & Data Structures",
          type: "dsa",
        };
      case 6: // Saturday
      default:
        return {
          title: "Revision of the day: Weekly Review",
          type: "review",
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

    const newData = { ...data, currentPhase: newPhaseId };
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
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <p>Loading your engine dev workspace...</p>
      </div>
    );
  }

  if (!data) {
    return <div>Failed to load data.</div>;
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
            <p style={{ color: "#a1a1aa", fontSize: "0.85rem", margin: 0 }}>12-Month Graphics Programming Tracker</p>
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

            <div 
              className="glass-panel" 
              style={{ 
                padding: "0 1rem", 
                display: "flex", 
                alignItems: "center", 
                gap: "1rem", 
                minWidth: "220px", 
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

        {/* Daily Revision Panel */}
        <div className="glass-panel" style={{ borderLeft: "4px solid var(--accent)", padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", width: "100%" }}>
            <input
              type="checkbox"
              className="checkbox-custom"
              checked={isRoutineChecked}
              onChange={handleRoutineToggle}
            />
            <span style={{ 
              fontWeight: 600, 
              fontSize: "1.05rem", 
              color: isRoutineChecked ? "#71717a" : "#fff",
              textDecoration: isRoutineChecked ? "line-through" : "none",
              flex: 1,
              transition: "all 0.2s ease"
            }}>
              {routineTask.title}
            </span>
            <span style={{ fontSize: "0.75rem", background: "rgba(14,165,233,0.15)", color: "var(--accent)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>
              Daily
            </span>
          </div>
        </div>

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
