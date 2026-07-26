// Pure track mutations: every "what does this edit do to the data" rule the
// dashboard needs, expressed as `(track, args) => nextTrack`.
//
// These used to be fifteen handlers inlined in app/page.tsx, which meant the
// page component had to be read end-to-end to answer questions like "does
// completing a material touch the streak?". Keeping them here makes each rule
// testable on its own and lets the UI stay wiring.

import type { FocusType, Material, Phase, PortfolioProject, TrackState, WeekDay } from "./types";
import { addCompletion, removeCompletion } from "./streak";
import { todayYMD } from "./dates";

/** The track's horizon in days: the last phase carrying a `recommendedByDay`
 *  threshold defines it. Tracks whose template sets none fall back to a year.
 *  Single source of truth for the header's progress ring and the rescaling
 *  done when the user edits the track's total length. */
export const trackTotalDays = (track: Pick<TrackState, "phases">): number => {
  const lastThreshold = [...track.phases].reverse().find((p) => p.recommendedByDay !== undefined);
  return lastThreshold?.recommendedByDay ?? 365;
};

/** Which phase the schedule says the user should be on at `daysPassed`, used
 *  for the "time to switch phase" banner. Falls back to the current phase for
 *  tracks whose phases carry no thresholds at all — they never show it. */
export const recommendedPhaseId = (track: TrackState, daysPassed: number): number => {
  const withThresholds = track.phases.filter((p) => p.recommendedByDay !== undefined);
  if (withThresholds.length === 0) return track.currentPhase;
  return (
    withThresholds.find((p) => daysPassed <= (p.recommendedByDay as number))?.id ??
    withThresholds[withThresholds.length - 1].id
  );
};

// --- Materials ---------------------------------------------------------

/** Marking a material Completed also records an accomplishment for today, so
 *  finishing a book counts toward the streak the same as ticking a task. */
export const setMaterialStatus = (track: TrackState, materialId: string, status: string, dateStr: string): TrackState => {
  const material = track.materials.find((m) => m.id === materialId);
  if (!material) return track;

  const materials = track.materials.map((m) => (m.id === materialId ? { ...m, status, updatedAt: Date.now() } : m));
  const title = material.title || "Study Material";

  let streakFields = {
    streakHistory: track.streakHistory || [],
    completedItemsHistory: track.completedItemsHistory || {},
  };
  if (status === "Completed" && material.status !== "Completed") {
    streakFields = addCompletion(track, dateStr, title);
  } else if (status !== "Completed" && material.status === "Completed") {
    streakFields = removeCompletion(track, dateStr, title);
  }

  return { ...track, materials, ...streakFields };
};

export const updateMaterial = (track: TrackState, materialId: string, fields: Partial<Material>): TrackState => ({
  ...track,
  materials: track.materials.map((m) => (m.id === materialId ? { ...m, ...fields, updatedAt: Date.now() } : m)),
});

/** Ids are prefixed with the track id so they stay globally unique — notes
 *  sync matches files by note_<materialId>.md in one shared Drive folder. */
export const addMaterial = (track: TrackState, material: Omit<Material, "id">): TrackState => ({
  ...track,
  materials: [...(track.materials || []), { id: `m_${track.meta.id}_${Date.now()}`, ...material, updatedAt: Date.now() }],
});

export const removeMaterial = (track: TrackState, materialId: string): TrackState => ({
  ...track,
  materials: track.materials.filter((m) => m.id !== materialId),
});

// --- Portfolio ---------------------------------------------------------

export const togglePortfolioProject = (track: TrackState, projectId: string, dateStr: string): TrackState => {
  const project = track.portfolio.find((p) => p.id === projectId);
  if (!project) return track;

  const nowCompleted = !project.completed;
  const portfolio = track.portfolio.map((p) => (p.id === projectId ? { ...p, completed: nowCompleted } : p));
  const title = project.title || "Portfolio Project";
  const streakFields = nowCompleted
    ? addCompletion(track, dateStr, title)
    : removeCompletion(track, dateStr, title);

  return { ...track, portfolio, ...streakFields };
};

export const addPortfolioProject = (track: TrackState, project: Omit<PortfolioProject, "id">): TrackState => ({
  ...track,
  portfolio: [...(track.portfolio || []), { id: `p_${track.meta.id}_${Date.now()}`, ...project }],
});

export const updatePortfolioProject = (
  track: TrackState,
  projectId: string,
  fields: Partial<PortfolioProject>
): TrackState => ({
  ...track,
  portfolio: track.portfolio.map((p) => (p.id === projectId ? { ...p, ...fields } : p)),
});

export const removePortfolioProject = (track: TrackState, projectId: string): TrackState => ({
  ...track,
  portfolio: track.portfolio.filter((p) => p.id !== projectId),
});

// --- Phases ------------------------------------------------------------

export const setCurrentPhase = (track: TrackState, phaseId: number): TrackState => ({
  ...track,
  currentPhase: phaseId,
  currentPhaseStartDate: todayYMD(),
});

export const updatePhase = (track: TrackState, phase: Phase): TrackState => ({
  ...track,
  phases: track.phases.map((p) => (p.id === phase.id ? phase : p)),
});

/** Refuses to remove the last phase — a track with no phases has no timeline. */
export const removePhase = (track: TrackState, phaseId: number): TrackState => {
  if (track.phases.length <= 1) return track;
  const phases = track.phases.filter((p) => p.id !== phaseId);
  return {
    ...track,
    phases,
    currentPhase: track.currentPhase === phaseId ? phases[0].id : track.currentPhase,
  };
};

/** Returns the new phase alongside the track so the caller can open it for editing. */
export const addPhase = (track: TrackState): { track: TrackState; phase: Phase } => {
  const nextId = Math.max(0, ...track.phases.map((p) => p.id)) + 1;
  const phase: Phase = {
    id: nextId,
    title: `Phase ${nextId}`,
    description: "Describe what this phase is about.",
    tasks: [],
    detailedInfo: { focus: "", deliverable: "", math: "" },
  };
  return { track: { ...track, phases: [...track.phases, phase] }, phase };
};

// --- Track identity ----------------------------------------------------

export interface TrackIdentityFields {
  name: string;
  color: string;
  startDate: string;
  totalDays: number;
}

/**
 * Renaming/re-dating a track also rescales every phase's `recommendedByDay`
 * proportionally, so the timeline stays internally consistent with the new
 * total duration instead of leaving deadlines stranded past the end.
 */
export const updateTrackIdentity = (track: TrackState, fields: TrackIdentityFields): TrackState => {
  const oldTotal = trackTotalDays(track);
  const ratio = oldTotal > 0 ? fields.totalDays / oldTotal : 1;
  const rescaled = track.phases.map((p) =>
    p.recommendedByDay !== undefined ? { ...p, recommendedByDay: Math.max(1, Math.round(p.recommendedByDay * ratio)) } : p
  );
  // No phase carried a threshold at all — seed the last one so the new total takes effect.
  const phases = rescaled.some((p) => p.recommendedByDay !== undefined)
    ? rescaled
    : rescaled.map((p, i) => (i === rescaled.length - 1 ? { ...p, recommendedByDay: fields.totalDays } : p));

  return {
    ...track,
    meta: { ...track.meta, name: fields.name, color: fields.color },
    startDate: fields.startDate,
    phases,
  };
};

export const setWeeklyRhythm = (
  track: TrackState,
  weekSchedule: WeekDay[],
  focusTypes: Record<string, FocusType>
): TrackState => ({ ...track, weekSchedule, focusTypes });
