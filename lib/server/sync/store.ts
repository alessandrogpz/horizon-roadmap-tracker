// Reads and writes one user's synced data. Everything runs inside a
// transaction (see inTransaction), so a sync either lands completely or not
// at all, and two devices syncing at once can't overwrite each other.
//
// Tracks and completions go through the native driver: a sync replaces whole
// documents in bulk, which is what bulkWrite is for, and MongoDB's $jsonSchema
// validators check them. Notes go through their Mongoose model, which casts
// and checks every value. Both use the same session, so they commit together.
//
// Every filter here holds the signed-in user's id, which comes from the
// session and never from the request (threat I1). The native driver doesn't
// get Mongoose's sanitizeFilter, so the only other values in filters are ids
// that already passed the zod schema.

import type { mongo } from "mongoose";
import { mongoose } from "../db";
import { Note } from "../models";
import { AUDIT_LOG, COMPLETIONS, NOTES, TRACKS } from "../collections";
import { splitWorkspace, stableStringify, type StoredDay, type StoredTrack } from "./model";
import type { SyncNote } from "./schema";
import type { Workspace } from "../../types";

type ObjectId = mongoose.Types.ObjectId;
type Session = mongo.ClientSession;

export interface StoredNote {
  noteId: string;
  content: string;
  updatedAt: number;
}

export interface UserData {
  tracks: StoredTrack[];
  days: StoredDay[];
  notes: StoredNote[];
  activeTrackId?: string;
}

const db = () => mongoose.connection.db!;

/**
 * Runs `work` in a transaction with snapshot reads and majority-acknowledged
 * commits. If another transaction changed a document this one also writes, the
 * commit fails with a transient error and the driver runs `work` again, so it
 * re-reads the newer data and merges with that instead (threat T4).
 */
export async function inTransaction<T>(work: (session: Session) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(work, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      readPreference: "primary",
    });
  } finally {
    await session.endSession();
  }
}

// Reads run one after another: a transaction's operations mustn't overlap.
export async function loadUserData(userId: ObjectId, session?: Session): Promise<UserData> {
  const hidden = { _id: 0, userId: 0, updatedAt: 0 };
  const tracks = (await db().collection(TRACKS).find({ userId }, { session, projection: hidden }).toArray()) as unknown as StoredTrack[];
  const days = (await db()
    .collection(COMPLETIONS)
    .find({ userId }, { session, projection: hidden, sort: { trackId: 1, date: 1 } })
    .toArray()) as unknown as StoredDay[];
  const notes = (await db()
    .collection(NOTES)
    .find({ userId }, { session, projection: { _id: 0, noteId: 1, content: 1, updatedAt: 1 } })
    .toArray()) as unknown as StoredNote[];
  const user = await db().collection("users").findOne({ _id: userId }, { session, projection: { activeTrackId: 1 } });
  return { tracks, days, notes, activeTrackId: user?.activeTrackId as string | undefined };
}

export interface SaveResult {
  tracksWritten: number;
  daysWritten: number;
  notesWritten: number;
  /** Notes the device doesn't have, or has an older copy of. */
  notesForDevice: SyncNote[];
}

const noteKind = (noteId: string) =>
  noteId.startsWith("notepad_") ? "notepad" : noteId.startsWith("todo_") ? "todo" : "material";
const noteTrack = (noteId: string) => noteId.match(/^(?:notepad|todo)_(.+)$/)?.[1];

/**
 * Writes the merged workspace and the device's notes. Only documents whose
 * content changed are written: a sync with nothing new writes nothing.
 */
/** BSON has no `undefined`: the driver stores an explicit `undefined` field as
 *  `null`, which a validator expecting a number or a string then refuses. The
 *  documents here are built by merging data of every age, so a key can arrive
 *  set-but-undefined. Absent is what the schema means by optional, so absent is
 *  what gets written. Filters are never passed through this — dropping a key
 *  from a filter would widen it, and every filter here scopes a query to one
 *  user (threat I1). */
function written<T>(document: T): T {
  if (Array.isArray(document)) return document.map(written) as T;
  if (document === null || typeof document !== "object" || document instanceof Date || document instanceof mongoose.Types.ObjectId)
    return document;
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(document)) {
    if (value !== undefined) kept[key] = written(value);
  }
  return kept as T;
}

export async function saveUserData(
  userId: ObjectId,
  merged: Workspace,
  before: UserData,
  deviceNotes: SyncNote[],
  session: Session,
  now: number
): Promise<SaveResult> {
  const updatedAt = new Date(now);
  const next = splitWorkspace(merged);

  const oldTracks = new Map(before.tracks.map((t) => [t.trackId, stableStringify(t)]));
  const trackOps = next.tracks
    .filter((t) => oldTracks.get(t.trackId) !== stableStringify(t))
    .map((t) => ({
      replaceOne: { filter: { userId, trackId: t.trackId }, replacement: written({ ...t, userId, updatedAt }), upsert: true },
    }));

  const dayKey = (d: StoredDay) => `${d.trackId}|${d.date}`;
  const oldDays = new Map(before.days.map((d) => [dayKey(d), stableStringify(d)]));
  const dayOps = next.days
    .filter((d) => oldDays.get(dayKey(d)) !== stableStringify(d))
    .map((d) => ({
      replaceOne: { filter: { userId, trackId: d.trackId, date: d.date }, replacement: written({ ...d, userId, updatedAt }), upsert: true },
    }));

  if (trackOps.length) await db().collection(TRACKS).bulkWrite(trackOps, { session, ordered: true });
  if (dayOps.length) await db().collection(COMPLETIONS).bulkWrite(dayOps, { session, ordered: true });

  // Notes: last write wins, per note, on the devices' own timestamps.
  const storedNotes = new Map(before.notes.map((n) => [n.noteId, n]));
  const noteOps = deviceNotes
    .filter((n) => {
      const stored = storedNotes.get(n.id);
      return !stored || n.updatedAt > stored.updatedAt;
    })
    .map((n) => {
      const trackId = noteTrack(n.id);
      return {
        updateOne: {
          filter: { userId, noteId: n.id },
          update: { $set: written({ kind: noteKind(n.id), content: n.content, updatedAt: n.updatedAt, ...(trackId ? { trackId } : {}) }) },
          upsert: true,
        },
      };
    });
  if (noteOps.length) await Note.bulkWrite(noteOps, { session, ordered: true });

  const onDevice = new Map(deviceNotes.map((n) => [n.id, n]));
  const notesForDevice = before.notes
    .filter((stored) => {
      const device = onDevice.get(stored.noteId);
      return !device || stored.updatedAt > device.updatedAt;
    })
    .map((n) => ({ id: n.noteId, content: n.content, updatedAt: n.updatedAt }));

  if (merged.activeTrackId && merged.activeTrackId !== before.activeTrackId) {
    await db().collection("users").updateOne({ _id: userId }, { $set: { activeTrackId: merged.activeTrackId } }, { session });
  }

  const result = { tracksWritten: trackOps.length, daysWritten: dayOps.length, notesWritten: noteOps.length, notesForDevice };
  if (result.tracksWritten || result.daysWritten || result.notesWritten) {
    await db().collection(AUDIT_LOG).insertOne(
      { userId, at: updatedAt, action: "sync", tracks: result.tracksWritten, days: result.daysWritten, notes: result.notesWritten },
      { session }
    );
  }
  return result;
}
