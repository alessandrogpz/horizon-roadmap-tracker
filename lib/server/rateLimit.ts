// Rate limiting for the account and sync routes (threat D2), counted in
// MongoDB: one small document per client per time window.
//
// Fixed windows: every request adds 1 to the counter for "this client, this
// minute" with an atomic $inc (upsert creates it on the first request), so
// two requests at once can't both read the same count. Past the limit, the
// route answers 429 with Retry-After. A TTL index deletes old windows by
// itself. It needs no extra service, and it's one more NoSQL pattern to
// point at.
//
// Clients are identified by a SHA-256 of their IP address, not the address
// itself, and the documents are gone within minutes: nothing personal is kept.

import { createHash } from "node:crypto";
import { mongoose } from "./db";
import { RATE_LIMITS } from "./collections";

export interface Limit {
  /** Which counter: requests to one route don't use up another's budget. */
  bucket: string;
  max: number;
  windowMs: number;
}

export const LIMITS = {
  /** Signing in is rare, and each attempt costs a signature check. */
  signIn: { bucket: "sign-in", max: 10, windowMs: 60_000 },
  /** Asking who's signed in, and signing out: cheap, but still a query. */
  session: { bucket: "session", max: 60, windowMs: 60_000 },
  /** A sync is the heaviest request there is. Counted per account. */
  sync: { bucket: "sync", max: 30, windowMs: 60_000 },
} satisfies Record<string, Limit>;

/**
 * The client's IP address. On Vercel, `x-real-ip` and `x-forwarded-for` are
 * set by Vercel's own edge, which overwrites whatever the client sent, so
 * they can be trusted there. Behind a proxy that passes these headers through,
 * they could be forged, and this would need revisiting.
 */
export function clientAddress(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Counts one request against `limit` for `key`, and says whether it's allowed. */
export async function hit(limit: Limit, key: string, now = Date.now()): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const windowStart = Math.floor(now / limit.windowMs) * limit.windowMs;
  const hashedKey = createHash("sha256").update(key).digest("hex").slice(0, 32);
  const counter = await mongoose.connection.db!.collection<{ _id: string; count: number; expiresAt: Date }>(RATE_LIMITS).findOneAndUpdate(
    { _id: `${limit.bucket}:${hashedKey}:${windowStart}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + 2 * limit.windowMs) } },
    { upsert: true, returnDocument: "after" }
  );
  const count = counter?.count ?? 1;
  // Logged once per client per window, on the first refusal, so a flood can't
  // also flood the logs (threat R2). The bucket only: no address.
  if (count === limit.max + 1) console.warn(`Rate limit reached: ${limit.bucket}`);
  return {
    allowed: count <= limit.max,
    retryAfterSeconds: Math.max(1, Math.ceil((windowStart + limit.windowMs - now) / 1000)),
  };
}

export const tooManyRequests = (retryAfterSeconds: number): Response =>
  Response.json(
    { error: "Too many requests. Please wait a moment." },
    { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfterSeconds) } }
  );
