// Restoring a backup — the way back in for everything lib/export.ts writes out.
//
// Accepts either export format: the single `.json` bundle, or the `.zip`
// (whose database.json holds the same bundle; the broken-out .md files are
// copies of content already inside it, so they're ignored on the way back).
//
// Parsing and validation are pure, live in ./backupFormat.ts so React Native
// can bundle them, and are re-exported below; what stays here is the part that
// only a browser can do — reading a `File`, unzipping it — and the part that
// only this platform's storage can do, writing to Dexie.

import { unzipSync, strFromU8 } from "fflate";
import {
  InvalidBackupError,
  parseBackup,
  summarizeBackup,
  type BackupBundle,
  type BackupSummary,
} from "./backupFormat";
import { db } from "./localDb";
import { migrateWorkspace } from "./migrations";

// The parsing and the summary are shared with the phone, which restores the
// same files; re-exported here so every caller still has one place to import
// "restoring a backup" from.
export { InvalidBackupError, parseBackup, summarizeBackup };
export type { BackupSummary };

/** Pulls the bundle out of whichever export format the file is. */
export async function readBackupFile(file: File): Promise<BackupBundle> {
  if (file.name.toLowerCase().endsWith(".zip")) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(buffer);
    } catch {
      throw new InvalidBackupError("That .zip couldn't be opened.");
    }
    const entry = entries["database.json"];
    if (!entry) {
      throw new InvalidBackupError("That .zip has no database.json — is it a Horizon backup?");
    }
    return parseBackup(strFromU8(entry));
  }
  return parseBackup(await file.text());
}

/**
 * Replaces this device's workspace and notes with the backup's.
 *
 * Replace, not merge: a restore is "put it back the way it was", and a merge
 * would need per-item timestamps the file may predate. The workspace goes
 * through the migration pipeline on the way in, so an old backup lands at the
 * current schema exactly as data pulled from Drive does.
 *
 * The caller is responsible for confirming first — this is destructive — and
 * for reloading the provider afterwards.
 */
export async function restoreBackup(bundle: BackupBundle): Promise<void> {
  const { workspace } = migrateWorkspace(bundle.workspace);

  await db.transaction("rw", db.workspace, db.notes, async () => {
    await db.workspace.put({ id: "current", data: workspace });
    await db.notes.clear();
    const now = Date.now();
    const records = Object.entries(bundle.notes || {}).map(([id, content]) => ({
      id,
      content,
      updatedAt: now,
    }));
    if (records.length > 0) await db.notes.bulkPut(records);
  });
}

/** Wipes every trace of the app from this device: the database and the
 *  localStorage keys the app owns. Used by Settings' danger zone; the caller
 *  reloads afterwards so the app comes back up empty. */
export async function wipeLocalData(): Promise<void> {
  await db.transaction("rw", db.workspace, db.notes, db.appState, async () => {
    await db.workspace.clear();
    await db.notes.clear();
    await db.appState.clear();
  });
  try {
    // Everything the app owns: its own `horizon-*` keys (settings, theme,
    // collapsed material groups), the GitHub token and git-stats cache, and the
    // Google Drive keys — Drive sync was removed in 0.32.0, but a device that
    // used it still has its tokens sitting here, and "delete local data" should
    // mean all of it.
    const named = [
      "google_drive_client_id",
      "google_drive_access_token",
      "google_drive_token_expiry",
      "github_token",
      "github_git_stats_cache",
    ];
    const owned = Object.keys(window.localStorage).filter((key) => key.startsWith("horizon"));
    [...named, ...owned].forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Private mode — nothing was persisted to clear.
  }
}
