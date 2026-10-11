// Central data model for the tracker. The single "current" record stored in
// IndexedDB (and, signed in, mirrored to the account's database) follows AppState.

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
  /** Author, publisher, or channel. Optional — plenty of references don't have
   *  one worth recording, and older materials predate the field. */
  author?: string;
  category: string;
  type: string;
  status: string;
  currentPage: number;
  totalPages: number;
  currentSubject: string;
  link: string;
  localPath?: string;
  repoUrl?: string;
  /** Off the active list, e.g. a finished book. Progress, notes and completion
   *  history are all kept, and unarchiving restores it as it was. Absent means
   *  active. */
  archived?: boolean;
  /** Bumped on every local edit; drives last-write-wins merging in lib/merge.ts. */
  updatedAt?: number;
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
  /**
   * A day deliberately taken off rather than a day missed.
   *
   * Rest days bridge a streak: they neither break it nor extend it (see
   * lib/restDays.ts), and the consistency grid marks them with a dot rather
   * than leaving them to read as a gap. Absent on every type written before
   * the flag existed, which is why `isRestType` falls back to the two keys
   * every template ships with — `free` and `rest`.
   */
  restDay?: boolean;
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
  /** When the *current* stretch in the current phase began. Reset every time
   *  the phase changes, which is why it cannot answer "how long have I spent
   *  in this phase" on its own — see `phaseDaysSpent`. */
  currentPhaseStartDate?: DateStr;
  /**
   * Whole days already spent in each phase, by phase id, not counting the
   * stretch running now.
   *
   * Moving between phases used to lose the time: the start date was simply
   * overwritten, so fifty days in phase one became day one again the moment
   * you looked at phase two and came back. A phase's day count is the time
   * spent in it, which is not the same as the time since you last entered it.
   *
   * Banked on leaving, so a day belongs to whichever phase was open on it and
   * is never counted twice.
   */
  phaseDaysSpent?: Record<string, number>;
  streakHistory: DateStr[];
  lastTasksResetDate: DateStr | "";
  dailyTasks: Record<DayKey, TaskItem[]>;
  dailyRevisionItems: Record<DayKey, RevisionItem[]>;
  phases: Phase[];
  portfolio: PortfolioProject[];
  materials: Material[];
  completedItemsHistory: Record<DateStr, CompletedItem[]>;
  weeklyCompletions: Record<DateStr, DayCompletions>;
  weekSchedule?: WeekDay[];
  focusTypes?: Record<string, FocusType>;

  // Carried by records written before these were retired. Nothing reads or
  // writes them; they're declared only so old data round-trips unchanged
  // and lib/workspaceRepo.ts can exclude them from config-change detection.
  /** @deprecated */ lastDailyRoutineCheck?: string;
  /** @deprecated */ dailyFocus?: Record<string, string>;
  /** @deprecated */ dailyStudyPoints?: Record<DateStr, number>;
  /** @deprecated */ studyStreak?: DateStr[];
  /** @deprecated Retired before the changelog; still on tracks created back then. */
  lastUpdatedDates?: Record<DateStr, number>;

  // Sync bookkeeping
  isSynced?: boolean;
  hasUnsyncedChanges?: boolean;
  lastSyncTime?: number;
  configVersion?: number;
  /** Per-date map of `t:<taskId>`/`r:<revisionId>` -> last-toggle timestamp (ms).
   *  Drives per-item last-write-wins merging of weeklyCompletions in lib/merge.ts,
   *  so two devices completing different checkboxes on the same day both survive
   *  a merge instead of one device's whole day silently clobbering the other's. */
  itemUpdatedAt?: Record<DateStr, Record<string, number>>;
  /** Per-date map of accomplishment title -> last-toggle timestamp (ms), the
   *  same per-item last-write-wins scheme as itemUpdatedAt but for
   *  completedItemsHistory (which also records material/portfolio completions). */
  historyUpdatedAt?: Record<DateStr, Record<string, number>>;
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
  /**
   * Where this track sits in the list, lowest first.
   *
   * Unlike a panel's position, which is per-device because the phone has one
   * column and the laptop has two, "which of my tracks comes first" is the
   * same question everywhere — so this syncs. Absent until the list is first
   * reordered, and then written onto *every* visible track at once, so the
   * list is either ordered throughout or not at all and nothing has to
   * reconcile a number against a creation date. A track made afterwards has
   * none and sorts last, which is where a new track belongs.
   */
  order?: number;
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
  /**
   * The phase this rotation belongs to, by phase id. Absent means every
   * phase, which is what every rotation written before this did and what a
   * standing weekly habit wants.
   *
   * Scoping exists because a cycle and a curriculum are different shapes. Ten
   * algorithm topics on a twenty-four week track wrap at week ten and start
   * again, so you meet the same six topics in phase one that you meet in
   * phase three — when what you wanted was to work through them once, a
   * couple per phase, and be done by the end. Four short rotations, one per
   * phase, say that; without scoping all four would run at once, which is the
   * opposite of the problem being solved.
   */
  phase?: number;
  /** Free-form markdown — the reasoning/full plan behind this rotation,
   *  private to it and fully editable. Optional; shown at /roadmap?rotation=<id>. */
  explanation?: string;
}

