"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { LoaderCircle } from "lucide-react";
import { fetchWorkspace, updateWorkspace, openLinkOnSystem, visibleTracks } from "@/lib/api";
import {
  isGoogleAuthenticated,
  getGoogleClientId,
  authenticateGoogleDrive,
  syncWithGoogleDrive,
  setGoogleClientId,
  clearGoogleAccessToken,
  loadGoogleGisScript
} from "@/lib/googleDrive";
import type { FocusType, Material, PanelColumns, Phase, PortfolioProject, TrackState, WeekDay, Workspace } from "@/lib/types";
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
import WeeklyRhythmModal from "@/components/WeeklyRhythmModal";
import SortablePanel from "@/components/SortablePanel";

type PanelColumnId = "left" | "right";

const DEFAULT_PANEL_COLUMNS: PanelColumns = {
  left: ["weeklyPlan", "phaseTracker", "streakGraph", "pomodoroTimer"],
  right: ["portfolioTracker", "materialsTracker"],
};

const findPanelColumn = (columns: PanelColumns, id: string): PanelColumnId | null => {
  if (columns.left.includes(id)) return "left";
  if (columns.right.includes(id)) return "right";
  if (id === "left" || id === "right") return id;
  return null;
};

export default function Home() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const workspaceRef = useRef<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState("");
  const [todayStr, setTodayStr] = useState("");
  const dailySaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  const data: TrackState | null = workspace ? workspace.tracks[workspace.activeTrackId] || null : null;

  const withTrack = (ws: Workspace, trackData: TrackState): Workspace => ({
    ...ws,
    tracks: { ...ws.tracks, [ws.activeTrackId]: trackData },
  });

  const saveDailyChanges = (newTrackData: TrackState) => {
    if (dailySaveTimeoutRef.current) {
      clearTimeout(dailySaveTimeoutRef.current);
    }
    dailySaveTimeoutRef.current = setTimeout(async () => {
      try {
        dailySaveTimeoutRef.current = null;
        const ws = workspaceRef.current;
        if (!ws) return;
        await updateWorkspace(withTrack(ws, newTrackData));
      } catch (err) {
        console.error("Failed to auto-save daily changes", err);
      }
    }, 1000);
  };

  /** Persists workspaceRef.current immediately, bypassing the debounce, so a
   *  checkbox toggle made just before closing the tab or hitting Sync is
   *  never left stranded in the pending timeout — workspaceRef.current
   *  already reflects it via applyChange's synchronous setWorkspace. */
  const flushPendingSave = async () => {
    if (!dailySaveTimeoutRef.current) return;
    clearTimeout(dailySaveTimeoutRef.current);
    dailySaveTimeoutRef.current = null;
    const ws = workspaceRef.current;
    if (!ws) return;
    try {
      await updateWorkspace(ws);
    } catch (err) {
      console.error("Failed to flush pending changes", err);
    }
  };

  // Flush any pending debounced save when the tab is backgrounded or closed,
  // so a checkbox checked right before closing the app isn't silently lost.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushPendingSave();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushPendingSave);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushPendingSave);
    };
  }, []);

  /** Optimistic UI update + debounced persistence, used by the weekly plan and modals. */
  const applyChange = (newTrackData: TrackState) => {
    if (!workspace) return;
    setWorkspace(withTrack(workspace, newTrackData));
    saveDailyChanges(newTrackData);
  };

  /** Optimistic-only UI update (no save), for ScheduleDayModal's setData prop. */
  const setTrackData = (newTrackData: TrackState) => {
    if (!workspace) return;
    setWorkspace(withTrack(workspace, newTrackData));
  };

  /** Immediate (non-debounced) persistence, for ScheduleDayModal's blur-save. */
  const updateTrackState = async (newTrackData: TrackState) => {
    const ws = workspaceRef.current;
    if (!ws) return;
    return updateWorkspace(withTrack(ws, newTrackData));
  };

  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<WeekDay | null>(null);
  // null = closed. { rotationId: null } = create new. { rotationId: "<id>" } = view/edit that one.
  const [rotationModal, setRotationModal] = useState<{ rotationId: string | null } | null>(null);
  const [showRhythmEditor, setShowRhythmEditor] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState("");
  const [driveModalMode, setDriveModalMode] = useState<DriveModalMode | null>(null);

  // The "Last Sync" relative-time label keeps itself fresh via its own interval
  // inside DashboardHeader (LastSyncedLabel), so no dashboard-wide ticker is
  // needed here — that would re-render every panel every 15s.

  // No tracks yet: send the user through the onboarding wizard instead of
  // rendering an empty/placeholder dashboard.
  useEffect(() => {
    if (workspace && visibleTracks(workspace).length === 0) {
      router.replace("/onboarding");
    }
  }, [workspace, router]);

  // Local, draggable copy of the panel order. It mirrors workspace.panelColumns
  // (a dashboard-layout preference shared across tracks) but must also hold
  // ahead-of-persistence state during an active drag gesture, so it's synced
  // from the loaded workspace during render rather than via an effect.
  const [panelColumns, setPanelColumns] = useState<PanelColumns>(DEFAULT_PANEL_COLUMNS);
  const [lastSyncedPanelColumns, setLastSyncedPanelColumns] = useState<PanelColumns | undefined>(undefined);
  if (workspace?.panelColumns && workspace.panelColumns !== lastSyncedPanelColumns) {
    setLastSyncedPanelColumns(workspace.panelColumns);
    setPanelColumns(workspace.panelColumns);
  }

  const panelSensors = useSensors(
    // Mouse: small movement on the handle is enough — desktop users expect
    // an immediate, precise drag start from a dedicated icon.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // Touch: press-and-hold (SortablePanel wires this to the whole panel,
    // not just the handle) — a delay means a quick tap or scroll swipe is
    // never mistaken for a drag.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const persistPanelColumns = async (next: PanelColumns) => {
    const ws = workspaceRef.current;
    if (!ws) return;
    const newWorkspace = { ...ws, panelColumns: next };
    setWorkspace(newWorkspace);
    try {
      await updateWorkspace({ ...newWorkspace, isReset: true });
    } catch (err) {
      console.error("Failed to save panel order", err);
    }
  };

  const handlePanelDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeCol = findPanelColumn(panelColumns, String(active.id));
    const overCol = findPanelColumn(panelColumns, String(over.id));
    if (!activeCol || !overCol || activeCol === overCol) return;

    setPanelColumns((prev) => {
      const activeItems = [...prev[activeCol]];
      const overItems = [...prev[overCol]];
      const activeIndex = activeItems.indexOf(String(active.id));
      if (activeIndex === -1) return prev;
      let overIndex = overItems.indexOf(String(over.id));
      if (overIndex === -1) overIndex = overItems.length;
      activeItems.splice(activeIndex, 1);
      overItems.splice(overIndex, 0, String(active.id));
      return { ...prev, [activeCol]: activeItems, [overCol]: overItems };
    });
  };

  const handlePanelDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeCol = findPanelColumn(panelColumns, String(active.id));
    const overCol = findPanelColumn(panelColumns, String(over.id));
    if (!activeCol) return;

    if (activeCol === overCol && active.id !== over.id) {
      const items = panelColumns[activeCol];
      const oldIndex = items.indexOf(String(active.id));
      const newIndex = items.indexOf(String(over.id));
      const next = { ...panelColumns, [activeCol]: arrayMove(items, oldIndex, newIndex) };
      setPanelColumns(next);
      persistPanelColumns(next);
    } else {
      // Cross-column move was already applied live by handlePanelDragOver — persist as-is.
      persistPanelColumns(panelColumns);
    }
  };

  const runSync = async (clientId: string) => {
    setSyncStatus("syncing");
    setSyncError("");
    try {
      // Make sure any just-made edit (e.g. a checkbox toggled seconds ago)
      // has actually landed in Dexie before syncWithGoogleDrive reads it —
      // otherwise this sync can push a snapshot that's missing the very
      // change the user just made and clicked Sync to send.
      await flushPendingSave();
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
        const loadedWorkspace = await fetchWorkspace();
        setWorkspace(loadedWorkspace);
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

  const handleSyncWorkspace = () => {
    if (syncStatus === "syncing") return;

    const clientId = getGoogleClientId();
    if (!clientId) {
      setDriveModalMode("connect");
      return;
    }
    runSync(clientId);
  };

  const handleOpenCloudMenu = () => setDriveModalMode("manage");

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

  const handleSwitchTrack = async (trackId: string) => {
    if (!workspace || !workspace.tracks[trackId]) return;
    setWorkspace({ ...workspace, activeTrackId: trackId });
    try {
      await updateWorkspace({ ...workspace, activeTrackId: trackId, isReset: true });
    } catch (err) {
      console.error("Failed to persist active track switch", err);
    }
  };

  /** Soft-delete: flips meta.archived rather than removing the track record,
   *  so the deletion is an ordinary field change that propagates correctly
   *  through the normal sync/merge path (see visibleTracks' doc comment). */
  const handleDeleteTrack = async () => {
    if (!workspace || !data) return;
    const remaining = visibleTracks(workspace).filter((t) => t.meta.id !== data.meta.id);
    if (remaining.length === 0) return;

    const archivedTrack: TrackState = { ...data, meta: { ...data.meta, archived: true } };
    const newActiveTrackId = workspace.activeTrackId === data.meta.id ? remaining[0].meta.id : workspace.activeTrackId;
    const newWorkspace: Workspace = {
      ...workspace,
      tracks: { ...workspace.tracks, [archivedTrack.meta.id]: archivedTrack },
      activeTrackId: newActiveTrackId,
    };
    setWorkspace(newWorkspace);
    try {
      await updateWorkspace(newWorkspace);
    } catch (err) {
      console.error("Failed to archive track", err);
    }
  };

  const handleEditTrackIdentity = async (fields: { name: string; color: string; startDate: string; totalDays: number }) => {
    if (!data) return;

    // Rescale every phase's recommendedByDay threshold proportionally so the
    // timeline stays internally consistent with the new total duration.
    const lastThresholdPhase = [...data.phases].reverse().find((p) => p.recommendedByDay !== undefined);
    const oldTotal = lastThresholdPhase?.recommendedByDay ?? 365;
    const ratio = oldTotal > 0 ? fields.totalDays / oldTotal : 1;
    const rescaledPhases = data.phases.map((p) =>
      p.recommendedByDay !== undefined ? { ...p, recommendedByDay: Math.max(1, Math.round(p.recommendedByDay * ratio)) } : p
    );
    // No phase had a threshold at all yet — seed the last one so the new total takes effect.
    const updatedPhases = rescaledPhases.some((p) => p.recommendedByDay !== undefined)
      ? rescaledPhases
      : rescaledPhases.map((p, i) => (i === rescaledPhases.length - 1 ? { ...p, recommendedByDay: fields.totalDays } : p));

    await persist(
      {
        ...data,
        meta: { ...data.meta, name: fields.name, color: fields.color },
        startDate: fields.startDate,
        phases: updatedPhases,
      },
      "track identity"
    );
  };

  const handleSaveRhythm = async (weekSchedule: WeekDay[], focusTypes: Record<string, FocusType>) => {
    if (!data) return;
    await persist({ ...data, weekSchedule, focusTypes }, "weekly rhythm");
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

    fetchWorkspace()
      .then(async (loadedWorkspace) => {
        setTodayStr(currentTodayStr);
        setDayOfWeek(new Date().getDay());

        const visible = visibleTracks(loadedWorkspace);
        if (visible.length === 0) {
          setWorkspace(loadedWorkspace);
          return;
        }

        // The active track may have been archived from another device since
        // this one last synced — fall back to the first visible track rather
        // than rendering an archived one.
        const activeIsVisible = !loadedWorkspace.tracks[loadedWorkspace.activeTrackId]?.meta.archived;
        const effectiveWorkspace = activeIsVisible ? loadedWorkspace : { ...loadedWorkspace, activeTrackId: visible[0].meta.id };

        const activeTrack = effectiveWorkspace.tracks[effectiveWorkspace.activeTrackId];
        const { data: resetTrackData, changed } = applyDailyResetIfNeeded(activeTrack, currentTodayStr);
        const finalWorkspace = withTrack(effectiveWorkspace, resetTrackData);
        setWorkspace(finalWorkspace);
        if (changed || !activeIsVisible) {
          try {
            await updateWorkspace({ ...finalWorkspace, isReset: true });
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

  const persist = async (newTrackData: TrackState, context: string) => {
    if (!workspace) return;
    const newWorkspace = withTrack(workspace, newTrackData);
    setWorkspace(newWorkspace);
    try {
      await updateWorkspace(newWorkspace);
    } catch (err) {
      console.error(`Failed to sync ${context}`, err);
    }
  };

  const handleMaterialChange = async (materialId: string, newStatus: string) => {
    if (!data) return;

    const updatedMaterials = data.materials.map((m) => {
      if (m.id !== materialId) return m;
      return { ...m, status: newStatus, updatedAt: Date.now() };
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
      return { ...m, ...fields, updatedAt: Date.now() };
    });

    await persist({ ...data, materials: updatedMaterials }, "material progress");
  };

  const handleAddMaterial = async (newMaterial: Omit<Material, "id">) => {
    if (!data) return;

    // Prefix with the track id so material ids stay globally unique across
    // tracks — notes sync matches files by note_<materialId>.md in one
    // shared Drive appDataFolder.
    const materialWithId = { id: `m_${data.meta.id}_${Date.now()}`, ...newMaterial, updatedAt: Date.now() };
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

  const handleAddPortfolioProject = async (newProject: Omit<PortfolioProject, "id">) => {
    if (!data) return;

    // Prefix with the track id so ids stay globally unique across tracks,
    // matching handleAddMaterial's convention.
    const projectWithId = { id: `p_${data.meta.id}_${Date.now()}`, ...newProject };
    await persist({ ...data, portfolio: [...(data.portfolio || []), projectWithId] }, "portfolio add");
  };

  const handleEditPortfolioProject = async (projectId: string, fields: Partial<PortfolioProject>) => {
    if (!data) return;

    const updatedPortfolio = data.portfolio.map((p) => (p.id === projectId ? { ...p, ...fields } : p));
    await persist({ ...data, portfolio: updatedPortfolio }, "portfolio edit");
  };

  const handleDeletePortfolioProject = async (projectId: string) => {
    if (!data) return;

    await persist({ ...data, portfolio: data.portfolio.filter((p) => p.id !== projectId) }, "portfolio delete");
  };

  const handlePhaseChange = async (newPhaseId: number) => {
    if (!data) return;

    await persist({ ...data, currentPhase: newPhaseId, currentPhaseStartDate: todayYMD() }, "phase change");
  };

  const handlePhaseUpdate = async (updatedPhase: Phase) => {
    if (!data) return;

    const updatedPhases = data.phases.map((p) => (p.id === updatedPhase.id ? updatedPhase : p));
    setSelectedPhase(updatedPhase);
    await persist({ ...data, phases: updatedPhases }, "phase update");
  };

  const handleDeletePhase = async (phaseId: number) => {
    if (!data || data.phases.length <= 1) return;

    const updatedPhases = data.phases.filter((p) => p.id !== phaseId);
    const newCurrentPhase = data.currentPhase === phaseId ? updatedPhases[0].id : data.currentPhase;
    await persist({ ...data, phases: updatedPhases, currentPhase: newCurrentPhase }, "phase delete");
  };

  const handleAddPhase = async () => {
    if (!data) return;

    const nextId = Math.max(0, ...data.phases.map((p) => p.id)) + 1;
    const newPhase: Phase = {
      id: nextId,
      title: `Phase ${nextId}`,
      description: "Describe what this phase is about.",
      tasks: [],
      detailedInfo: { focus: "", deliverable: "", math: "" },
    };
    await persist({ ...data, phases: [...data.phases, newPhase] }, "phase add");
    setSelectedPhase(newPhase);
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <LoaderCircle className="animate-spin text-accent" size={30} strokeWidth={2} />
        <p className="text-muted-foreground text-sm">Loading your Horizon workspace...</p>
      </div>
    );
  }

  if (workspace && visibleTracks(workspace).length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <LoaderCircle className="animate-spin text-accent" size={30} strokeWidth={2} />
        <p className="text-muted-foreground text-sm">Setting up your workspace...</p>
      </div>
    );
  }

  if (initError || !data || !workspace) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-8 bg-background text-foreground font-mono text-center">
        <h2 className="text-warning mb-4 uppercase tracking-[0.05em] text-2xl font-bold">Initialization Failed</h2>
        <p className="text-muted-foreground text-[0.9rem] mb-6">
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
  const phasesWithThresholds = data.phases.filter((p) => p.recommendedByDay !== undefined);
  const recommendedPhase = phasesWithThresholds.length > 0
    ? (phasesWithThresholds.find((p) => daysPassed <= (p.recommendedByDay as number))?.id
        ?? phasesWithThresholds[phasesWithThresholds.length - 1].id)
    : data.currentPhase;

  const PANELS: Record<string, React.ReactNode> = {
    weeklyPlan: (
      <WeeklyPlan
        data={data}
        todayStr={todayStr}
        dayOfWeek={dayOfWeek}
        weekOffset={weekOffset}
        setWeekOffset={setWeekOffset}
        onDayClick={setSelectedScheduleDay}
        onRotationClick={(rotationId) => setRotationModal({ rotationId })}
        applyChange={applyChange}
      />
    ),
    phaseTracker: (
      <PhaseTracker
        phases={data.phases}
        currentPhase={data.currentPhase}
        onPhaseClick={setSelectedPhase}
        onAddPhase={handleAddPhase}
      />
    ),
    streakGraph: (
      <StreakGraph
        streakHistory={data.streakHistory}
        completedItemsHistory={data.completedItemsHistory || {}}
        startDate={data.startDate}
      />
    ),
    pomodoroTimer: <PomodoroTimer />,
    portfolioTracker: (
      <PortfolioTracker
        portfolio={data.portfolio}
        onToggle={handlePortfolioToggle}
        onAddProject={handleAddPortfolioProject}
        onEditProject={handleEditPortfolioProject}
        onDeleteProject={handleDeletePortfolioProject}
      />
    ),
    materialsTracker: (
      <MaterialsTracker
        materials={data.materials || []}
        onStatusChange={handleMaterialChange}
        onProgressChange={handleMaterialProgressChange}
        onAddMaterial={handleAddMaterial}
        onDeleteMaterial={handleDeleteMaterial}
        onOpenLink={handleOpenLink}
      />
    ),
  };

  const PANEL_EDIT_HANDLERS: Record<string, (() => void) | undefined> = {
    weeklyPlan: () => setShowRhythmEditor(true),
  };

  return (
    <main className="container">
      <div className="app-glow" aria-hidden="true" />
      <DndContext
        sensors={panelSensors}
        collisionDetection={closestCenter}
        onDragOver={handlePanelDragOver}
        onDragEnd={handlePanelDragEnd}
      >
        <div className="col-span-full flex flex-col gap-3">
          <DashboardHeader
            data={data}
            workspace={workspace}
            syncStatus={syncStatus}
            syncError={syncError}
            onSync={handleSyncWorkspace}
            onOpenCloudMenu={handleOpenCloudMenu}
            onSwitchTrack={handleSwitchTrack}
            onNewTrack={() => router.push("/onboarding?mode=add")}
            onEditTrack={handleEditTrackIdentity}
            onDeleteTrack={handleDeleteTrack}
            canDeleteTrack={visibleTracks(workspace).length > 1}
          />

          {/* Phase recommendation alert */}
          {data.currentPhase !== recommendedPhase && (
            <div className="glass-panel border-l-4 !border-l-warning flex justify-between items-center px-6 py-4">
              <span className="text-[0.9rem] text-foreground">
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
        </div>

        <SortableContext items={panelColumns.left} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-8">
            {panelColumns.left.map((id, i) => (
              <SortablePanel key={id} id={id} index={i} onEdit={PANEL_EDIT_HANDLERS[id]}>{PANELS[id]}</SortablePanel>
            ))}
          </div>
        </SortableContext>

        <SortableContext items={panelColumns.right} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-8">
            {panelColumns.right.map((id, i) => (
              <SortablePanel key={id} id={id} index={i + 1} onEdit={PANEL_EDIT_HANDLERS[id]}>{PANELS[id]}</SortablePanel>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {selectedPhase && (
        <PhaseDetailModal
          phase={selectedPhase}
          currentPhaseId={data.currentPhase}
          onClose={() => setSelectedPhase(null)}
          onActivatePhase={handlePhaseChange}
          onChange={handlePhaseUpdate}
          onDelete={handleDeletePhase}
          canDelete={data.phases.length > 1}
        />
      )}
      {selectedScheduleDay && (
        <ScheduleDayModal
          day={selectedScheduleDay}
          data={data}
          setData={setTrackData}
          saveDailyChanges={saveDailyChanges}
          onClose={() => setSelectedScheduleDay(null)}
          updateTrackState={updateTrackState}
          weekOffset={weekOffset}
        />
      )}
      {rotationModal && (
        <RotationModal
          data={data}
          rotationId={rotationModal.rotationId}
          onClose={() => setRotationModal(null)}
          applyChange={applyChange}
        />
      )}
      {showRhythmEditor && (
        <WeeklyRhythmModal
          weekSchedule={data.weekSchedule || []}
          focusTypes={data.focusTypes || {}}
          onSave={handleSaveRhythm}
          onClose={() => setShowRhythmEditor(false)}
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
