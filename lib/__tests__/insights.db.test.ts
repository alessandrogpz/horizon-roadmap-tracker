// Search ($text) and stats (aggregation pipelines) against the local replica
// set. Data goes in through the real sync endpoint, as the app puts it there.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { mongoose } from "../server/db";
import { Session, User } from "../server/models";
import { createSession, SESSION_COOKIE } from "../server/auth/session";
import { AUDIT_LOG, COMPLETIONS, NOTES, openDb, RATE_LIMITS, TRACKS } from "../server/collections";
import { handleSyncPut } from "../server/sync/handlers";
import { handleSearch, handleStats } from "../server/insights/handlers";
import type { SearchResult } from "../server/insights/search";
import type { Stats } from "../server/insights/stats";
import { blankTrack } from "../templates";
import type { Material, Phase, TrackState, Workspace } from "../types";

const ORIGIN = "http://localhost:3007";
const db = () => mongoose.connection.db!;

async function signedIn(sub: string): Promise<string> {
  const now = new Date();
  const user = await User.create({ googleSub: sub, email: `${sub}@example.com`, name: sub, createdAt: now, lastSeenAt: now });
  return (await createSession(user._id)).token;
}

const headers = (token: string | null) => ({
  host: "localhost:3007",
  origin: ORIGIN,
  ...(token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}),
});

const material = (id: string, title: string, author?: string): Material => ({
  id, title, author, category: "", type: "", status: "", currentPage: 0, totalPages: 0, currentSubject: "", link: "",
});

interface TrackSpec {
  id: string;
  name: string;
  materials?: Material[];
  phases?: Pick<Phase, "id" | "title">[];
  roadmapContent?: string;
  /** Dates with one accomplishment each. */
  activeDays?: string[];
}

function track(spec: TrackSpec): TrackState {
  const base = blankTrack(spec.name, "2026-08-01");
  return {
    ...base,
    meta: { ...base.meta, id: spec.id },
    materials: spec.materials ?? [],
    phases: spec.phases ? spec.phases.map((p) => ({ ...base.phases[0], ...p, tasks: [] })) : base.phases,
    roadmapContent: spec.roadmapContent ?? "",
    completedItemsHistory: Object.fromEntries((spec.activeDays ?? []).map((d) => [d, [{ title: "Studied" }]])),
    historyUpdatedAt: Object.fromEntries((spec.activeDays ?? []).map((d) => [d, { Studied: 1000 }])),
  };
}

async function store(token: string, tracks: TrackSpec[], notes: { id: string; content: string }[] = []) {
  const workspace: Workspace = {
    activeTrackId: tracks[0].id,
    tracks: Object.fromEntries(tracks.map((t) => [t.id, track(t)])),
    schemaVersion: 3,
    isSynced: true,
  };
  const response = await handleSyncPut(
    new NextRequest(`${ORIGIN}/api/sync`, {
      method: "PUT",
      headers: { ...headers(token), "content-type": "application/json" },
      body: JSON.stringify({ workspace, notes: notes.map((n) => ({ ...n, updatedAt: 1000 })) }),
    })
  );
  expect(response.status).toBe(200);
}

const search = async (token: string | null, q: string) => {
  const response = await handleSearch(new NextRequest(`${ORIGIN}/api/search?q=${encodeURIComponent(q)}`, { headers: headers(token) }));
  return { status: response.status, body: (await response.json()) as SearchResult };
};

const stats = async (token: string) =>
  (await (await handleStats(new NextRequest(`${ORIGIN}/api/stats`, { headers: headers(token) }))).json()) as Stats;

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

