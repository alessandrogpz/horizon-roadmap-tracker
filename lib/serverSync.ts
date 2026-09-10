// Sync through the Horizon account: the counterpart of syncWithGoogleDrive,
// returning the same SyncResult so WorkspaceProvider treats them alike.
//
// The device sends its whole workspace and every note; the server merges them
// with the account's copy inside a transaction and answers with the merged
// workspace, plus the notes this device is missing or has older copies of.

import { db } from "./localDb";
import { fetchWorkspace } from "./workspaceRepo";
import { mergeWorkspace } from "./merge";
import type { SyncResult, Workspace } from "./types";

interface SyncResponse {
  workspace: Workspace;
  notes: { id: string; content: string; updatedAt: number }[];
  log: string[];
}

export async function syncWithServer(): Promise<SyncResult> {
  const log = ["Sync started: connecting to your Horizon account..."];
  try {
    const sent = await fetchWorkspace();
    const notes = (await db.notes.toArray()).map(({ id, content, updatedAt }) => ({ id, content, updatedAt }));

    const res = await fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: sent, notes }),
    });
    if (res.status === 401) {
      return { success: false, log: [...log, "Signed out."], error: "You've been signed out. Sign in again from Settings.", authRequired: true };
    }
    if (!res.ok) {
      const { error } = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(error || `Sync failed (HTTP ${res.status}).`);
    }
    const answer = (await res.json()) as SyncResponse;
    log.push(...answer.log);

    await db.transaction("rw", db.workspace, db.notes, async () => {
      // Notes first: the Notepad and To-do panels re-read their note when the
      // workspace's lastSyncTime changes, so the notes must already be in place.
      if (answer.notes.length) await db.notes.bulkPut(answer.notes);

      // An edit made while the request was out isn't in the server's answer.
      // Merge the answer into what's here now instead of replacing it, and
      // keep the flag that says there's still something to sync.
      const now = (await db.workspace.get("current"))?.data;
      const editedMeanwhile = now && JSON.stringify(now) !== JSON.stringify(sent);
      const next = editedMeanwhile
        ? { ...mergeWorkspace(now, answer.workspace).data, hasUnsyncedChanges: true }
        : answer.workspace;
      await db.workspace.put({ id: "current", data: next });
      if (editedMeanwhile) log.push("Kept an edit made during the sync; it goes up next time.");
    });

    log.push("Sync completed successfully ✓");
    return { success: true, log };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.push(`Sync failed ✕: ${message}`);
    return { success: false, log, error: message };
  }
}
