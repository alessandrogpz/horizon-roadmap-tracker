// The sync API, /api/sync:
//   GET  the signed-in user's stored workspace and notes
//   PUT  send this device's workspace and notes; the server merges them with
//        what it has, stores the result, and sends back the merged workspace
//        plus any notes the device is missing
//
// The merge runs on the server, inside a transaction, with the same
// mergeWorkspace every client uses, so two devices syncing at once can't
// overwrite each other (threat T4).

import type { NextRequest } from "next/server";
import { record } from "../securityEvents";
import { errorResponse, isSameOrigin, jsonResponse, readJsonBody } from "../http";
import { findSessionUser, sessionTokenFrom } from "../auth/session";
import type { UserRecord } from "../models";
import { openDb } from "../collections";
import { hit, LIMITS, tooManyRequests } from "../rateLimit";
import { assembleWorkspace, clampWorkspace, markSynced } from "./model";
import { MAX_SYNC_BYTES, SyncRequestSchema, type SyncNote } from "./schema";
import { inTransaction, loadUserData, saveUserData } from "./store";
import { migrateWorkspace } from "../../migrations";
import { mergeWorkspace } from "../../merge";
import type { Workspace } from "../../types";

/** The signed-in user, from the session cookie. Every sync query is scoped
 *  to this user's id, and nothing in a request can change which user that is
 *  (threats I1, T2). */
export const requireUser = (request: NextRequest): Promise<UserRecord | null> =>
  findSessionUser(sessionTokenFrom(request));

/** A bulk write that the database refused, said in field names only. A
 *  validation failure names the rules that weren't satisfied and the property
 *  each one belongs to; the values stay out of the log (threat I6). */
interface RefusedWrite {
  err?: {
    code?: number;
    errInfo?: { details?: { schemaRulesNotSatisfied?: { propertyName?: string; operatorName?: string }[] } };
  };
}

const writeDetail = (error: unknown): string => {
  const failures = (error as { writeErrors?: RefusedWrite[] }).writeErrors?.slice(0, 3) ?? [];
  if (!failures.length) return "";
  const said = failures.map(({ err }) => {
    const named = (err?.errInfo?.details?.schemaRulesNotSatisfied ?? [])
      .flatMap((rule) => [rule.propertyName, rule.operatorName].filter(Boolean))
      .slice(0, 6)
      .join("/");
    return `${err?.code ?? "?"}${named ? ` (${named})` : ""}`;
  });
  return ` — refused writes: ${said.join(", ")}`;
};

const unavailable = (error: unknown): Response => {
  const name = error instanceof Error ? error.name : "unknown error";
  const refused = writeDetail(error);
  console.error(`Sync unavailable: ${name}${refused}`);
  void record(refused ? "write-refused" : "db-unavailable");
  return errorResponse(503, "Sync isn't available right now.");
};

const assembled = (data: Awaited<ReturnType<typeof loadUserData>>): Workspace | null =>
  data.tracks.length ? migrateWorkspace(assembleWorkspace(data.tracks, data.days, data.activeTrackId)).workspace : null;

export async function handleSyncGet(request: NextRequest): Promise<Response> {
  try {
    await openDb();
    const user = await requireUser(request);
    if (!user) return errorResponse(401, "Sign in to sync.");
    const limited = await hit(LIMITS.sync, user._id.toString());
    if (!limited.allowed) return tooManyRequests(limited.retryAfterSeconds);
    const data = await loadUserData(user._id);
    return jsonResponse({
      workspace: assembled(data),
      notes: data.notes.map((n) => ({ id: n.noteId, content: n.content, updatedAt: n.updatedAt })),
    });
  } catch (error) {
    return unavailable(error);
  }
}

export type SyncMode = "first" | "adopt" | "merge";

export async function handleSyncPut(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) return errorResponse(403, "Forbidden.");

  try {
    await openDb();
    const user = await requireUser(request);
    if (!user) return errorResponse(401, "Sign in to sync.");
    // Per account: a sync is the heaviest request there is (threat D2).
    const limited = await hit(LIMITS.sync, user._id.toString());
    if (!limited.allowed) return tooManyRequests(limited.retryAfterSeconds);

    const body = await readJsonBody(request, SyncRequestSchema, MAX_SYNC_BYTES);
    if (!body.ok) return body.response;
    // A track's map key is its id; one pretending to be another is refused.
    for (const [key, track] of Object.entries(body.data.workspace.tracks)) {
      if (track.meta.id !== key) return errorResponse(400, "Malformed request.");
    }

    const now = Date.now();
    // An older device may send an older shape: bring it up to date first,
    // then pull any timestamps from the future back to now (threat T3).
    const device = clampWorkspace(migrateWorkspace(body.data.workspace as Workspace).workspace, now);
    const deviceNotes: SyncNote[] = body.data.notes.map((n) => ({ ...n, updatedAt: Math.min(n.updatedAt, now + 5 * 60 * 1000) }));

    const outcome = await inTransaction(async (session) => {
      const before = await loadUserData(user._id, session);
      const stored = assembled(before);

      let mode: SyncMode;
      let merged: Workspace;
      if (!stored) {
        // A new account: this device's data becomes the account's.
        mode = "first";
        merged = markSynced(device, now);
      } else if (!device.isSynced) {
        // This device has only an untouched starter track: replace it with the
        // account's data instead of merging a stray "My Track" into it (the
        // same rule the client follows, see lib/workspaceRepo.ts ensureStarterTrack).
        mode = "adopt";
        merged = markSynced(stored, now);
      } else {
        mode = "merge";
        // Device first: it keeps the semantics the device-side sync already had.
        merged = mergeWorkspace(device, stored).data;
      }

      const saved = await saveUserData(user._id, merged, before, deviceNotes, session, now);
      return { mode, merged, saved };
    });

    const { mode, merged, saved } = outcome;
    return jsonResponse({
      workspace: merged,
      notes: saved.notesForDevice,
      log: [
        mode === "first"
          ? "First sync for this account: stored this device's data."
          : mode === "adopt"
            ? "This device had no data of its own yet: loaded the account's."
            : "Merged this device's changes with the account's.",
        `Stored ${saved.tracksWritten} track(s), ${saved.daysWritten} day(s) and ${saved.notesWritten} note(s); sent back ${saved.notesForDevice.length} note(s).`,
      ],
    });
  } catch (error) {
    return unavailable(error);
  }
}
