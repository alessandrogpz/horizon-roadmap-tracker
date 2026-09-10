// Sync end to end against the local replica set: the real handlers, merge,
// transactions and validators, as two devices and two users would use them.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { connectDb, mongoose } from "../server/db";
import { Session, User } from "../server/models";
import { createSession, SESSION_COOKIE } from "../server/auth/session";
import { AUDIT_LOG, COMPLETIONS, ensureSyncCollections, NOTES, TRACKS } from "../server/sync/collections";
import { handleSyncGet, handleSyncPut } from "../server/sync/handlers";
import { blankTrack } from "../templates";
import type { TrackState, Workspace } from "../types";

const ORIGIN = "http://localhost:3007";
const DAY = "2026-09-01";
const db = () => mongoose.connection.db!;

type Note = { id: string; content: string; updatedAt: number };

async function signedIn(sub: string): Promise<{ token: string; userId: mongoose.Types.ObjectId }> {
  const now = new Date();
  const user = await User.create({ googleSub: sub, email: `${sub}@example.com`, name: sub, createdAt: now, lastSeenAt: now });
  const { token } = await createSession(user._id);
  return { token, userId: user._id };
}

const request = (method: string, token: string | null, body?: unknown, origin = ORIGIN) =>
  new NextRequest(`${ORIGIN}/api/sync`, {
    method,
    headers: {
      host: "localhost:3007",
      origin,
      ...(token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function sync(token: string, workspace: Workspace, notes: Note[] = []) {
  const response = await handleSyncPut(request("PUT", token, { workspace, notes }));
  return { status: response.status, body: (await response.json()) as { workspace: Workspace; notes: Note[]; log: string[] } };
}

async function stored(token: string) {
  return (await (await handleSyncGet(request("GET", token))).json()) as { workspace: Workspace | null; notes: Note[] };
}

/** A device holding one track, already past its first edit (isSynced). */
function device(trackId = "track_shared", name = "Engine", synced = true): Workspace {
  const track: TrackState = { ...blankTrack(name, "2026-08-01"), meta: { ...blankTrack(name, "2026-08-01").meta, id: trackId } };
  return { activeTrackId: trackId, tracks: { [trackId]: track }, schemaVersion: 3, isSynced: synced };
}

/** The same device after ticking `taskId` on DAY at time `at`. */
function tick(workspace: Workspace, taskId: string, at: number): Workspace {
  const [trackId] = Object.keys(workspace.tracks);
  const track = workspace.tracks[trackId];
  const done = track.weeklyCompletions?.[DAY] ?? { tasks: [], revisions: [] };
  return {
    ...workspace,
    tracks: {
      [trackId]: {
        ...track,
        weeklyCompletions: { ...track.weeklyCompletions, [DAY]: { ...done, tasks: [...done.tasks, taskId] } },
        itemUpdatedAt: { ...track.itemUpdatedAt, [DAY]: { ...track.itemUpdatedAt?.[DAY], [`t:${taskId}`]: at } },
      },
    },
  };
}

const ticked = (workspace: Workspace | null, trackId = "track_shared") =>
  [...(workspace?.tracks[trackId]?.weeklyCompletions?.[DAY]?.tasks ?? [])].sort();

beforeAll(async () => {
  await connectDb();
  await Promise.all([User.init(), Session.init()]);
  await ensureSyncCollections(db());
});
beforeEach(async () => {
  await Promise.all(
    [User.collection, Session.collection, ...[TRACKS, COMPLETIONS, NOTES, AUDIT_LOG].map((n) => db().collection(n))].map((c) =>
      c.deleteMany({})
    )
  );
});
afterAll(() => mongoose.disconnect());

describe("who may sync", () => {
  it("nobody without a session (401)", async () => {
    const response = await handleSyncPut(request("PUT", null, { workspace: device(), notes: [] }));
    expect(response.status).toBe(401);
  });

  it("no other site's page, even with a valid session (403, CSRF)", async () => {
    const { token } = await signedIn("ada");
    const response = await handleSyncPut(request("PUT", token, { workspace: device(), notes: [] }, "https://evil.example"));
    expect(response.status).toBe(403);
    expect(await db().collection(TRACKS).countDocuments()).toBe(0);
  });
});

describe("a first sync", () => {
  it("stores the device's data, which GET then returns", async () => {
    const { token, userId } = await signedIn("ada");
    const { status, body } = await sync(token, tick(device(), "t1", 1000));
    expect(status).toBe(200);
    expect(body.log[0]).toMatch(/First sync/);
    expect(await db().collection(TRACKS).countDocuments({ userId })).toBe(1);
    expect(await db().collection(COMPLETIONS).countDocuments({ userId })).toBe(1);
    expect(ticked((await stored(token)).workspace)).toEqual(["t1"]);
  });

  it("is recorded in the audit log (R1)", async () => {
    const { token, userId } = await signedIn("ada");
    await sync(token, tick(device(), "t1", 1000));
    expect(await db().collection(AUDIT_LOG).findOne({ userId })).toMatchObject({ action: "sync", tracks: 1, days: 1 });
  });

  it("writes nothing the second time, when nothing changed", async () => {
    const { token } = await signedIn("ada");
    const first = await sync(token, tick(device(), "t1", 1000));
    const again = await sync(token, first.body.workspace);
    expect(again.body.log[1]).toMatch(/Stored 0 track\(s\), 0 day\(s\) and 0 note\(s\)/);
  });
});

describe("two devices", () => {
  it("both keep their ticks on the same day: the server merges per item", async () => {
    const { token } = await signedIn("ada");
    const base = (await sync(token, device())).body.workspace;
    await sync(token, tick(base, "from-laptop", 1000));
    const phone = await sync(token, tick(base, "from-phone", 2000));
    expect(ticked(phone.body.workspace)).toEqual(["from-laptop", "from-phone"]);
    expect(ticked((await stored(token)).workspace)).toEqual(["from-laptop", "from-phone"]);
  });

  it("syncing at the very same moment still loses nothing (T4: transactions)", async () => {
    const { token } = await signedIn("ada");
    const base = (await sync(token, device())).body.workspace;
    const results = await Promise.all([sync(token, tick(base, "laptop", 1000)), sync(token, tick(base, "phone", 2000))]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(ticked((await stored(token)).workspace)).toEqual(["laptop", "phone"]);
  });

  it("a brand-new device with only its starter track takes the account's data instead", async () => {
    const { token } = await signedIn("ada");
    await sync(token, tick(device("track_real", "Real track"), "t1", 1000));
    const fresh = await sync(token, device("track_starter", "My Track", false));
    expect(fresh.body.log[0]).toMatch(/loaded the account's/);
    expect(Object.keys(fresh.body.workspace.tracks)).toEqual(["track_real"]);
    expect(await db().collection(TRACKS).countDocuments({ trackId: "track_starter" })).toBe(0);
  });
});

describe("two users (I1)", () => {
  it("never see or touch each other's data, even with the same track id", async () => {
    // Every migrated legacy workspace has this id, so collisions are real.
    const legacyId = "track_legacy_engine_graphics";
    const ada = await signedIn("ada");
    const bob = await signedIn("bob");
    await sync(ada.token, tick(device(legacyId, "Ada's"), "ada-task", 1000));
    await sync(bob.token, tick(device(legacyId, "Bob's"), "bob-task", 1000));

    const adaView = (await stored(ada.token)).workspace!;
    const bobView = (await stored(bob.token)).workspace!;
    expect(adaView.tracks[legacyId].meta.name).toBe("Ada's");
    expect(bobView.tracks[legacyId].meta.name).toBe("Bob's");
    expect(ticked(adaView, legacyId)).toEqual(["ada-task"]);
    expect(ticked(bobView, legacyId)).toEqual(["bob-task"]);
    expect(await db().collection(TRACKS).countDocuments({ userId: ada.userId })).toBe(1);
    expect(await db().collection(TRACKS).countDocuments({ userId: bob.userId })).toBe(1);
  });

  it("can't write to someone else's account by naming them in the body (T2)", async () => {
    const ada = await signedIn("ada");
    const bob = await signedIn("bob");
    const response = await handleSyncPut(
      request("PUT", ada.token, { workspace: device(), notes: [], userId: bob.userId.toString() })
    );
    expect(response.status).toBe(400);
    expect(await db().collection(TRACKS).countDocuments()).toBe(0);
  });
});

describe("notes", () => {
  it("newest copy wins, per note, both ways", async () => {
    const { token } = await signedIn("ada");
    await sync(token, device(), [
      { id: "m_book", content: "laptop, older", updatedAt: 100 },
      { id: "notepad_track_shared", content: "laptop notepad", updatedAt: 300 },
    ]);
    const phone = await sync(token, device(), [{ id: "m_book", content: "phone, newer", updatedAt: 200 }]);
    // The phone had the newer book note, and lacked the notepad: it gets the notepad back.
    expect(phone.body.notes).toEqual([{ id: "notepad_track_shared", content: "laptop notepad", updatedAt: 300 }]);

    const late = await sync(token, device(), [{ id: "m_book", content: "stale copy", updatedAt: 150 }]);
    expect(late.body.notes).toEqual(
      expect.arrayContaining([{ id: "m_book", content: "phone, newer", updatedAt: 200 }])
    );
    const notes = await db().collection(NOTES).find({}, { projection: { _id: 0, noteId: 1, kind: 1, content: 1 } }).toArray();
    expect(notes).toEqual(
      expect.arrayContaining([
        { noteId: "m_book", kind: "material", content: "phone, newer" },
        { noteId: "notepad_track_shared", kind: "notepad", content: "laptop notepad" },
      ])
    );
  });
});

describe("timestamps from the future (T3)", () => {
  it("are clamped to about now, so they can't win every later merge", async () => {
    const { token } = await signedIn("ada");
    const nextYear = Date.now() + 365 * 24 * 60 * 60 * 1000;
    await sync(token, tick(device(), "t1", nextYear));
    const day = await db().collection(COMPLETIONS).findOne({ date: DAY });
    expect(day!.tasks[0].updatedAt).toBeLessThan(Date.now() + 6 * 60 * 1000);
  });
});

describe("the database's own validators (second layer)", () => {
  it("refuse a completions document the server would never write", async () => {
    const { userId } = await signedIn("ada");
    await expect(
      db().collection(COMPLETIONS).insertOne({
        userId, trackId: "track_x", date: "yesterday", tasks: [], revisions: [], accomplishments: [], updatedAt: new Date(),
      })
    ).rejects.toMatchObject({ code: 121 }); // DocumentValidationFailure
    await expect(
      db().collection(COMPLETIONS).insertOne({
        userId, trackId: "track_x", date: DAY, tasks: [{ id: "a", done: "yes", updatedAt: 1 }], revisions: [], accomplishments: [], updatedAt: new Date(),
      })
    ).rejects.toMatchObject({ code: 121 });
  });
});
