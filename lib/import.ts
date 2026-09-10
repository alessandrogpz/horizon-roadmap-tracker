// Restoring a backup — the way back in for everything lib/export.ts writes out.
//
// Accepts either export format: the single `.json` bundle, or the `.zip`
// (whose database.json holds the same bundle; the broken-out .md files are
// copies of content already inside it, so they're ignored on the way back).
//
// Parsing and validation are pure and separately testable; only `restoreBackup`
// touches Dexie.

import { unzipSync, strFromU8 } from "fflate";
import type { BackupBundle } from "./export";
import type { TrackState, Workspace } from "./types";
import { db } from "./localDb";
import { migrateWorkspace } from "./migrations";

export class InvalidBackupError extends Error {}

/** What a file turned out to contain, for the confirmation step — restoring
 *  replaces everything, so the user gets to see what they're about to get. */
export interface BackupSummary {
  exportedAt: string | null;
  trackCount: number;
  trackNames: string[];
  noteCount: number;
  /** Days with at least one recorded accomplishment, across every track. */
  activeDays: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Validates the minimum a bundle must have to be restorable: a workspace whose
 * tracks are objects carrying the identity the app indexes them by. Everything
 * softer than that is left to the migration pipeline, which already repairs
 * older shapes.
 */
export function parseBackup(text: string): BackupBundle {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new InvalidBackupError("That file isn't valid JSON.");
  }
  if (!isRecord(raw)) throw new InvalidBackupError("That file doesn't contain a backup.");

  const workspace = raw.workspace;
  if (!isRecord(workspace) || !isRecord(workspace.tracks)) {
    throw new InvalidBackupError(
      "That file has no workspace in it — pick a Horizon backup (.json or .zip)."
    );
  }

  const tracks = workspace.tracks as Record<string, unknown>;
  const ids = Object.keys(tracks);
  if (ids.length === 0) {
    throw new InvalidBackupError("That backup has no tracks in it.");
  }
  for (const id of ids) {
    const track = tracks[id];
    if (!isRecord(track) || !isRecord(track.meta) || typeof track.meta.id !== "string") {
      throw new InvalidBackupError(`Track "${id}" in that backup is malformed.`);
    }
  }

  // Every note must be text, under an id like the app makes: letters, digits,
  // "_" and "-" (threat T7). A crafted file can't slip another type into the
  // notes table, and an id account sync would refuse can't break later syncs.
  const notes = isRecord(raw.notes) ? raw.notes : {};
  for (const [id, content] of Object.entries(notes)) {
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(id) || typeof content !== "string") {
      throw new InvalidBackupError("That backup has a malformed note in it.");
    }
  }

  return {
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : new Date().toISOString(),
    version: 1,
    workspace: workspace as unknown as Workspace,
    notes: notes as Record<string, string>, // checked just above
  };
}

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

export function summarizeBackup(bundle: BackupBundle): BackupSummary {
  const tracks = Object.values(bundle.workspace.tracks) as TrackState[];
  const dates = new Set<string>();
  tracks.forEach((track) => {
    Object.keys(track.completedItemsHistory || {}).forEach((date) => {
      if ((track.completedItemsHistory?.[date] || []).length > 0) dates.add(date);
    });
  });
  return {
    exportedAt: bundle.exportedAt || null,
    trackCount: tracks.length,
    trackNames: tracks.map((t) => t.meta?.name || "Untitled"),
    noteCount: Object.keys(bundle.notes || {}).length,
    activeDays: dates.size,
  };
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
    // collapsed material groups) plus the Drive/GitHub credentials and the
    // git-stats cache, which live under their own historical names.
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
