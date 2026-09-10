// Deleting an account: the application's own cascade across every
// collection, in one transaction, against the local replica set.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { mongoose } from "../server/db";
import { Session, User } from "../server/models";
import { createSession, SESSION_COOKIE } from "../server/auth/session";
import { AUDIT_LOG, COMPLETIONS, NOTES, openDb, RATE_LIMITS, TRACKS } from "../server/collections";
import { handleSyncPut } from "../server/sync/handlers";
import { handleDeleteAccount } from "../server/account/handlers";
import { handleGetSession } from "../server/auth/handlers";
import { blankTrack } from "../templates";
import type { Workspace } from "../types";

const ORIGIN = "http://localhost:3007";
const db = () => mongoose.connection.db!;
const OWNED = [TRACKS, COMPLETIONS, NOTES, AUDIT_LOG, "sessions"];

const headers = (token: string | null, origin = ORIGIN) => ({
  host: "localhost:3007",
  origin,
  ...(token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}),
});

/** A user with a synced track, a day of progress and a note. */
async function userWithData(sub: string) {
  const now = new Date();
  const user = await User.create({ googleSub: sub, email: `${sub}@example.com`, name: sub, createdAt: now, lastSeenAt: now });
  const { token } = await createSession(user._id);
  const track = { ...blankTrack("Engine", "2026-08-01"), meta: { ...blankTrack("Engine", "2026-08-01").meta, id: "track_legacy_engine_graphics" } };
  track.completedItemsHistory = { "2026-09-01": [{ title: "Studied" }] };
  track.historyUpdatedAt = { "2026-09-01": { Studied: 1000 } };
  const workspace: Workspace = { activeTrackId: track.meta.id, tracks: { [track.meta.id]: track }, schemaVersion: 3, isSynced: true };
  const response = await handleSyncPut(
    new NextRequest(`${ORIGIN}/api/sync`, {
      method: "PUT",
      headers: { ...headers(token), "content-type": "application/json" },
      body: JSON.stringify({ workspace, notes: [{ id: "m_book", content: `${sub}'s note`, updatedAt: 1000 }] }),
    })
  );
  expect(response.status).toBe(200);
  return { token, userId: user._id };
}

const remove = (token: string | null, origin?: string) =>
  handleDeleteAccount(new NextRequest(`${ORIGIN}/api/account`, { method: "DELETE", headers: headers(token, origin) }));

const counts = async (userId: mongoose.Types.ObjectId) =>
  Object.fromEntries([
    ...(await Promise.all(OWNED.map(async (name) => [name, await db().collection(name).countDocuments({ userId })]))),
    ["users", await db().collection("users").countDocuments({ _id: userId })],
  ]);

beforeAll(async () => {
  await openDb();
  await Promise.all([User.init(), Session.init()]);
});
beforeEach(async () => {
  await Promise.all(
    [User.collection, Session.collection, ...[TRACKS, COMPLETIONS, NOTES, AUDIT_LOG, RATE_LIMITS].map((n) => db().collection(n))].map((c) =>
      c.deleteMany({})
    )
  );
});
afterAll(() => mongoose.disconnect());

describe("deleting an account", () => {
  it("removes every document the user owns, in every collection", async () => {
    const ada = await userWithData("ada");
    expect(await counts(ada.userId)).toEqual({ tracks: 1, completions: 1, notes: 1, auditLog: 1, sessions: 1, users: 1 });

    const response = await remove(ada.token);
    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie().join()).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    expect(await counts(ada.userId)).toEqual({ tracks: 0, completions: 0, notes: 0, auditLog: 0, sessions: 0, users: 0 });
  });

  it("leaves everyone else's data alone, even with the same track id", async () => {
    const ada = await userWithData("ada");
    const bob = await userWithData("bob");
    await remove(ada.token);
    expect(await counts(bob.userId)).toEqual({ tracks: 1, completions: 1, notes: 1, auditLog: 1, sessions: 1, users: 1 });
  });

  it("ends every session: the old cookie no longer signs anyone in", async () => {
    const ada = await userWithData("ada");
    await remove(ada.token);
    const who = await handleGetSession(new NextRequest(`${ORIGIN}/api/auth/session`, { headers: headers(ada.token) }));
    expect((await who.json()).account).toBeNull();
  });

  it("refuses anyone signed out (401) and other sites' pages (403, CSRF)", async () => {
    const ada = await userWithData("ada");
    expect((await remove(null)).status).toBe(401);
    expect((await remove(ada.token, "https://evil.example")).status).toBe(403);
    expect((await counts(ada.userId)).users).toBe(1);
  });
});
