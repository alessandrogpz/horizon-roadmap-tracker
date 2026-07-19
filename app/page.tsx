"use client";

import React, { useEffect, useState, useRef } from "react";
import { fetchAppState, updateAppState, openLinkOnSystem } from "@/lib/api";
import {
  isGoogleAuthenticated,
  getGoogleClientId,
  authenticateGoogleDrive,
  syncWithGoogleDrive,
  setGoogleClientId,
  loadGoogleGisScript
} from "@/lib/googleDrive";
import type { AppState, Material, Phase, WeekDay } from "@/lib/types";
import { todayYMD, daysSince } from "@/lib/dates";
import { applyDailyResetIfNeeded } from "@/lib/dailyReset";
import { addCompletion, removeCompletion } from "@/lib/streak";
import StreakGraph from "@/components/StreakGraph";
import PhaseTracker from "@/components/PhaseTracker";
import PortfolioTracker from "@/components/PortfolioTracker";
import MaterialsTracker from "@/components/MaterialsTracker";
import PhaseDetailModal from "@/components/PhaseDetailModal";
import ScheduleDayModal from "@/components/ScheduleDayModal";
import PomodoroTimer from "@/components/PomodoroTimer";
import DashboardHeader, { type SyncStatus } from "@/components/DashboardHeader";
import WeeklyPlan from "@/components/WeeklyPlan";
import RotationModal from "@/components/RotationModal";