/**
 * Everything today's AppState holds, plus track identity. `isSynced` stays
 * per-track (mirrored from Workspace.isSynced) so existing per-track UI
 * checks — WeeklyPlan's date/label placeholders, the phase-recommendation
 * gate in app/page.tsx — keep working unchanged. `hasUnsyncedChanges` and
 * `lastSyncTime` are genuinely workspace-only bookkeeping (one sync round
 * trip covers every track), so DashboardHeader reads those off Workspace
 * instead of the active track.
 */
export interface TrackState extends Omit<AppState, "hasUnsyncedChanges" | "lastSyncTime" | "isReset"> {
  meta: TrackMeta;
  rotations?: RotationDef[];
  /** Free-form markdown — this track's own full roadmap/plan, private to it
   *  and fully editable. Never a shared/shipped file: every track has its own. */
  roadmapContent?: string;
  /** This track's own dashboard layout: the order + column placement of its
   *  *visible* modules. Per-track, so each track can arrange the board its own
   *  way. Absent on legacy tracks — seeded on load from the old workspace-level
   *  value (or the default) by fetchWorkspace's migration. */
  panelColumns?: PanelColumns;
  /** Module ids this track has closed. Closing only removes a module from the
   *  view (it's dropped from panelColumns and listed here) — the track's data
   *  behind it is never touched, so reopening restores it intact. */
  hiddenPanels?: string[];
  /**
   * When the week's days off changed, and to what.
   *
   * The track stores the week it has *now*. Without this, changing which days
   * are off re-reads the whole past under the new shape: turn Thursday from a
   * day off into a working day and every Thursday you ever took off becomes a
   * day you missed, which takes the streak with it. A schedule is a decision
   * about what comes next, not a claim about what already happened.
   *
   * Each entry is the set of weekdays off *from* that date until the next
   * entry. Appended to only when the set actually changes, so a track whose
   * week never moves carries nothing. Absent entirely on tracks that predate
   * this, which read as "it has always been what it is now" — the behaviour
   * they already had.
   */
  restDaysFrom?: { date: DateStr; days: string[] }[];
}

/** Dashboard panel keys, grouped by column. The two columns can hold a
 *  different number of panels (they're independently-sized flex columns,
 *  not a fixed grid), so drag-and-drop uses dnd-kit's multi-container
 *  pattern rather than a single flat order. Held per-track on TrackState. */
export interface PanelColumns {
  left: string[];
  right: string[];
}

export interface Workspace {
  activeTrackId: TrackId;
  tracks: Record<TrackId, TrackState>;
  /** How many of lib/migrations' steps this record has been through. Absent
   *  means "written before the pipeline existed" — treated as 0, so every
   *  step replays (they're all idempotent). See lib/migrations/index.ts. */
  schemaVersion?: number;
  /** @deprecated Legacy shared layout. Layout is now per-track
   *  (TrackState.panelColumns); this is only read once to migrate old data. */
  panelColumns?: PanelColumns;

  // Sync bookkeeping — one round trip covers the whole workspace.
  isSynced?: boolean;
  hasUnsyncedChanges?: boolean;
  lastSyncTime?: number;
  /** Transient flag set by the daily reset so the save path skips version bumps. */
  isReset?: boolean;
}
