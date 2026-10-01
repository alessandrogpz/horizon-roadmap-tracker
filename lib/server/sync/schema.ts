// What a sync request may contain, down to the last field. Anything else is
// refused before it reaches the database (threats T1, T2, D1).
//
// Rules:
// - Strict objects everywhere: an unexpected key, such as a smuggled `userId`,
//   fails validation instead of being stored.
// - Keys that become MongoDB field names (weekday names, focus-type keys) must
//   be plain identifiers, so no `$` operator or `.` path can ever be written
//   as a field. Maps keyed by free text (accomplishment titles) are turned
//   into arrays of values by model.ts, so their keys never become field names.
// - Sizes are capped per field and per collection, well above real use (a
//   year of real data is about 28 KB), so one request can't fill the database.
// - Identity fields are required; the rest are optional but typed. The job here
//   is safety (shape, types, sizes, keys), not business rules, and older data
//   that lacks a newer field must still sync.

import { z } from "zod";

/** Keys stored as MongoDB field names. */
const fieldKey = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
/** Client-made ids: values, never field names. */
const id = z.string().regex(/^[A-Za-z0-9_-]{1,200}$/);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const day = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
const text = (max: number) => z.string().max(max);
const whole = z.number().int().min(0).max(1e9);
/** Milliseconds since 1970. Future values are clamped, not refused (see clampWorkspace). */
const timestamp = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

const maxKeys = <T extends z.ZodType>(record: T, max: number) =>
  record.refine((value) => Object.keys(value as object).length <= max, { message: `More than ${max} entries` });

const byDate = <T extends z.ZodType>(value: T) => maxKeys(z.record(dateKey, value), 20_000);

const TaskItem = z.strictObject({ id, title: text(2000), completed: z.boolean() });
const RevisionItem = z.strictObject({ id, title: text(2000), completed: z.boolean(), description: text(10_000).optional() });

const DetailItem = z.strictObject({ item: text(2000), desc: text(10_000) });
const Detail = z.union([z.array(DetailItem).max(200), text(50_000)]);

const Phase = z.strictObject({
  id: z.number().int(),
  title: text(2000),
  description: text(10_000).optional(),
  tasks: z.array(TaskItem).max(1000).optional(),
  detailedInfo: z
    .strictObject({ focus: Detail.optional(), deliverable: Detail.optional(), math: Detail.optional(), algoDS: Detail.optional() })
    .optional(),
  recommendedByDay: z.number().int().min(0).max(100_000).optional(),
});

const Material = z.strictObject({
  id,
  title: text(2000),
  author: text(2000).optional(),
  category: text(200).optional(),
  type: text(200).optional(),
  status: text(200).optional(),
  currentPage: whole.optional(),
  totalPages: whole.optional(),
  currentSubject: text(2000).optional(),
  link: text(4000).optional(),
  localPath: text(4000).optional(),
  repoUrl: text(4000).optional(),
  archived: z.boolean().optional(),
  updatedAt: timestamp.optional(),
});

const PortfolioProject = z.strictObject({
  id,
  title: text(2000),
  completed: z.boolean().optional(),
  localPath: text(4000).optional(),
  repoUrl: text(4000).optional(),
});

const CompletedItem = z.union([text(2000), z.strictObject({ title: text(2000), description: text(10_000).optional() })]);

const Rotation = z.strictObject({
  id,
  label: text(500),
  items: z.array(z.strictObject({ title: text(2000), description: text(10_000).optional() })).max(1000),
  daysOfWeek: z.array(day).max(7),
  target: z.enum(["revision", "focus"]),
  startWeek: z.number().int().min(-100_000).max(100_000),
  explanation: text(200_000).optional(),
});

const PanelColumns = z.strictObject({
  left: z.array(text(100)).max(100),
  right: z.array(text(100)).max(100),
});

/** Retired fields some older records still carry. Stored as they are. */
const LegacyMap = maxKeys(z.record(fieldKey, z.union([text(2000), z.number()])), 200);

/**
 * A track as a device sends it.
 *
 * Unknown keys are dropped rather than refused, and that distinction is the
 * difference between a feature landing and sync stopping. Phones update over
 * the air in minutes; the server updates when the site is deployed. So a
 * device is routinely newer than the server it talks to, and under a strict
 * object one field it has not heard of rejects the entire payload — every
 * track, every note, nothing saved. Dropping it loses that one field until the
 * deploy catches up, and loses nothing else.
 *
 * Just as safe: stripped keys never reach the database, which is what the
 * strictness was protecting. Two layers still stand behind this — the server
 * writes only fields it names, and MongoDB's own validator refuses documents
 * it does not recognise.
 */
