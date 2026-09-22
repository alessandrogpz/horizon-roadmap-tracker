// The daily look at the live database: is anything out of character?
//
//   npm run ops:check                      the local database
//   npm run ops:check -- --uri-env ATLAS_URI   the deployed one
//
// Run by .github/workflows/ops.yml every morning. It prints what the last day
// held and exits non-zero when a counter is over its threshold, which fails the
// workflow run, which is what actually reaches a human: GitHub emails the owner.
// That is the whole alerting chain, and it needs no third-party service, no
// paid log drain and no secret beyond the connection string.
//
// The counters come from the securityEvents collection (lib/server/
// securityEvents.ts): a count per kind per hour, with nothing personal in them.
//
// The thresholds below are "louder than a normal day, quieter than a real
// problem". They are judgements, not measurements, and worth revisiting once
// there is a month of real numbers to look at.

import mongoose from "mongoose";
import { arg, loadEnvLocal } from "./env";
import { EVENT_KINDS, since, type EventKind } from "../lib/server/securityEvents";

/** Per day. Over this, the run fails and an email goes out. */
const THRESHOLDS: Record<EventKind, number> = {
  // A handful a day is ordinary: an expired token, a stale tab, someone
  // signing in on a bad connection. Fifty means someone is trying tokens.
  "sign-in-rejected": 50,
  // Reaching a limit is the system working. Reaching it constantly is either
  // an attack or a limit set too low (threat D2).
  "rate-limit-reached": 100,
  // The app's own client never sends a body that fails validation, so these
  // are either someone poking at the API or a bug in a released version —
  // the 0.21.4 one looked exactly like this.
  "body-rejected": 50,
  // The database refusing a write the server made is always a bug. One is
  // worth an email; that is how 0.21.6 would have announced itself.
  "write-refused": 0,
  // Atlas being unreachable. A couple can happen; a stream cannot.
  "db-unavailable": 5,
};

const HOURS = 24;

async function main() {
  loadEnvLocal();
  const variable = arg("uri-env", "MONGODB_URI");
  const uri = process.env[variable];
  if (!uri) throw new Error(`${variable} isn't set.`);

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
  const db = mongoose.connection.db!;

  const counts = new Map((await since(HOURS)).map((entry) => [entry.kind, entry]));
  const [users, sessions, tracks, days] = await Promise.all(
    ["users", "sessions", "tracks", "completions"].map((name) => db.collection(name).estimatedDocumentCount())
  );

  console.log(`Horizon, the last ${HOURS} hours\n`);
  console.log(`  accounts ${users}, signed-in browsers ${sessions}, tracks ${tracks}, days of progress ${days}\n`);

  const over: string[] = [];
  for (const kind of EVENT_KINDS) {
    const seen = counts.get(kind);
    const count = seen?.count ?? 0;
    const limit = THRESHOLDS[kind];
    const past = count > limit;
    if (past) over.push(`${kind}: ${count} (threshold ${limit})`);
    const when = seen ? `, last at ${seen.lastAt.toISOString().replace("T", " ").slice(0, 16)}` : "";
    console.log(`  ${past ? "OVER " : "     "}${kind.padEnd(20)} ${String(count).padStart(5)}  of ${limit}${when}`);
  }

  await mongoose.disconnect();

  if (over.length) {
    console.error(`\nSomething is out of character:\n  ${over.join("\n  ")}`);
    console.error("\nWhat to do: docs/security/RUNBOOK.md §7.");
    process.exitCode = 1;
    return;
  }
  console.log("\nNothing out of character.");
}

main().catch((error) => {
  console.error("The check itself failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
