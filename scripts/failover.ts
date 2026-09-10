// The failover demo: keeps writing while the primary is stopped, and shows
// the replica set electing a new one and the writes carrying on.
//
//   npm run demo:failover             a graceful stop (docker compose stop)
//   npm run demo:failover -- --crash  a crash (docker compose kill: no warning)
//
// Needs `npm run db:up` and Docker. Writes into a scratch collection in the
// horizon_perf database and deletes it afterwards.
//
// What to watch:
// - Every write asks for writeConcern "majority": acknowledged only once two
//   of the three members have it, so a failover can't lose it.
// - When the primary goes away, a write in flight pauses (the driver waits for
//   a new primary, then retries it once: "retryable writes") instead of failing.
// - At the end, every acknowledged write is counted back: none may be missing.

import mongoose from "mongoose";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { perfUri } from "./env";

const SERVICE_BY_PORT: Record<string, string> = { "27017": "mongo1", "27018": "mongo2", "27019": "mongo3" };
const started = Date.now();
const t = () => `${((Date.now() - started) / 1000).toFixed(1).padStart(5)} s`;
const log = (message: string) => console.log(`${t()}  ${message}`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Asynchronous on purpose: the writes must keep going while Docker stops the member.
const compose = (...args: string[]) => promisify(execFile)("docker", ["compose", ...args]);
const CRASH = process.argv.includes("--crash");

async function main() {
  await mongoose.connect(perfUri(), { serverSelectionTimeoutMS: 30_000 });
  const db = mongoose.connection.db!;
  const writes = db.collection("failover_demo");
  await writes.drop().catch(() => undefined);

  const hello = async () => (await db.admin().command({ hello: 1 })) as { primary?: string };
  const firstPrimary = (await hello()).primary!;
  const service = SERVICE_BY_PORT[firstPrimary.split(":")[1]];
  log(`Primary is ${firstPrimary} (${service}). Writing every 200 ms with writeConcern "majority"…`);

  let seq = 0;
  let acknowledged = 0;
  let failed = 0;
  let slowest = { ms: 0, seq: 0 };
  let running = true;

  const writer = (async () => {
    while (running) {
      const n = ++seq;
      const begin = Date.now();
      try {
        await writes.insertOne({ n, at: new Date() }, { writeConcern: { w: "majority", wtimeoutMS: 30_000 } });
        acknowledged += 1;
        const ms = Date.now() - begin;
        if (ms > slowest.ms) slowest = { ms, seq: n };
        if (ms > 500) log(`write #${n} took ${ms} ms: it waited for the new primary, then succeeded`);
      } catch (error) {
        failed += 1;
        log(`write #${n} FAILED: ${(error as Error).message}`);
      }
      await sleep(200);
    }
  })();

  await sleep(3_000);
  log(CRASH ? `Killing ${service} (the primary), as if it crashed…` : `Stopping ${service} (the primary) gracefully…`);
  const stopAt = Date.now();
  const stopping = compose(CRASH ? "kill" : "stop", service).then(() =>
    log(`${service} is down (${((Date.now() - stopAt) / 1000).toFixed(1)} s after the signal).`)
  );

  let newPrimary: string | undefined;
  while (!newPrimary || newPrimary === firstPrimary) {
    newPrimary = (await hello().catch(() => ({}) as { primary?: string })).primary;
    if (!newPrimary || newPrimary === firstPrimary) await sleep(250);
  }
  log(`New primary: ${newPrimary}, ${((Date.now() - stopAt) / 1000).toFixed(1)} s after the signal.`);
  await stopping;

  await sleep(5_000);
  log(`Starting ${service} again…`);
  await compose("start", service);
  // It rejoins as a secondary and copies what it missed from the new primary's oplog.
  await sleep(8_000);
  running = false;
  await writer;

  const stored = await writes.countDocuments({}, { readConcern: { level: "majority" } } as never);
  log(`Done. ${acknowledged} writes acknowledged, ${failed} failed; the slowest took ${slowest.ms} ms (#${slowest.seq}).`);
  log(`Counted back with readConcern "majority": ${stored} of ${acknowledged} acknowledged writes are there${stored >= acknowledged ? " — none lost." : ". SOME ARE MISSING."}`);
  log(`Primary now: ${(await hello()).primary}. (${service} is back as a secondary; the set doesn't switch back by itself.)`);

  await writes.drop();
  await mongoose.disconnect();
  if (failed || stored < acknowledged) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