export const TrackSchema = z.object({
  meta: z.strictObject({
    id,
    name: text(500),
    color: text(100),
    templateId: text(200),
    createdAt: timestamp,
    archived: z.boolean().optional(),
    order: z.number().int().min(0).max(1000).optional(),
  }),
  currentPhase: z.number().int().min(0).max(10_000).optional(),
  startDate: text(30).optional(),
  currentPhaseStartDate: text(30).optional(),
  phaseDaysSpent: maxKeys(z.record(fieldKey, z.number().int().min(0).max(100_000)), 500).optional(),
  streakHistory: z.array(dateKey).max(20_000).optional(),
  lastTasksResetDate: text(30).optional(),
  dailyTasks: z.partialRecord(day, z.array(TaskItem).max(500)).optional(),
  dailyRevisionItems: z.partialRecord(day, z.array(RevisionItem).max(500)).optional(),
  phases: z.array(Phase).max(500).optional(),
  portfolio: z.array(PortfolioProject).max(2000).optional(),
  materials: z.array(Material).max(5000).optional(),
  completedItemsHistory: byDate(z.array(CompletedItem).max(1000)).optional(),
  weeklyCompletions: byDate(z.strictObject({ tasks: z.array(id).max(2000), revisions: z.array(id).max(2000) })).optional(),
  weekSchedule: z.array(z.strictObject({ name: text(20), type: text(100), label: text(500) })).max(14).optional(),
  focusTypes: maxKeys(z.record(fieldKey, z.strictObject({ label: text(500), color: text(100), restDay: z.boolean().optional() })), 100).optional(),
  lastDailyRoutineCheck: text(100).optional(),
  dailyFocus: LegacyMap.optional(),
  dailyStudyPoints: LegacyMap.optional(),
  studyStreak: z.array(text(30)).max(20_000).optional(),
  // Retired long ago, and still carried by tracks made before it went. Strict
  // objects refuse anything unlisted, so a field left out here doesn't degrade
  // the sync — it stops it, for that device, for good.
  lastUpdatedDates: byDate(timestamp).optional(),
  isSynced: z.boolean().optional(),
  // mergeAppState (lib/merge.ts) stamps these onto each track too, so any
  // data that has been through a Drive or server merge carries them.
  hasUnsyncedChanges: z.boolean().optional(),
  lastSyncTime: timestamp.optional(),
  isReset: z.boolean().optional(),
  configVersion: whole.optional(),
  itemUpdatedAt: byDate(maxKeys(z.record(z.string().regex(/^[tr]:[A-Za-z0-9_-]{1,200}$/), timestamp), 4000)).optional(),
  historyUpdatedAt: byDate(maxKeys(z.record(text(2000), timestamp), 2000)).optional(),
  rotations: z.array(Rotation).max(100).optional(),
  roadmapContent: text(500_000).optional(),
  panelColumns: PanelColumns.optional(),
  hiddenPanels: z.array(text(100)).max(100).optional(),
});

/** Same reasoning as `TrackSchema`: a newer device must not be refused. */
export const WorkspaceSchema = z.object({
  activeTrackId: z.union([id, z.literal("")]),
  tracks: maxKeys(z.record(fieldKey, TrackSchema), 200),
  schemaVersion: whole.optional(),
  panelColumns: PanelColumns.optional(),
  isSynced: z.boolean().optional(),
  hasUnsyncedChanges: z.boolean().optional(),
  lastSyncTime: timestamp.optional(),
  isReset: z.boolean().optional(),
});

/** A note as the device holds it: material notes (their material's id), and
 *  each track's `notepad_<trackId>` / `todo_<trackId>`. */
export const NoteSchema = z.strictObject({ id, content: text(500_000), updatedAt: timestamp });

export const SyncRequestSchema = z.strictObject({
  workspace: WorkspaceSchema,
  notes: z.array(NoteSchema).max(10_000),
});

export type SyncRequest = z.infer<typeof SyncRequestSchema>;
export type SyncNote = z.infer<typeof NoteSchema>;

/** A whole sync body: the workspace plus every note. Real data is well under
 *  100 KB; this leaves room for years of use and stays under Vercel's 4.5 MB. */
export const MAX_SYNC_BYTES = 2 * 1024 * 1024;
