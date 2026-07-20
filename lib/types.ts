// Central data model for the tracker. The single "current" record stored in
// IndexedDB (and mirrored to Google Drive as database.json) follows AppState.

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface RevisionItem extends TaskItem {
  description?: string;
}

export interface PhaseDetailItem {
  item: string;
  desc: string;
}

export interface PhaseDetailedInfo {
  focus: PhaseDetailItem[] | string;
  deliverable: PhaseDetailItem[] | string;
  math: PhaseDetailItem[] | string;
  algoDS?: PhaseDetailItem[] | string;
}

export interface Phase {
  id: number;
  title: string;
  description: string;
  tasks: TaskItem[];
  detailedInfo: PhaseDetailedInfo;
  /** Optional: cumulative day-count-from-track-start by which this phase is recommended.
   *  Drives the "time to switch phase" banner; tracks/templates that don't set this
   *  on any phase simply never show that banner. */
  recommendedByDay?: number;
}

export interface Material {
  id: string;
  title: string;
  category: string;
  type: string;
  status: string;
  currentPage: number;
  totalPages: number;
  currentSubject: string;
  link: string;
  localPath?: string;
  repoUrl?: string;
}

export interface PortfolioProject {
  id: string;
  title: string;
  completed: boolean;
  localPath?: string;
  repoUrl?: string;
}

export interface WeekDay {
  name: string; // Mon..Sun
  type: string; // focus type key
  label: string;
}

export interface FocusType {
  label: string;
  color: string;
}

/** Per-date record of which task/revision ids were completed. */
export interface DayCompletions {
  tasks: string[];
  revisions: string[];
}

/** Item recorded in the per-date accomplishments history. Older data stored plain strings. */
export type CompletedItem = string | { title: string; description?: string };

export type DayKey = string; // "Mon".."Sun"
export type DateStr = string; // "YYYY-MM-DD"

export interface AppState {
  currentPhase: number;
  startDate: DateStr;
  currentPhaseStartDate?: DateStr;
  streakHistory: DateStr[];
  lastDailyRoutineCheck: string;
  lastTasksResetDate: DateStr | "";
  dailyFocus: Record<string, string>;
  dailyTasks: Record<DayKey, TaskItem[]>;
  dailyRevisionItems: Record<DayKey, RevisionItem[]>;
  phases: Phase[];
  portfolio: PortfolioProject[];
  materials: Material[];
  dailyStudyPoints: Record<DateStr, number>;
  completedItemsHistory: Record<DateStr, CompletedItem[]>;
  weeklyCompletions: Record<DateStr, DayCompletions>;
  studyStreak: DateStr[];
  weekSchedule?: WeekDay[];
  focusTypes?: Record<string, FocusType>;

  // Sync bookkeeping
  isSynced?: boolean;
  hasUnsyncedChanges?: boolean;
  lastSyncTime?: number;
  configVersion?: number;
  /** Per-date monotonically increasing edit counters used for day-level merging. */
  lastUpdatedDates?: Record<DateStr, number>;
  /** Transient flag set by the daily reset so the save path skips version bumps. */
  isReset?: boolean;
}

export interface GitStats {
  isRepo: boolean;
  rateLimited?: boolean;
  branch?: string;
  uncommittedCount?: number;
  lastCommitMsg?: string;
  lastCommitTime?: string;
}

export interface SyncResult {
  success: boolean;
  log: string[];
  error?: string;
  /** Token missing/expired — caller should re-authenticate and retry. */
  authRequired?: boolean;
}

// --- Multi-track workspace model ---------------------------------------
// A Workspace holds many independent Tracks (roadmaps) side by side, e.g.
// a programming track and a fitness track. Each Track owns its own phases,
// schedule, materials, portfolio, and streak data — everything that used
// to live directly on AppState. Templates only ever seed a Track's initial
// data; nothing in the app gates editability on where a track came from.

export type TrackId = string;

export interface TrackMeta {
  id: TrackId;
  name: string;
  color: string;
  /** Provenance only (e.g. "Seeded from: Fitness Template") — never gates editability. */
  templateId: string;
  createdAt: number;
  /** Tombstone for future cross-device deletion support; a track missing on one
   *  side of a merge is never treated as deleted unless explicitly archived. */
  archived?: boolean;
}

/** One independently-configured recurring item rotation, e.g. a 10-week
 *  algorithm-pattern rotation on Mon/Wed/Fri, or a reading rotation on
 *  Tue/Thu. A track can have any number of these side by side. The cycle
 *  advances once per curriculum week; `startWeek` anchors which item is
 *  "current" and is the single source of truth a manual pattern change
 *  (RotationModal) writes to, so it never drifts from the daily reset. */
export interface RotationDef {
  id: string;
  label: string;
  items: { title: string; description?: string }[];
  /** Which days this rotation's current item appears on. Subset of "Mon".."Sun". */
  daysOfWeek: string[];
  /** Which daily list the computed item is written into. */
  target: "revision" | "focus";
  startWeek: number;
  /** Free-form markdown — the reasoning/full plan behind this rotation,
   *  private to it and fully editable. Optional; shown at /roadmap?rotation=<id>. */
  explanation?: string;
}

/**
 * Everything today's AppState holds, plus track identity. `isSynced` stays
 * per-track (mirrored from Workspace.isSynced) so existing per-track UI
 * checks — WeeklyPlan's date/label placeholders, the phase-recommendation
 * gate in app/page.tsx — keep working unchanged. `hasUnsyncedChanges` and
 * `lastSyncTime` are genuinely workspace-only bookkeeping (one Drive round
 * trip covers every track), so DashboardHeader reads those off Workspace
 * instead of the active track.
 */
export interface TrackState extends Omit<AppState, "hasUnsyncedChanges" | "lastSyncTime" | "isReset"> {
  meta: TrackMeta;
  rotations?: RotationDef[];
  /** Free-form markdown — this track's own full roadmap/plan, private to it
   *  and fully editable. Never a shared/shipped file: every track has its own. */
  roadmapContent?: string;
}

/** Dashboard panel keys, grouped by column. The two columns can hold a
 *  different number of panels (they're independently-sized flex columns,
 *  not a fixed grid), so drag-and-drop uses dnd-kit's multi-container
 *  pattern rather than a single flat order. Shared across all tracks. */
export interface PanelColumns {
  left: string[];
  right: string[];
}

export interface Workspace {
  activeTrackId: TrackId;
  tracks: Record<TrackId, TrackState>;
  panelColumns?: PanelColumns;

  // Sync bookkeeping — one Drive round trip covers the whole workspace.
  isSynced?: boolean;
  hasUnsyncedChanges?: boolean;
  lastSyncTime?: number;
  /** Transient flag set by the daily reset so the save path skips version bumps. */
  isReset?: boolean;
}
