import type { FocusType, Material, Phase, PortfolioProject, WeekDay } from "../types";

/**
 * A TrackTemplate is only an initial data seed for a new Track. Once
 * seedTrackFromTemplate() runs, the produced TrackState is a plain, fully
 * mutable object — nothing downstream ever re-reads templateId to gate
 * editability. templateId is stored on the resulting track purely for
 * "seeded from" provenance display.
 */
export interface TrackTemplate {
  id: string;
  label: string;
  description: string;
  defaultColor: string;
  defaultDurationDays: number;
  buildPhases: (durationDays: number) => Phase[];
  defaultWeekSchedule: WeekDay[];
  defaultFocusTypes: Record<string, FocusType>;
  defaultMaterials?: Omit<Material, "id">[];
  defaultPortfolio?: Omit<PortfolioProject, "id">[];
}