export default function Home() {
  const [data, setData] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState("");
  const [todayStr, setTodayStr] = useState("");
  const dailySaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveDailyChanges = (newData: AppState) => {
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

  /** Optimistic UI update + debounced persistence, used by the weekly plan and modals. */
  const applyChange = (newData: AppState) => {
    setData(newData);
    saveDailyChanges(newData);
  };

  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<WeekDay | null>(null);
  const [showRotationModal, setShowRotationModal] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState("");
  const [, setSyncTick] = useState(0);

  // Re-render periodically so the "Last Sync" relative time stays fresh
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

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
      let clientId = getGoogleClientId();
      if (!isGoogleAuthenticated()) {
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

      let res = await syncWithGoogleDrive();
      if (!res.success && res.authRequired && clientId) {
        // Token expired or was revoked mid-session: re-authenticate and retry once
        await authenticateGoogleDrive(clientId);
        res = await syncWithGoogleDrive();
      }
      if (res.success) {
        setSyncStatus("success");
        setTimeout(() => setSyncStatus("idle"), 3000);
        // Refresh local UI state and assert isSynced flag is true
        const loadedData = await fetchAppState();
        setData(loadedData);
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

    const currentTodayStr = todayYMD();
    setTodayStr(currentTodayStr);
    setDayOfWeek(new Date().getDay());

    fetchAppState()
      .then(async (loadedData) => {
        const { data: finalData, changed } = applyDailyResetIfNeeded(loadedData, currentTodayStr);
        setData(finalData);
        if (changed) {
          try {
            await updateAppState({ ...finalData, isReset: true });
          } catch (err) {
            console.error("Failed to auto-reset daily tasks on date change:", err);
          }
        }
      })
      .catch((err: any) => {
        console.error("Initialization fetch error:", err);
        setInitError(err.message || String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = async (newData: AppState, context: string) => {
    setData(newData);
    try {
      await updateAppState(newData);
    } catch (err) {
      console.error(`Failed to sync ${context}`, err);
    }
  };

  const handleMaterialChange = async (materialId: string, newStatus: string) => {
    if (!data) return;

    const updatedMaterials = data.materials.map((m) => {
      if (m.id !== materialId) return m;
      return { ...m, status: newStatus };
    });

    const matTitle = data.materials.find((m) => m.id === materialId)?.title || "Study Material";
    const oldStatus = data.materials.find((m) => m.id === materialId)?.status;

    let streakFields = { streakHistory: data.streakHistory || [], completedItemsHistory: data.completedItemsHistory || {} };
    if (newStatus === "Completed" && oldStatus !== "Completed") {
      streakFields = addCompletion(data, todayStr, matTitle);
    } else if (newStatus !== "Completed" && oldStatus === "Completed") {
      streakFields = removeCompletion(data, todayStr, matTitle);
    }

    await persist({ ...data, materials: updatedMaterials, ...streakFields }, "material status");
  };

  const handleMaterialProgressChange = async (materialId: string, fields: Partial<Material>) => {
    if (!data) return;

    const updatedMaterials = data.materials.map((m) => {
      if (m.id !== materialId) return m;
      return { ...m, ...fields };
    });

    await persist({ ...data, materials: updatedMaterials }, "material progress");
  };

  const handleAddMaterial = async (newMaterial: Omit<Material, "id">) => {
    if (!data) return;

    const materialWithId = { id: `m_${Date.now()}`, ...newMaterial };
    await persist({ ...data, materials: [...(data.materials || []), materialWithId] }, "material add");
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!data) return;

    await persist({ ...data, materials: data.materials.filter((m) => m.id !== materialId) }, "material delete");
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
    const updatedPortfolio = data.portfolio.map((p) => {
      if (p.id !== projectId) return p;
      isNowCompleted = !p.completed;
      return { ...p, completed: !p.completed };
    });

    const projTitle = data.portfolio.find((p) => p.id === projectId)?.title || "Portfolio Project";
    const streakFields = isNowCompleted
      ? addCompletion(data, todayStr, projTitle)
      : removeCompletion(data, todayStr, projTitle);

    await persist({ ...data, portfolio: updatedPortfolio, ...streakFields }, "portfolio toggle");
  };

  const handlePhaseChange = async (newPhaseId: number) => {
    if (!data) return;

    await persist({ ...data, currentPhase: newPhaseId, currentPhaseStartDate: todayYMD() }, "phase change");
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

  const daysPassed = data.startDate && data.isSynced ? daysSince(data.startDate) : 0;
  const recommendedPhase = daysPassed <= 90 ? 1 : daysPassed <= 210 ? 2 : daysPassed <= 300 ? 3 : 4;

  return (
    <main className="container">
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <DashboardHeader
          data={data}
          syncStatus={syncStatus}
          syncError={syncError}
          onSync={handleSyncWorkspace}
        />

        {/* Phase recommendation alert */}
        {data.currentPhase !== recommendedPhase && (
          <div className="glass-panel" style={{ borderLeft: "4px solid #f59e0b", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem" }}>
            <span style={{ fontSize: "0.9rem", color: "#f3f4f6" }}>
              Schedule suggestion: Time to transition to Phase {recommendedPhase} (Day {daysPassed})
            </span>
            <button
              onClick={() => handlePhaseChange(recommendedPhase)}
              className="btn"
              style={{ padding: "0.25rem 0.75rem", fontSize: "0.85rem", background: "#d97706" }}
            >
              Switch Now
            </button>
          </div>
        )}

        <WeeklyPlan
          data={data}
          todayStr={todayStr}
          dayOfWeek={dayOfWeek}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          onDayClick={setSelectedScheduleDay}
          onRotationClick={() => setShowRotationModal(true)}
          applyChange={applyChange}
        />

        <PhaseTracker phases={data.phases} currentPhase={data.currentPhase} onPhaseClick={setSelectedPhase} />

        <StreakGraph
          streakHistory={data.streakHistory}
          completedItemsHistory={data.completedItemsHistory || {}}
          startDate={data.startDate}
        />

        <PomodoroTimer />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <PortfolioTracker portfolio={data.portfolio} onToggle={handlePortfolioToggle} />

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
        <RotationModal
          data={data}
          onClose={() => setShowRotationModal(false)}
          applyChange={applyChange}
        />
      )}
    </main>
  );
}
