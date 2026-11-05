"use client";

import React, { useEffect, useState } from "react";
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
import { LayoutGrid, LoaderCircle } from "lucide-react";
import type { PanelColumns, Phase, TrackState, WeekDay, Workspace } from "@/lib/types";
import { orderedTracks, visibleTracks } from "@/lib/selectors";
import { updateSettings } from "@/lib/settings";
import { useAppSettings } from "@/lib/useAppSettings";
import { daysSince } from "@/lib/dates";

import { MODULES, defaultPanelColumns, homeColumnFor, resolveTrackLayout } from "@/lib/modules";
import { recommendedPhaseId, removePhase, reorderTracks, setCurrentPhase, setWeeklyRhythm, updatePhase, updateTrackIdentity } from "@/lib/trackActions";
import { masterSources } from "@/lib/masterTrack";
import { loadGoogleGisScript } from "@/lib/googleSignIn";
import { useWorkspace, useWorkspaceActions } from "@/components/workspace/WorkspaceProvider";
import { useUndoableEdit } from "@/components/UndoBar";
import { useAccount } from "@/components/useAccount";
import { panelFor, type PanelContext } from "@/components/panels/registry";
import PanelErrorBoundary from "@/components/panels/PanelErrorBoundary";
import DashboardHeader from "@/components/DashboardHeader";
import NewTrackModal from "@/components/NewTrackModal";
import TrackAccent from "@/components/TrackAccent";
import MasterBoard from "@/components/master/MasterBoard";
import PhaseDetailModal from "@/components/PhaseDetailModal";
import RotationModal from "@/components/RotationModal";
import ScheduleDayModal from "@/components/ScheduleDayModal";
import SortablePanel from "@/components/SortablePanel";
import WeeklyRhythmModal from "@/components/WeeklyRhythmModal";

type PanelColumnId = "left" | "right";

const findPanelColumn = (columns: PanelColumns, id: string): PanelColumnId | null => {
  if (columns.left.includes(id)) return "left";
  if (columns.right.includes(id)) return "right";
  if (id === "left" || id === "right") return id;
  return null;
};

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <LoaderCircle className="animate-spin text-accent" size={30} strokeWidth={2} />
      <p className="text-muted-foreground type-body">{children}</p>
    </div>
  );
}