describe("search", () => {
  let ada: string;
  beforeEach(async () => {
    ada = await signedIn("ada");
    await store(
      ada,
      [
        {
          id: "track_engine",
          name: "Engine",
          materials: [material("m_rtr", "Real-Time Rendering", "Akenine-Möller"), material("m_la", "Linear Algebra Done Right", "Axler")],
          phases: [{ id: 1, title: "Rendering basics" }],
          roadmapContent: "A year of graphics.",
        },
        { id: "track_notes", name: "Side notes", roadmapContent: "Maybe some linear programming later." },
      ],
      [
        { id: "m_rtr", content: "Chapter 5 covers shading, and the rendering pipeline end to end." },
        { id: "notepad_track_engine", content: "Buy a second monitor." },
      ]
    );
    const bob = await signedIn("bob");
    await store(bob, [{ id: "track_engine", name: "Bob's engine", materials: [material("m_x", "Rendering secrets")] }]);
  });

  it("finds materials, phases and notes, and points at what matched", async () => {
    const { status, body } = await search(ada, "rendering");
    expect(status).toBe(200);
    expect(body.tracks.map((t) => t.name)).toEqual(["Engine"]);
    expect(body.tracks[0].materials.map((m) => m.title)).toEqual(["Real-Time Rendering"]);
    expect(body.tracks[0].phases.map((p) => p.title)).toEqual(["Rendering basics"]);
    expect(body.notes).toEqual([
      expect.objectContaining({ noteId: "m_rtr", kind: "material", about: "Real-Time Rendering", snippet: expect.stringContaining("rendering pipeline") }),
    ]);
  });

  it("only ever searches the signed-in user's data (I1)", async () => {
    const { body } = await search(ada, "secrets");
    expect(body.tracks).toEqual([]);
    const all = await search(ada, "rendering");
    expect(JSON.stringify(all.body)).not.toContain("Bob");
  });

  it("stems English words: 'algebras' finds 'Algebra', 'monitors' finds 'monitor'", async () => {
    expect((await search(ada, "algebras")).body.tracks[0].materials.map((m) => m.title)).toEqual(["Linear Algebra Done Right"]);
    expect((await search(ada, "monitors")).body.notes.map((n) => n.kind)).toEqual(["notepad"]);
  });

  it("ranks by weighted relevance: a title beats a mention in the roadmap text", async () => {
    const { body } = await search(ada, "linear");
    expect(body.tracks.map((t) => t.name)).toEqual(["Engine", "Side notes"]);
    expect(body.tracks[0].score).toBeGreaterThan(body.tracks[1].score);
  });

  it("uses the compound text index, scoped to the user", async () => {
    const userId = (await User.findOne({ googleSub: "ada" }).lean())!._id;
    const plan = await db().collection(TRACKS).find({ userId, $text: { $search: "rendering" } }).explain("queryPlanner");
    expect(JSON.stringify(plan.queryPlanner.winningPlan)).toContain("user_track_text");
  });

  it("refuses empty or overlong queries, and anyone signed out", async () => {
    expect((await search(ada, "")).status).toBe(400);
    expect((await search(ada, "x".repeat(101))).status).toBe(400);
    expect((await search(null, "rendering")).status).toBe(401);
  });
});

describe("stats", () => {
  // 2026-09-01 is a Tuesday; 09-10 a Thursday.
  const engineDays = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-05", "2026-09-06"];
  const fitnessDays = ["2026-09-02", "2026-09-10"];

  it("counts distinct active days, per weekday and per track, with each track's longest streak", async () => {
    const ada = await signedIn("ada");
    await store(ada, [
      { id: "track_engine", name: "Engine", activeDays: engineDays },
      { id: "track_fitness", name: "Fitness", activeDays: fitnessDays },
    ]);
    // Bob has a track with the same id: Ada's names must still be her own.
    await store(await signedIn("bob"), [{ id: "track_engine", name: "Bob's", activeDays: ["2026-09-01"] }]);

    const result = await stats(ada);
    expect(result.totals).toMatchObject({ activeDays: 6, accomplishments: 7, firstDay: "2026-09-01", lastDay: "2026-09-10" });
    // Mon..Sun, over 09-01..09-10: Tue, Wed and Thu occur twice, the rest once.
    expect(result.byWeekday.map((w) => w.rate)).toEqual([0, 0.5, 0.5, 1, 0, 1, 1]);
    expect(result.byTrack.map((t) => [t.name, t.activeDays, t.longestStreak?.length])).toEqual([
      ["Engine", 5, 3],
      ["Fitness", 2, 1],
    ]);
    expect(result.byTrack[0].longestStreak).toEqual({ length: 3, from: "2026-09-01", to: "2026-09-03" });
    expect(result.byMonth).toEqual([{ month: "2026-09", activeDays: 6, accomplishments: 7, ticks: 0 }]);
  });

  it("finds the same longest streak as a plain loop, on random data (gaps and islands)", async () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const days: string[] = [];
    for (let i = 0; i < 365; i++) if (random() < 0.7) days.push(new Date(Date.UTC(2025, 8, 1) + i * 86_400_000).toISOString().slice(0, 10));

    let best = 0;
    let run = 0;
    let previous = -2;
    for (const d of days) {
      const n = Date.parse(d) / 86_400_000;
      run = n === previous + 1 ? run + 1 : 1;
      best = Math.max(best, run);
      previous = n;
    }

    const ada = await signedIn("ada");
    await store(ada, [{ id: "track_engine", name: "Engine", activeDays: days }]);
    expect((await stats(ada)).byTrack[0].longestStreak?.length).toBe(best);
  });
});
