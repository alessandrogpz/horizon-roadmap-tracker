import type { FocusType, Material, Phase, PortfolioProject, TrackId, TrackState, WeekDay } from "../types";
import { engineGraphicsTemplate, LEGACY_TRACK_ID } from "./engineGraphics";
import { fitnessTemplate } from "./fitness";
import { learningTemplate } from "./learning";
import { blankTemplate } from "./blank";
import type { TrackTemplate } from "./types";

export type { TrackTemplate } from "./types";
export { LEGACY_TRACK_ID };

export const TEMPLATES: Record<string, TrackTemplate> = {
  [engineGraphicsTemplate.id]: engineGraphicsTemplate,
  [fitnessTemplate.id]: fitnessTemplate,
  [learningTemplate.id]: learningTemplate,
  [blankTemplate.id]: blankTemplate,
};

export const TEMPLATE_LIST: TrackTemplate[] = Object.values(TEMPLATES);

export interface SeedAnswers {
  name: string;
  color: string;
  startDate: string; // YYYY-MM-DD
  phases: Phase[];
  weekSchedule: WeekDay[];
  focusTypes: Record<string, FocusType>;
  materials?: Omit<Material, "id">[];
  portfolio?: Omit<PortfolioProject, "id">[];
}

function generateTrackId(): TrackId {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `track_${crypto.randomUUID()}`;
  }
  return `track_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY_DAY_MAP = () => ({ Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] });

/**
 * Builds a brand-new, fully mutable TrackState from a template plus the
 * wizard's answers. `meta.templateId` is set for provenance display only —
 * no other code path may ever read it to gate what's editable.
 *
 * isSynced is set true immediately: a wizard-completed track has real local
 * data from the moment it's created, so today's task is actionable right
 * away instead of showing a "connect Drive first" placeholder state.
 */
export function seedTrackFromTemplate(template: TrackTemplate, answers: SeedAnswers): TrackState {
  const trackId = generateTrackId();

  const materials: Material[] = (answers.materials ?? template.defaultMaterials ?? []).map((m, i) => ({
    ...m,
    id: `m_${trackId}_${Date.now()}_${i}`,
  }));

  const portfolio: PortfolioProject[] = (answers.portfolio ?? template.defaultPortfolio ?? []).map((p, i) => ({
    ...p,
    id: `p_${trackId}_${Date.now()}_${i}`,
  }));

  return {
    meta: {
      id: trackId,
      name: answers.name || template.label,
      color: answers.color || template.defaultColor,
      templateId: template.id,
      createdAt: Date.now(),
    },
    currentPhase: answers.phases[0]?.id ?? 1,
    startDate: answers.startDate,
    currentPhaseStartDate: answers.startDate,
    dsaStartWeek: template.rotationConfig?.startWeek ?? 1,
    streakHistory: [],
    lastDailyRoutineCheck: "",
    lastTasksResetDate: "",
    dailyFocus: {},
    dailyTasks: EMPTY_DAY_MAP(),
    dailyRevisionItems: EMPTY_DAY_MAP(),
    phases: answers.phases,
    portfolio,
    materials,
    dailyStudyPoints: {},
    completedItemsHistory: {},
    weeklyCompletions: {},
    studyStreak: [],
    weekSchedule: answers.weekSchedule,
    focusTypes: answers.focusTypes,
    rotationConfig: template.rotationConfig,
    isSynced: true,
    configVersion: 0,
    lastUpdatedDates: {},
  };
}
