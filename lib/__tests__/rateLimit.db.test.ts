// Rate limiting against the local replica set (threat D2).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { mongoose } from "../server/db";
import { openDb, RATE_LIMITS } from "../server/collections";
import { hit, LIMITS } from "../server/rateLimit";
import { handleSignIn } from "../server/auth/handlers";
import { InvalidIdTokenError } from "../server/auth/googleIdToken";

const counters = () => mongoose.connection.db!.collection(RATE_LIMITS);
const TEST_LIMIT = { bucket: "test", max: 10, windowMs: 60_000 };

beforeAll(async () => {
  await openDb();
});
beforeEach(async () => {
  await counters().deleteMany({});
});
afterAll(() => mongoose.disconnect());

describe("hit", () => {
  it("allows up to the limit in a window, then refuses, with the seconds left", async () => {
    const now = Date.UTC(2026, 8, 10, 12, 0, 15); // 15 s into a minute
    for (let i = 0; i < 10; i++) expect((await hit(TEST_LIMIT, "client-a", now)).allowed).toBe(true);
    expect(await hit(TEST_LIMIT, "client-a", now)).toEqual({ allowed: false, retryAfterSeconds: 45 });
  });

  it("starts again in the next window", async () => {
    const now = Date.UTC(2026, 8, 10, 12, 0, 0);
    for (let i = 0; i < 11; i++) await hit(TEST_LIMIT, "client-a", now);
    expect((await hit(TEST_LIMIT, "client-a", now + 60_000)).allowed).toBe(true);
  });

  it("counts each client, and each bucket, separately", async () => {
    const now = Date.now();
    for (let i = 0; i < 11; i++) await hit(TEST_LIMIT, "client-a", now);
    expect((await hit(TEST_LIMIT, "client-b", now)).allowed).toBe(true);
    expect((await hit({ ...TEST_LIMIT, bucket: "other" }, "client-a", now)).allowed).toBe(true);
  });

  it("counts correctly under a burst of simultaneous requests (atomic $inc)", async () => {
    const now = Date.now();
    const results = await Promise.all(Array.from({ length: 20 }, () => hit(TEST_LIMIT, "burst", now)));
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    expect((await counters().findOne({}))?.count).toBe(20);
  });

  it("stores a hash of the client's address, never the address", async () => {
    await hit(TEST_LIMIT, "203.0.113.7");
    const [counter] = await counters().find().toArray();
    expect(String(counter._id)).not.toContain("203.0.113.7");
    expect(String(counter._id)).toMatch(/^test:[0-9a-f]{32}:\d+$/);
  });

  it("lets MongoDB delete old counters by itself (TTL index)", async () => {
    const indexes = await counters().indexes();
    expect(indexes.find((i) => i.key.expiresAt === 1)?.expireAfterSeconds).toBe(0);
  });
});

describe("the sign-in route", () => {
  const attempt = (ip: string) =>
    handleSignIn(
      new NextRequest("http://localhost:3007/api/auth/session", {
        method: "POST",
        headers: { host: "localhost:3007", origin: "http://localhost:3007", "content-type": "application/json", "x-real-ip": ip },
        body: JSON.stringify({ credential: "guess" }),
      }),
      { clientId: "test", verifyIdToken: async () => { throw new InvalidIdTokenError("stand-in"); } }
    );

  it(`answers 429 after ${LIMITS.signIn.max} attempts a minute from one address, with Retry-After`, async () => {
    for (let i = 0; i < LIMITS.signIn.max; i++) expect((await attempt("198.51.100.1")).status).toBe(401);
    const blocked = await attempt("198.51.100.1");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    // Someone else, at another address, is unaffected.
    expect((await attempt("198.51.100.2")).status).toBe(401);
  });
});
