// Counting what the server refuses, so someone can notice.
//
// The routes already log a line whenever they reject something: a signature
// that doesn't verify, a client past its rate limit, a body that fails
// validation, a write the database refuses. On Vercel's free plan those lines
// are readable in the dashboard and nowhere else — nothing can act on them, and
// nobody reads a dashboard at three in the morning. So each one also raises a
// counter here, and `npm run ops:check` reads the counters on a schedule and
// fails loudly when a number is out of character (see .github/workflows/ops.yml).
//
// One document per kind per hour, with an atomic $inc:
//
//   { _id: "sign-in-rejected:2026-09-22T14", kind, hour, count, firstAt, lastAt }
//
// That matters for a counter of failures. A row per event would let anyone
// with a script fill the database by failing on purpose (threat D2); an hourly
// bucket costs one document an hour however hard someone tries. It's the same
// pattern the day-by-day progress data uses, for the same reason.
//
// What's deliberately not here: no address, no account, no email, no value from
// the request — only that something of a given kind happened, and how often
// (threat I6). A TTL index deletes each bucket after 30 days.

import { mongoose } from "./db";
import { SECURITY_EVENTS } from "./collections";

export const EVENT_KINDS = [
  /** A Google ID token that didn't verify: bad signature, wrong audience, expired. */
  "sign-in-rejected",
  /** A client asked more often than its budget allows. */
  "rate-limit-reached",
  /** A request body that failed validation. */
  "body-rejected",
  /** The database refused a write the server tried to make. */
  "write-refused",
  /** A route couldn't reach the database at all. */
  "db-unavailable",
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

const KEEP_DAYS = 30;

/** The hour a moment belongs to, as a Date: the bucket's key and its index. */
const hourOf = (at: Date): Date => new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), at.getUTCHours()));

/**
 * Counts one occurrence. The promise it returns never rejects, and callers
 * don't await it: a failure here must not turn a handled rejection into a
 * broken request, and the most likely reason for it to fail — the database
 * being unreachable — is itself one of the things being counted. The tests
 * await it, which is the only reason it is returned at all.
 */
export function record(kind: EventKind): Promise<void> {
  const at = new Date();
  const hour = hourOf(at);
  const expiresAt = new Date(hour.getTime() + KEEP_DAYS * 24 * 60 * 60 * 1000);

  const collection = mongoose.connection.db?.collection(SECURITY_EVENTS);
  if (!collection) return Promise.resolve();

  return collection
    .updateOne(
      { _id: `${kind}:${hour.toISOString().slice(0, 13)}` as unknown as never },
      { $inc: { count: 1 }, $set: { lastAt: at }, $setOnInsert: { kind, hour, firstAt: at, expiresAt } },
      { upsert: true }
    )
    .then(() => undefined)
    .catch(() => undefined);
}

export interface EventCount {
  kind: string;
  count: number;
  lastAt: Date;
}

/** What happened in the last `hours` hours, most frequent first. Used by the
 *  scheduled check, and by anyone looking into an incident (RUNBOOK §6). */
export async function since(hours: number): Promise<EventCount[]> {
  const from = new Date(Date.now() - hours * 60 * 60 * 1000);
  const db = mongoose.connection.db;
  if (!db) return [];
  return db
    .collection(SECURITY_EVENTS)
    .aggregate<EventCount>([
      { $match: { hour: { $gte: hourOf(from) } } },
      { $group: { _id: "$kind", count: { $sum: "$count" }, lastAt: { $max: "$lastAt" } } },
      { $project: { _id: 0, kind: "$_id", count: 1, lastAt: 1 } },
      { $sort: { count: -1 } },
    ])
    .toArray();
}
