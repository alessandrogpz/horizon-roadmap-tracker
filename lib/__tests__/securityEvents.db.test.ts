// The security counters, against the real database: the bucket that keeps a
// flood cheap, the summary the daily check reads, and the promise that the
// documents hold nothing personal.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { connectDb, mongoose } from "../server/db";
import { ensureCollections, SECURITY_EVENTS } from "../server/collections";
import { EVENT_KINDS, record, since } from "../server/securityEvents";
import { readJsonBody } from "../server/http";
import { z } from "zod";

const db = () => mongoose.connection.db!;
const events = () => db().collection(SECURITY_EVENTS);

beforeAll(async () => {
  await connectDb();
  await ensureCollections(db());
});
beforeEach(() => events().deleteMany({}));
afterAll(() => mongoose.disconnect());

describe("counting what the server refuses", () => {
  it("keeps one document per kind per hour, however often it happens (D2)", async () => {
    for (let i = 0; i < 25; i++) await record("sign-in-rejected");

    const stored = await events().find({}).toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0].count).toBe(25);
    expect(stored[0].kind).toBe("sign-in-rejected");
    // A row per attempt would let anyone fill the database by failing on
    // purpose. This is why the count is in the document, not the document count.
  });

  it("keeps nothing that could identify anyone (I6)", async () => {
    await record("rate-limit-reached");
    const [stored] = await events().find({}).toArray();

    expect(Object.keys(stored).sort()).toEqual(["_id", "count", "expiresAt", "firstAt", "hour", "kind", "lastAt"].sort());
    expect(String(stored._id)).toMatch(/^rate-limit-reached:\d{4}-\d{2}-\d{2}T\d{2}$/);
  });

  it("separates the kinds, and sums them for the daily check", async () => {
    await record("write-refused");
    await record("body-rejected");
    await record("body-rejected");

    const summary = await since(24);
    expect(summary.map((entry) => [entry.kind, entry.count])).toEqual([
      ["body-rejected", 2],
      ["write-refused", 1],
    ]);
  });

  it("ignores hours outside the window it was asked about", async () => {
    await record("db-unavailable");
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await events().insertOne({
      _id: "db-unavailable:old" as unknown as never,
      kind: "db-unavailable",
      hour: twoDaysAgo,
      count: 999,
      firstAt: twoDaysAgo,
      lastAt: twoDaysAgo,
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(await since(24)).toEqual([expect.objectContaining({ kind: "db-unavailable", count: 1 })]);
    expect((await since(72)).find((entry) => entry.kind === "db-unavailable")?.count).toBe(1000);
  });

  it("is raised by the code that rejects a request, not only by tests", async () => {
    const request = new NextRequest("http://localhost:3007/api/sync", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nothing: "of the expected shape" }),
    });
    const result = await readJsonBody(request, z.strictObject({ expected: z.string() }), 1000);

    expect(result.ok).toBe(false);
    // readJsonBody doesn't await the counter, so give it the tick it needs.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await since(24)).toEqual([expect.objectContaining({ kind: "body-rejected", count: 1 })]);
  });

  it("refuses a document that isn't one of ours (the validator, second layer)", async () => {
    await expect(
      events().insertOne({
        _id: "made-up:2026-09-22T10" as unknown as never,
        kind: "sign-in-rejected",
        hour: new Date(),
        count: 1,
        firstAt: new Date(),
        lastAt: new Date(),
        expiresAt: new Date(),
        email: "someone@example.com", // additionalProperties: false
      })
    ).rejects.toMatchObject({ code: 121 });
  });

  it("names every kind the code can raise", () => {
    expect(EVENT_KINDS).toEqual(["sign-in-rejected", "rate-limit-reached", "body-rejected", "write-refused", "db-unavailable"]);
  });
});
