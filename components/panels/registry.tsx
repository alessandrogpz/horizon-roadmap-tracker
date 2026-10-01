"use client";

import React from "react";
import { Activity, BookOpen, CalendarDays, Dumbbell, FolderGit2, ListTodo, Milestone, NotebookPen, Timer } from "lucide-react";
import type { ModuleId } from "@/lib/modules";
import type { Phase, WeekDay } from "@/lib/types";
import MaterialsPanel from "./MaterialsPanel";
import PortfolioPanel from "./PortfolioPanel";
import GymTracker from "@/components/GymTracker";
import PhaseTracker from "@/components/PhaseTracker";
import Notepad from "@/components/Notepad";
import PomodoroTimer from "@/components/PomodoroTimer";
import StreakGraph from "@/components/StreakGraph";
import TodoList from "@/components/TodoList";
import WeeklyPlan from "@/components/WeeklyPlan";
import { useWorkspace, useWorkspaceActions } from "@/components/workspace/WorkspaceProvider";
import { addPhase } from "@/lib/trackActions";
import { notepadNoteId, todoNoteId } from "@/lib/quickNotes";
import { orderedTracks } from "@/lib/selectors";

/** Everything a panel needs from the dashboard that isn't workspace data:
 *  which week is being viewed, and how to open the various modals. Panels
 *  read the track itself from the workspace context. */
export interface PanelContext {
  dayOfWeek: number;
  weekOffset: number;
  setWeekOffset: (offset: number) => void;
  openScheduleDay: (day: WeekDay) => void;
  openRotation: (rotationId: string | null) => void;
  openPhase: (phase: Phase) => void;
  openRhythmEditor: () => void;
}

export interface PanelDefinition {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  Panel: React.ComponentType<{ ctx: PanelContext }>;
  /** Optional bulk editor, surfaced as a pencil in the panel's hover chrome. */
  onEdit?: (ctx: PanelContext) => void;
}

// --- Panels ------------------------------------------------------------
// Thin wiring only: each one pulls the active track out of context and hands
// it to the presentational component. Anything that decides *what an edit
// does* belongs in lib/trackActions.ts or lib/completions.ts instead.

function WeeklyPlanPanel({ ctx }: { ctx: PanelContext }) {
  const { track } = useWorkspace();
  const { updateTrack } = useWorkspaceActions();
  if (!track) return null;
  return (
    <WeeklyPlan
      data={track}
      dayOfWeek={ctx.dayOfWeek}
      weekOffset={ctx.weekOffset}
      setWeekOffset={ctx.setWeekOffset}
      onDayClick={ctx.openScheduleDay}
      onRotationClick={ctx.openRotation}
      applyChange={updateTrack}
    />
  );
}

function PhaseTrackerPanel({ ctx }: { ctx: PanelContext }) {
  const { track } = useWorkspace();
  const { commitTrack } = useWorkspaceActions();
  if (!track) return null;
  return (
    <PhaseTracker
      phases={track.phases}
      currentPhase={track.currentPhase}
      startDate={track.startDate}
      roadmapEnabled={!!track.isSynced}
      onPhaseClick={ctx.openPhase}
      onAddPhase={async () => {
        const { track: next, phase } = addPhase(track);
        await commitTrack(next, "phase add");
        ctx.openPhase(phase);
      }}
    />
  );
}

function StreakPanel() {
  const { track, workspace } = useWorkspace();
  if (!track) return null;
  return (
    <StreakGraph
      streakHistory={track.streakHistory}
      completedItemsHistory={track.completedItemsHistory || {}}
      startDate={track.startDate}
      color={track.meta.color}
      weekSchedule={track.weekSchedule}
      focusTypes={track.focusTypes}
      tracks={workspace ? orderedTracks(workspace) : []}
    />
  );
}

function PomodoroPanel() {
  return <PomodoroTimer />;
}

// Keyed by note id so switching tracks remounts them: a save still waiting
// then lands in the track it was typed into (see components/useQuickNote.ts).
function NotepadPanel() {
  const { track } = useWorkspace();
  if (!track) return null;
  const noteId = notepadNoteId(track.meta.id);
  return <Notepad key={noteId} noteId={noteId} />;
}

function GymPanel() {
  const { track } = useWorkspace();
  if (!track) return null;
  // Keyed by track so switching tracks re-reads that track's log rather than
  // showing the previous one until the next render.
  return <GymTracker key={track.meta.id} />;
}

function TodoListPanel() {
  const { track } = useWorkspace();
  if (!track) return null;
  const noteId = todoNoteId(track.meta.id);
  return <TodoList key={noteId} noteId={noteId} />;
}

// --- Registry ----------------------------------------------------------

/** Typed as a full map over ModuleId, so adding an entry to lib/modules.ts
 *  without adding its panel here fails to compile. */
export const PANEL_REGISTRY: Record<ModuleId, PanelDefinition> = {
  weeklyPlan: {
    icon: CalendarDays,
    Panel: WeeklyPlanPanel,
    onEdit: (ctx) => ctx.openRhythmEditor(),
  },
  phaseTracker: { icon: Milestone, Panel: PhaseTrackerPanel },
  streakGraph: { icon: Activity, Panel: StreakPanel },
  pomodoroTimer: { icon: Timer, Panel: PomodoroPanel },
  portfolioTracker: { icon: FolderGit2, Panel: PortfolioPanel },
  materialsTracker: { icon: BookOpen, Panel: MaterialsPanel },
  notepad: { icon: NotebookPen, Panel: NotepadPanel },
  todoList: { icon: ListTodo, Panel: TodoListPanel },
  gym: { icon: Dumbbell, Panel: GymPanel },
};

export const panelFor = (id: string): PanelDefinition | undefined =>
  PANEL_REGISTRY[id as ModuleId];
