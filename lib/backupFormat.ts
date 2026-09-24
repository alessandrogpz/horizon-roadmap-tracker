// The backup file itself: what it contains, how to read one, how to describe
// one — and nothing about where it came from.
//
// Extracted from ./export.ts and ./import.ts when the phone needed to read the
// same files. Those two modules are unavoidably platform-bound: one builds a
// Blob and clicks an invisible <a>, the other takes a browser `File` and
// writes to Dexie. None of that exists on Android, but the *format* is the
// same file, and a backup written on a laptop has to restore on a phone or it
// is not a backup.
//
// So this module holds the half that is neither: the shape, the validation,
// and the summary. It imports nothing but types — no fflate, no Dexie, no DOM
// — which is what lets React Native bundle it (the same rule the rest of the
// shared core follows).

import type { TrackState, Workspace } from "./types";

export interface BackupBundle {
  exportedAt: string;
  version: 1;
  workspace: Workspace;
  /** note id -> markdown content: material notes (keyed by material id), plus
   *  each track's notepad and to-do list (lib/quickNotes.ts). */
  notes: Record<string, string>;
}

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

/** Every backup is named the same way on every platform, so a folder holding
 *  files from a laptop and a phone sorts by date rather than by device. */
export function backupFilename(extension: "json" | "zip", now = new Date()): string {
  return `horizon-backup-${now.toISOString().slice(0, 10)}.${extension}`;
}