export default function Dashboard() {
  const { workspace, track, status, error, syncStatus, syncError } = useWorkspace();
  const { updateTrack, commitTrack, commitWorkspace, switchTrack, addTrack, syncAccount, reload } = useWorkspaceActions();
  const undoable = useUndoableEdit();
  // Sync means the account, and only the account. Signed out, the app is
  // local-only — which is a complete way to use it, not a degraded one.
  const account = useAccount();

  const [selectedScheduleDay, setSelectedScheduleDay] = useState<WeekDay | null>(null);
  // null = closed. { rotationId: null } = create new. { rotationId: "<id>" } = view/edit that one.
  const [rotationModal, setRotationModal] = useState<{ rotationId: string | null } | null>(null);
  const [showRhythmEditor, setShowRhythmEditor] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [creatingTrack, setCreatingTrack] = useState(false);

  /**
   * The master view — every track at once, read-only.
   *
   * Kept in the device's settings rather than in the workspace, and
   * deliberately: which track is *active* is data and syncs, but which of the
   * two ways of looking at the workspace you last used is this browser's own
   * business. It is also why there is no master track on disk — nothing is
   * stored for it, so there is nothing an edit could land in.
   */
  const settings = useAppSettings();
  const tracksInOrder = workspace ? orderedTracks(workspace) : [];
  // Only ever open with something to aggregate. One track's master view is a
  // worse copy of that track.
  const masterOpen = settings.masterView && tracksInOrder.length > 1;

  // Local, draggable copy of the panel order. It mirrors the active track's
  // stored layout but must also hold ahead-of-persistence state during an
  // active drag gesture, so it's synced from the loaded track during render
  // rather than via an effect.
  const [panelColumns, setPanelColumns] = useState<PanelColumns>(defaultPanelColumns());
  // Keyed on trackId + serialized columns so a track switch or a persisted
  // reorder/hide re-syncs, but an in-flight drag (which only mutates local
  // state) doesn't get clobbered mid-gesture.
  const [layoutSyncKey, setLayoutSyncKey] = useState<string>("");
  if (track) {
    const key = `${track.meta.id}:${JSON.stringify(track.panelColumns ?? null)}`;
    if (key !== layoutSyncKey) {
      setLayoutSyncKey(key);
      setPanelColumns(resolveTrackLayout(track).columns);
    }
  }

  // Register the service worker and pre-load the Google Identity script (so a
  // later sync click isn't eaten by the popup blocker).
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(
        (reg) => console.log("SW registered:", reg.scope),
        (err) => console.error("SW registration failed:", err)
      );
    }
    loadGoogleGisScript().catch((err) => console.error("Failed to preload Google GIS:", err));
  }, []);

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

  /** Persist the active track's dashboard layout. A normal (non-reset) save so
   *  the layout change bumps the track's configVersion and syncs like the rest
   *  of its config. `hidden` defaults to the track's current hidden set, so a
   *  pure reorder leaves closed modules untouched. */
  const persistTrackLayout = (columns: PanelColumns, hidden?: string[]) => {
    void commitTrack(
      (previous) => ({ ...previous, panelColumns: columns, hiddenPanels: hidden ?? previous.hiddenPanels ?? [] }),
      "dashboard layout"
    );
  };

  /** Close a module: drop it from the visible columns and add it to the track's
   *  hidden set. The track's data behind the module is never touched. */
  const handleHideModule = (id: string) => {
    const next: PanelColumns = {
      left: panelColumns.left.filter((x) => x !== id),
      right: panelColumns.right.filter((x) => x !== id),
    };
    setPanelColumns(next);
    persistTrackLayout(next, Array.from(new Set([...(track?.hiddenPanels ?? []), id])));
  };

  /** Reopen a module: append it to its home column (unless already placed) and
   *  remove it from the hidden set. */
  const handleShowModule = (id: string) => {
    const next: PanelColumns = { left: [...panelColumns.left], right: [...panelColumns.right] };
    if (!next.left.includes(id) && !next.right.includes(id)) {
      const home = homeColumnFor(id);
      next[home] = [...next[home], id];
    }
    setPanelColumns(next);
    persistTrackLayout(next, (track?.hiddenPanels ?? []).filter((x) => x !== id));
  };

  const handleToggleModule = (id: string) => {
    const isVisible = panelColumns.left.includes(id) || panelColumns.right.includes(id);
    if (isVisible) handleHideModule(id);
    else handleShowModule(id);
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
      const next = {
        ...panelColumns,
        [activeCol]: arrayMove(items, items.indexOf(String(active.id)), items.indexOf(String(over.id))),
      };
      setPanelColumns(next);
      persistTrackLayout(next);
    } else {
      // Cross-column move was already applied live by handlePanelDragOver — persist as-is.
      persistTrackLayout(panelColumns);
    }
  };

  const handleSyncWorkspace = () => {
    if (syncStatus === "syncing" || !account) return;
    void syncAccount();
  };

  /** Soft-delete: flips meta.archived rather than removing the track record,
   *  so the deletion is an ordinary field change that propagates correctly
   *  through the normal sync/merge path (see visibleTracks' doc comment). */
  /**
   * Deleting a track — any track, not only the open one.
   *
   * Implemented as `meta.archived`, and that is not a euphemism: the sync
   * merge reconciles two devices by comparing records, so a track removed by
   * *absence* here would simply be handed back by the next sync from the
   * account's copy. A flag is a change both sides can agree on.
   */
  const handleDeleteTrack = (trackId?: string) => {
    if (!workspace || !track) return;
    const target = workspace.tracks[trackId ?? track.meta.id];
    if (!target) return;
    const remaining = orderedTracks(workspace).filter((other) => other.meta.id !== target.meta.id);
    if (remaining.length === 0) return;

    const archived: TrackState = { ...target, meta: { ...target.meta, archived: true } };
    const next: Workspace = {
      ...workspace,
      tracks: { ...workspace.tracks, [archived.meta.id]: archived },
      activeTrackId:
        workspace.activeTrackId === archived.meta.id ? remaining[0].meta.id : workspace.activeTrackId,
    };
    void commitWorkspace(next);
  };

  /** A new order for the track list. Saved immediately rather than debounced:
   *  it is a discrete decision, and the menu it was made in is usually closed
   *  a moment later. */
  const handleReorderTracks = (orderedIds: string[]) => {
    if (!workspace) return;
    void commitWorkspace({ ...workspace, tracks: reorderTracks(workspace.tracks, orderedIds) });
  };

  /** Switching a track in or out of the master view. Never touches the track. */
  const toggleMasterTrack = (trackId: string) => {
    const off = new Set(settings.masterExcluded);
    if (off.has(trackId)) off.delete(trackId);
    else off.add(trackId);
    updateSettings({ masterExcluded: [...off] });
  };

  if (status === "loading") return <FullScreenMessage>Loading your Horizon workspace...</FullScreenMessage>;

  if (status === "error" || !track || !workspace) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-8 bg-background text-foreground font-mono text-center">
        <h2 className="text-warning mb-4 type-display-sm font-bold">Initialization Failed</h2>
        <p className="text-muted-foreground type-subhead mb-6">Your local workspace could not be opened.</p>
        <div className="p-4 bg-card rounded-md border border-card-border text-danger mb-6 max-w-[500px] break-all">
          {error || "No data was returned by the local database."}
        </div>
        <button className="btn" onClick={() => window.location.reload()}>Retry Connection</button>
      </div>
    );
  }

  const daysPassed = track.startDate && track.isSynced ? daysSince(track.startDate) : 0;
  const recommendedPhase = recommendedPhaseId(track, daysPassed);

  const panelContext: PanelContext = {
    // Safe to read the clock during render: everything below this point is
    // gated on `status === "ready"`, which only ever happens on the client
    // after the async load — the server never renders the day grid, so there
    // is nothing for it to disagree with.
    dayOfWeek: new Date().getDay(),
    weekOffset,
    setWeekOffset,
    openScheduleDay: setSelectedScheduleDay,
    openRotation: (rotationId) => setRotationModal({ rotationId }),
    openPhase: setSelectedPhase,
    openRhythmEditor: () => setShowRhythmEditor(true),
  };

  const renderColumn = (ids: string[], indexOffset: number) =>
    ids.map((id, i) => {
      const definition = panelFor(id);
      if (!definition) return null;
      const label = MODULES.find((m) => m.id === id)?.label ?? id;
      const { Panel, onEdit } = definition;
      return (
        <SortablePanel
          key={id}
          id={id}
          index={i + indexOffset}
          onEdit={onEdit ? () => onEdit(panelContext) : undefined}
          onHide={() => handleHideModule(id)}
        >
          <PanelErrorBoundary label={label}>
            <Panel ctx={panelContext} />
          </PanelErrorBoundary>
        </SortablePanel>
      );
    });

  const visibleModuleIds = new Set([...panelColumns.left, ...panelColumns.right]);
  const moduleState = MODULES.map((m) => ({ id: m.id, label: m.label, visible: visibleModuleIds.has(m.id) }));
  const allModulesHidden = panelColumns.left.length === 0 && panelColumns.right.length === 0;

  return (
    <main className="container">
      {/* The open track's colour, applied to the page's accent variables — so
          a track wears its colour everywhere without a colour being threaded
          through every component. */}
      <TrackAccent color={track.meta.color} />
      <DndContext
        sensors={panelSensors}
        collisionDetection={closestCenter}
        onDragOver={handlePanelDragOver}
        onDragEnd={handlePanelDragEnd}
      >
        <div className="col-span-full flex flex-col gap-3">
          <DashboardHeader
            data={track}
            workspace={workspace}
            syncStatus={syncStatus}
            syncError={syncError}
            syncTarget={account ? "account" : "local"}
            onSync={handleSyncWorkspace}
            onSwitchTrack={(trackId) => {
              // Picking a track is also how you leave the master view: it is
              // one list, and choosing from it should land you where you
              // chose rather than beside it. True of the track already open,
              // which is why the switcher reports that one too.
              if (settings.masterView) updateSettings({ masterView: false });
              // A switch writes — it runs the track's daily reset — so the
              // one case that needs no work is skipped here rather than in
              // the menu, which cannot know that.
              if (trackId !== workspace.activeTrackId) void switchTrack(trackId);
            }}
            onNewTrack={async () => setCreatingTrack(true)}
            onEditTrack={(fields) => void commitTrack((prev) => updateTrackIdentity(prev, fields), "track identity")}
            onDeleteTrack={handleDeleteTrack}
            onReorderTracks={handleReorderTracks}
            masterTracks={masterOpen ? masterSources(tracksInOrder, settings.masterExcluded) : null}
            masterOpen={masterOpen}
            onOpenMaster={() => updateSettings({ masterView: true })}
            canDeleteTrack={visibleTracks(workspace).length > 1}
            moduleState={moduleState}
            onToggleModule={handleToggleModule}
            onEditRhythm={() => setShowRhythmEditor(true)}
            onNewRotation={() => setRotationModal({ rotationId: null })}
            onReloadWorkspace={() => void reload()}
          />

          {/* Phase recommendation alert — about the open track, so not while
              the master view is showing every track's phases at once. */}
          {!masterOpen && track.currentPhase !== recommendedPhase && (
            <div className="glass-panel border-l-4 !border-l-warning flex justify-between items-center px-6 py-4">
              <span className="type-subhead text-foreground">
                Schedule suggestion: Time to transition to Phase {recommendedPhase} (Day {daysPassed})
              </span>
              <button
                onClick={() => void commitTrack((prev) => setCurrentPhase(prev, recommendedPhase), "phase change")}
                className="btn px-3 py-1 type-body !bg-warning !text-background"
              >
                Switch Now
              </button>
            </div>
          )}
        </div>

        {masterOpen ? (
          <MasterBoard
            tracks={tracksInOrder}
            excluded={settings.masterExcluded}
            onToggleTrack={toggleMasterTrack}
            weekOffset={weekOffset}
            setWeekOffset={setWeekOffset}
          />
        ) : (
          <>
        <SortableContext items={panelColumns.left} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-8">{renderColumn(panelColumns.left, 0)}</div>
        </SortableContext>

        <SortableContext items={panelColumns.right} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-8">{renderColumn(panelColumns.right, 1)}</div>
        </SortableContext>
          </>
        )}

        {!masterOpen && allModulesHidden && (
          <div className="col-span-full glass-panel flex flex-col items-center justify-center gap-3 py-16 text-center">
            <LayoutGrid size={28} strokeWidth={1.75} className="text-muted-foreground" />
            <p className="text-foreground type-body font-medium">No modules are open for this track</p>
            <p className="text-subtle-foreground type-caption max-w-[360px]">
              Open some from the Modules menu in the header. Closing a module only hides it — none of this track&apos;s data is ever deleted.
            </p>
          </div>
        )}
      </DndContext>

      {selectedPhase && (
        <PhaseDetailModal
          phase={selectedPhase}
          currentPhaseId={track.currentPhase}
          startDate={track.startDate}
          onClose={() => setSelectedPhase(null)}
          onActivatePhase={(id) => void commitTrack((prev) => setCurrentPhase(prev, id), "phase change")}
          onChange={(phase) => {
            setSelectedPhase(phase);
            void commitTrack((prev) => updatePhase(prev, phase), "phase update");
          }}
          onDelete={(id) =>
            undoable("Phase removed", () => void commitTrack((prev) => removePhase(prev, id), "phase delete"))
          }
          canDelete={track.phases.length > 1}
        />
      )}
      {selectedScheduleDay && (
        <ScheduleDayModal
          day={selectedScheduleDay}
          data={track}
          applyChange={updateTrack}
          onClose={() => setSelectedScheduleDay(null)}
          weekOffset={weekOffset}
        />
      )}
      {rotationModal && (
        <RotationModal
          data={track}
          rotationId={rotationModal.rotationId}
          onClose={() => setRotationModal(null)}
          applyChange={updateTrack}
        />
      )}
      {creatingTrack && (
        <NewTrackModal
          takenColors={visibleTracks(workspace).map((other) => other.meta.color)}
          onCreate={(created) => void addTrack(created)}
          onClose={() => setCreatingTrack(false)}
        />
      )}
      {showRhythmEditor && (
        <WeeklyRhythmModal
          weekSchedule={track.weekSchedule || []}
          focusTypes={track.focusTypes || {}}
          onSave={(weekSchedule, focusTypes) =>
            void commitTrack((prev) => setWeeklyRhythm(prev, weekSchedule, focusTypes), "weekly rhythm")
          }
          onClose={() => setShowRhythmEditor(false)}
        />
      )}
    </main>
  );
}
