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
  dsaStartWeek: number;
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
