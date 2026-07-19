"use client";

import React, { useEffect, useState, useRef } from "react";
import { fetchAppState, updateAppState, openLinkOnSystem } from "@/lib/api";
import {
  isGoogleAuthenticated,
  getGoogleClientId,
  authenticateGoogleDrive,
  syncWithGoogleDrive,
  setGoogleClientId,
  clearGoogleAccessToken,
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
import DriveConnectModal, { type DriveModalMode } from "@/components/DriveConnectModal";
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
  const [driveModalMode, setDriveModalMode] = useState<DriveModalMode | null>(null);
  const [, setSyncTick] = useState(0);

  // Re-render periodically so the "Last Sync" relative time stays fresh
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const runSync = async (clientId: string) => {
    setSyncStatus("syncing");
    setSyncError("");
    try {
      if (!isGoogleAuthenticated()) {
        await authenticateGoogleDrive(clientId);
      }

      let res = await syncWithGoogleDrive();
      if (!res.success && res.authRequired) {
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
    } catch (err) {
      console.error("Workspace sync failed:", err);
      setSyncStatus("error");
      setSyncError(err instanceof Error ? err.message : "Failed to sync workspace");
      setTimeout(() => setSyncStatus("idle"), 5000);
    }
  };

  const handleSyncWorkspace = (e: React.MouseEvent) => {
    // Shift click opens connection management (disconnect)
    if (e.shiftKey) {
      setDriveModalMode("manage");
      return;
    }
    if (syncStatus === "syncing") return;

    const clientId = getGoogleClientId();
    if (!clientId) {
      setDriveModalMode("connect");
      return;
    }
    runSync(clientId);
  };

  const handleDriveConnect = (clientId: string) => {
    setGoogleClientId(clientId);
    setDriveModalMode(null);
    runSync(clientId);
  };

  const handleDriveDisconnect = () => {
    localStorage.removeItem("google_drive_client_id");
    clearGoogleAccessToken();
    setDriveModalMode(null);
  };

  useEffect(() => {
    // Client-only initialization and service worker registration for PWA
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(
        (reg) => console.log("SW registered:", reg.scope),
        (err) => console.error("SW registration failed:", err)
      );
    }

    // Pre-load Google GIS script to prevent popup blocker issues
    loadGoogleGisScript().catch(err => console.error("Failed to preload Google GIS:", err));

    const currentTodayStr = todayYMD();

    fetchAppState()
      .then(async (loadedData) => {
        setTodayStr(currentTodayStr);
        setDayOfWeek(new Date().getDay());
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
      .catch((err: unknown) => {
        console.error("Initialization fetch error:", err);
        setInitError(err instanceof Error ? err.message : String(err));
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
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <span className="animate-spin text-[2rem]">↻</span>
        <p>Loading your engine dev workspace...</p>
      </div>
    );
  }

  if (initError || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-8 bg-background text-foreground font-mono text-center">
        <h2 className="text-warning mb-4 uppercase tracking-[0.05em] text-2xl font-bold">Initialization Failed</h2>
        <p className="text-zinc-400 text-[0.9rem] mb-6">
          The app failed to connect to the backend server.
        </p>
        <div className="p-4 bg-card rounded-md border border-card-border text-red-400 mb-6 max-w-[500px] break-all">
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
      <div className="flex flex-col gap-8">
        <DashboardHeader
          data={data}
          syncStatus={syncStatus}
          syncError={syncError}
          onSync={handleSyncWorkspace}
        />

        {/* Phase recommendation alert */}
        {data.currentPhase !== recommendedPhase && (
          <div className="glass-panel border-l-4 !border-l-warning flex justify-between items-center px-6 py-4">
            <span className="text-[0.9rem] text-gray-100">
              Schedule suggestion: Time to transition to Phase {recommendedPhase} (Day {daysPassed})
            </span>
            <button
              onClick={() => handlePhaseChange(recommendedPhase)}
              className="btn px-3 py-1 text-[0.85rem] !bg-amber-600"
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

      <div className="flex flex-col gap-8">
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
      {driveModalMode && (
        <DriveConnectModal
          mode={driveModalMode}
          initialClientId={getGoogleClientId()}
          isAuthenticated={isGoogleAuthenticated()}
          onConnect={handleDriveConnect}
          onDisconnect={handleDriveDisconnect}
          onClose={() => setDriveModalMode(null)}
        />
      )}
    </main>
  );
}
