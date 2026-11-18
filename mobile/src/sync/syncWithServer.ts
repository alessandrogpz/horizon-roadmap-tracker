// Sync: the phone's copy and the account's copy, reconciled.
//
// This is deliberately thin. The server already merges two devices' data inside
// a transaction, using the very same `mergeWorkspace` that runs here — so a
// phone and a laptop ticking different boxes on the same day both keep their
// tick, and neither overwrites the other. Nothing about that had to be built
// again for mobile; the phone is simply a third device (docs/MOBILE.md §3).
//
// The counterpart on the web is lib/serverSync.ts, and the two read almost
// identically. What differs is where the session comes from (the keystore, not
// a cookie) and where the local copy lives (SQLite, not IndexedDB).

import type { Workspace } from "@shared/types";
import { migrateWorkspace } from "@shared/migrations";
import { mergeWorkspace } from "@shared/merge";
import { loadWorkspace, saveWorkspace, loadNotes, saveNote, type StoredNote } from "../storage/db";
import { authorized } from "../auth/session";

export interface SyncOutcome {
  ok: boolean;
  /** Shown to the person: one line, plain, no jargon. */
  message: string;
  workspace?: Workspace;
}

interface SyncResponse {
  workspace: Workspace;
  notes: { id: string; content: string; updatedAt: number }[];
  log: string[];
}

export async function syncWithServer(): Promise<SyncOutcome> {
  const local = await loadWorkspace();
  if (!local) return { ok: false, message: "Nothing on this device to sync yet." };

  const notes = await loadNotes();

  let response: Response;
  try {
    response = await authorized("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: local, notes }),
    });
  } catch {
    // Offline is the normal case on a phone, not an error worth alarming
    // anyone about: the app keeps working on the copy it has.
    return { ok: false, message: "No connection. Your data is safe on this phone." };
  }

  if (response.status === 401) return { ok: false, message: "Signed out. Sign in again to sync." };
  if (response.status === 429) return { ok: false, message: "Syncing too often. Try again in a minute." };
  if (!response.ok) return { ok: false, message: "The server couldn't sync right now." };

  const answer = (await response.json()) as SyncResponse;

  // An edit made while the request was in flight isn't in the server's answer,
  // so merge rather than overwrite — the same care the web client takes.
  const now = await loadWorkspace();
  const changedMeanwhile = now && JSON.stringify(now) !== JSON.stringify(local);
  const merged = changedMeanwhile ? mergeWorkspace(now, answer.workspace).data : answer.workspace;

  const workspace = migrateWorkspace(merged).workspace;
  await saveWorkspace(workspace);

  for (const note of answer.notes) {
    await saveNote(note as StoredNote);
  }

  return { ok: true, message: answer.log.at(-1) ?? "Synced.", workspace };
}
