// The device's own copy of the workspace, in SQLite.
//
// This is the phone's counterpart to `lib/localDb.ts`, which keeps the same
// data in IndexedDB in the browser. Two stores, mirrored deliberately so the
// sync code can stay almost identical on both platforms:
//
//   workspace  one row, holding the whole workspace as JSON
//   notes      one row per note
//
// Why one row rather than a table per kind of thing: the app reads the entire
// workspace on open and writes it whole on every edit, so splitting it would
// mean joining it back together on every screen for no gain. A year of one
// person's tracks is about 28 KB. If that access pattern ever changes — a
// phone showing one day at a time, say — the split the server already uses
// (one document per track, one per day) is the shape to copy. Writing this
// down because "why not normalise it?" is a fair question to be asked.
//
// Everything is written as it happens rather than on a timer or on close:
// Android can kill this process at any moment and gives no warning
// (MOBILE_PLAN.md §5).

import * as SQLite from "expo-sqlite";
import type { Workspace } from "@shared/types";

export interface StoredNote {
  id: string;
  content: string;
  /** The device's own clock, in ms: what the merge compares between devices. */
  updatedAt: number;
}

const DATABASE = "horizon.db";
const WORKSPACE_ROW = "current";

let handle: Promise<SQLite.SQLiteDatabase> | undefined;

/** Opens the database once per process and creates the tables if they are new.
 *  `PRAGMA journal_mode = WAL` lets a read run while a write is in flight,
 *  which matters when a sync and a tap land at the same moment. */
function open(): Promise<SQLite.SQLiteDatabase> {
  handle ??= SQLite.openDatabaseAsync(DATABASE).then(async (db) => {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS workspace (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        content TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS steps (
        date TEXT PRIMARY KEY NOT NULL,
        count INTEGER NOT NULL
      );
    `);
    return db;
  });
  return handle;
}

export async function loadWorkspace(): Promise<Workspace | null> {
  const db = await open();
  const row = await db.getFirstAsync<{ data: string }>("SELECT data FROM workspace WHERE id = ?", WORKSPACE_ROW);
  if (!row) return null;
  try {
    return JSON.parse(row.data) as Workspace;
  } catch {
    // A truncated write (a kill mid-flush on an older SQLite) shouldn't brick
    // the app: treat it as "nothing stored" and let the caller start fresh or
    // pull from the account.
    return null;
  }
}

export async function saveWorkspace(workspace: Workspace): Promise<void> {
  const db = await open();
  await db.runAsync(
    "INSERT INTO workspace (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
    WORKSPACE_ROW,
    JSON.stringify(workspace)
  );
}

export async function loadNotes(): Promise<StoredNote[]> {
  const db = await open();
  return db.getAllAsync<StoredNote>("SELECT id, content, updatedAt FROM notes");
}

export async function saveNote(note: StoredNote): Promise<void> {
  const db = await open();
  await db.runAsync(
    `INSERT INTO notes (id, content, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET content = excluded.content, updatedAt = excluded.updatedAt`,
    note.id,
    note.content,
    note.updatedAt
  );
}

// Step counts stay in their own table and are deliberately *not* part of the
// synced workspace: they are a reading from this particular phone's hardware,
// they would mean nothing merged with another device's, and the server's schema
// refuses fields it doesn't know about (learning log 13). What does sync is the
// day being marked done, which is an ordinary completion.
export async function loadStepCount(date: string): Promise<number> {
  const db = await open();
  const row = await db.getFirstAsync<{ count: number }>("SELECT count FROM steps WHERE date = ?", date);
  return row?.count ?? 0;
}

export async function saveStepCount(date: string, count: number): Promise<void> {
  const db = await open();
  await db.runAsync(
    "INSERT INTO steps (date, count) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET count = excluded.count",
    date,
    count
  );
}

/** Used by "delete local data", and by the tests. */
export async function clearAll(): Promise<void> {
  const db = await open();
  await db.execAsync("DELETE FROM workspace; DELETE FROM notes; DELETE FROM steps;");
}
