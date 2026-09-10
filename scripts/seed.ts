// Generates a large, realistic dataset in the `horizon_perf` database, for
// measuring the model at scale (npm run db:explain) and for the NoSQL docs.
//
//   npm run db:seed                      2,000 users, a year each
//   npm run db:seed -- --users 5000 --days 365 --seed 7
//
// Reproducible: a fixed random seed gives the same data every time (ids
// included), so the numbers in docs/nosql/ can be regenerated exactly.
//
// Realistic: each user gets 1-3 tracks built by the app's own templates, and
// a year of days shaped like real habits: a personal baseline, quieter
// weekends, momentum (an active day makes the next one likelier), and lapses
// of several days. Documents are produced by the same splitWorkspace the
// server uses, so they have exactly the real model's shape, and the
// collection validators check every one on the way in.

import mongoose from "mongoose";
import { writeFileSync, mkdirSync } from "node:fs";
import { arg, perfUri } from "./env";
import { ensureCollections, COMPLETIONS, NOTES, TRACKS, AUDIT_LOG, RATE_LIMITS } from "../lib/server/collections";
import { splitWorkspace } from "../lib/server/sync/model";
import { Session, User } from "../lib/server/models";
import { seedTrackFromTemplate, TEMPLATE_LIST } from "../lib/templates";
import type { Material, TrackState, Workspace } from "../lib/types";

const USERS = Number(arg("users", "2000"));
const DAYS = Number(arg("days", "365"));
const SEED = Number(arg("seed", "42"));
/** The last generated day. Fixed, not "today", so a rerun is identical. */
const END = arg("end", "2026-09-01");

// ── Deterministic randomness (mulberry32) ─────────────────────────────────
let state = SEED >>> 0;
function random(): number {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (min: number, max: number) => min + random() * (max - min);
const int = (min: number, max: number) => Math.floor(between(min, max + 1));
const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
const hex = (n: number) => Array.from({ length: n }, () => Math.floor(random() * 16).toString(16)).join("");

// ── Content: real book titles and authors, and words for notes ────────────
const BOOKS: Record<string, [string, string][]> = {
  learning: [
    ["Introduction to Algorithms", "Cormen"], ["Linear Algebra Done Right", "Axler"], ["Real-Time Rendering", "Akenine-Möller"],
    ["Designing Data-Intensive Applications", "Kleppmann"], ["Structure and Interpretation of Computer Programs", "Abelson"],
    ["Computer Systems: A Programmer's Perspective", "Bryant"], ["The Algorithm Design Manual", "Skiena"],
    ["Mathematics for Machine Learning", "Deisenroth"], ["Operating Systems: Three Easy Pieces", "Arpaci-Dusseau"],
    ["Crafting Interpreters", "Nystrom"], ["Game Engine Architecture", "Gregory"], ["Physically Based Rendering", "Pharr"],
  ],
  fitness: [
    ["Daniels' Running Formula", "Daniels"], ["Starting Strength", "Rippetoe"], ["The Sports Gene", "Epstein"],
    ["Endure", "Hutchinson"], ["Training for the Uphill Athlete", "House"], ["Science and Development of Muscle Hypertrophy", "Schoenfeld"],
    ["Why We Sleep", "Walker"], ["Becoming a Supple Leopard", "Starrett"],
  ],
  work: [
    ["Deep Work", "Newport"], ["The Pragmatic Programmer", "Hunt"], ["Accelerate", "Forsgren"], ["The Manager's Path", "Fournier"],
    ["Thinking in Systems", "Meadows"], ["An Elegant Puzzle", "Larson"], ["Getting Things Done", "Allen"], ["Clean Architecture", "Martin"],
  ],
};
BOOKS.custom = [...BOOKS.learning.slice(0, 4), ...BOOKS.work.slice(0, 4)];

const WORDS =
  "chapter exercise proof matrix vector shader pipeline cache latency interval tempo recovery sprint review design pattern queue index shard replica transaction budget habit streak focus notes summary question insight example problem solution practice revision algorithm recursion graph tree heap"
    .split(" ");
const FIRST = ["Ada", "Alan", "Grace", "Linus", "Margaret", "Ken", "Barbara", "Edsger", "Frances", "Donald", "Radia", "Tim", "Hedy", "John", "Katherine"];
const LAST = ["Lovelace", "Turing", "Hopper", "Torvalds", "Hamilton", "Thompson", "Liskov", "Dijkstra", "Allen", "Knuth", "Perlman", "Berners-Lee", "Lamarr", "McCarthy", "Johnson"];

const sentence = () => {
  const words = Array.from({ length: int(6, 14) }, () => pick(WORDS));
  return words[0][0].toUpperCase() + words.join(" ").slice(1) + ".";
};

// ── One user's workspace ──────────────────────────────────────────────────
const DAY_MS = 86_400_000;
const endMs = Date.parse(`${END}T00:00:00Z`);
const dateOf = (i: number) => new Date(endMs - (DAYS - 1 - i) * DAY_MS).toISOString().slice(0, 10);

interface Habit {
  base: number;
  weekend: number;
  momentum: number;
  lapseChance: number;
}

function history(track: TrackState, habit: Habit): TrackState {
  const titles = [...track.phases.map((p) => p.title), ...track.materials.map((m) => m.title)];
  const completedItemsHistory: TrackState["completedItemsHistory"] = {};
  const historyUpdatedAt: Record<string, Record<string, number>> = {};
  const weeklyCompletions: TrackState["weeklyCompletions"] = {};
  const itemUpdatedAt: Record<string, Record<string, number>> = {};

  let yesterday = false;
  let lapse = 0;
  for (let i = 0; i < DAYS; i++) {
    const date = dateOf(i);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (lapse > 0) {
      lapse -= 1;
      yesterday = false;
      continue;
    }
    if (random() < habit.lapseChance) {
      lapse = int(3, 14);
      continue;
    }
    const p = Math.min(0.97, habit.base * (weekday === 0 || weekday === 6 ? habit.weekend : 1) + (yesterday ? habit.momentum : 0));
    const active = random() < p;
    yesterday = active;
    if (!active) continue;

    const at = Date.parse(`${date}T00:00:00Z`) + int(7, 22) * 3_600_000;
    const done = Array.from(new Set(Array.from({ length: int(1, 3) }, () => pick(titles))));
    completedItemsHistory[date] = done.map((title) => ({ title }));
    historyUpdatedAt[date] = Object.fromEntries(done.map((title) => [title, at]));
    const tasks = Array.from({ length: int(0, 4) }, (_, n) => `t_${weekday}_${n}`);
    const revisions = Array.from({ length: int(0, 2) }, (_, n) => `r_${weekday}_${n}`);
    weeklyCompletions[date] = { tasks, revisions };
    itemUpdatedAt[date] = Object.fromEntries([...tasks.map((t) => [`t:${t}`, at]), ...revisions.map((r) => [`r:${r}`, at])]);
  }
  return { ...track, completedItemsHistory, historyUpdatedAt, weeklyCompletions, itemUpdatedAt };
}

function userWorkspace(u: number): { workspace: Workspace; notes: { noteId: string; kind: string; trackId?: string; content: string }[] } {
  const habit: Habit = {
    base: between(0.2, 0.85),
    weekend: between(0.3, 1.15),
    momentum: between(0, 0.15),
    lapseChance: between(0.005, 0.03),
  };
  const tracks: Record<string, TrackState> = {};
  const notes: { noteId: string; kind: string; trackId?: string; content: string }[] = [];
  const count = 1 + (random() < 0.5 ? 1 : 0) + (random() < 0.2 ? 1 : 0);

  for (let k = 0; k < count; k++) {
    const template = pick(TEMPLATE_LIST);
    const trackId = `track_${u}_${k}`;
    const books = [...(BOOKS[template.id] ?? BOOKS.custom)].sort(() => random() - 0.5).slice(0, int(2, 6));
    const materials: Omit<Material, "id">[] = books.map(([title, author]) => ({
      title, author, category: "Book", type: "book", status: pick(["reading", "done", "queued"]),
      currentPage: int(0, 300), totalPages: 350, currentSubject: "", link: "",
    }));
    const base = seedTrackFromTemplate(template, {
      name: `${template.label} ${k + 1}`,
      color: template.defaultColor,
      startDate: dateOf(0),
      phases: template.buildPhases(template.defaultDurationDays),
      weekSchedule: template.defaultWeekSchedule,
      focusTypes: template.defaultFocusTypes,
      materials,
      roadmapContent: Array.from({ length: int(2, 6) }, sentence).join(" "),
    });
    // Deterministic ids, like a real device's but reproducible.
    const track: TrackState = {
      ...base,
      meta: { ...base.meta, id: trackId, createdAt: Date.parse(`${dateOf(0)}T00:00:00Z`) },
      materials: base.materials.map((m, i) => ({ ...m, id: `m_${u}_${k}_${i}` })),
      portfolio: base.portfolio.map((p, i) => ({ ...p, id: `p_${u}_${k}_${i}` })),
      configVersion: int(0, 30),
    };
    tracks[trackId] = history(track, habit);

    for (const m of tracks[trackId].materials) {
      if (random() < 0.6) notes.push({ noteId: m.id, kind: "material", content: Array.from({ length: int(3, 12) }, sentence).join(" ") });
    }
    if (random() < 0.5) notes.push({ noteId: `notepad_${trackId}`, kind: "notepad", trackId, content: Array.from({ length: int(1, 5) }, sentence).join(" ") });
  }
  return { workspace: { activeTrackId: Object.keys(tracks)[0], tracks, schemaVersion: 3, isSynced: true }, notes };
}

// ── Write it all ──────────────────────────────────────────────────────────
async function main() {
  const started = Date.now();
  await mongoose.connect(perfUri(), { maxPoolSize: 10 });
  const db = mongoose.connection.db!;

  console.log(`Seeding ${USERS} users × ${DAYS} days into ${db.databaseName} (seed ${SEED}, ending ${END})…`);
  for (const name of [TRACKS, COMPLETIONS, NOTES, AUDIT_LOG, RATE_LIMITS, "users", "sessions"]) {
    await db.collection(name).drop().catch(() => undefined);
  }
  await ensureCollections(db); // validators and indexes, exactly as the app has them
  // And the models' own (unique googleSub, session TTL). createIndexes, not
  // init(): Mongoose ran init() at connect, before the drop above.
  await Promise.all([User.createIndexes(), Session.createIndexes()]);

  const batches: Record<string, object[]> = { users: [], [TRACKS]: [], [COMPLETIONS]: [], [NOTES]: [] };
  const flush = async (force = false) => {
    for (const [name, docs] of Object.entries(batches)) {
      if (docs.length && (force || docs.length >= 5000)) {
        await db.collection(name).insertMany(docs.splice(0), { ordered: false });
      }
    }
  };

  const now = new Date(`${END}T12:00:00Z`);
  for (let u = 0; u < USERS; u++) {
    const userId = new mongoose.Types.ObjectId(hex(24));
    const { workspace, notes } = userWorkspace(u);
    batches.users.push({
      _id: userId,
      googleSub: `seed-${u}`,
      email: `user${u}@seed.example`,
      name: `${pick(FIRST)} ${pick(LAST)}`,
      createdAt: now,
      lastSeenAt: now,
      activeTrackId: workspace.activeTrackId,
    });
    const { tracks, days } = splitWorkspace(workspace);
    batches[TRACKS].push(...tracks.map((t) => ({ ...t, userId, updatedAt: now })));
    batches[COMPLETIONS].push(...days.map((d) => ({ ...d, userId, updatedAt: now })));
    batches[NOTES].push(...notes.map((n) => ({ ...n, userId, updatedAt: Date.parse(`${END}T12:00:00Z`) })));
    await flush();
    if ((u + 1) % 500 === 0) console.log(`  ${u + 1} users`);
  }
  await flush(true);

  // WiredTiger writes new data into its files at a checkpoint, about once a
  // minute, so on-disk sizes lag a bulk load. Wait for one before measuring.
  console.log("Waiting 65 s for MongoDB's next checkpoint, so on-disk sizes are real…");
  await new Promise((resolve) => setTimeout(resolve, 65_000));

  // What it came to: counts and sizes, per collection and for the database.
  const rows: string[] = [];
  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
  for (const name of ["users", TRACKS, COMPLETIONS, NOTES]) {
    const [s] = await db.collection(name).aggregate([{ $collStats: { storageStats: {} } }]).toArray();
    const st = s.storageStats;
    rows.push(
      `| \`${name}\` | ${st.count.toLocaleString("en")} | ${Math.round(st.avgObjSize ?? 0)} B | ${mb(st.size)} MB | ${mb(st.storageSize)} MB | ${mb(st.totalIndexSize)} MB | ${Object.keys(st.indexSizes).join(", ")} |`
    );
  }
  const dbStats = await db.command({ dbStats: 1 });
  const seconds = ((Date.now() - started) / 1000).toFixed(0);

  mkdirSync("docs/nosql", { recursive: true });
  writeFileSync(
    "docs/nosql/DATA.md",
    `# The generated dataset

Generated by \`scripts/seed.ts\` (\`npm run db:seed -- --users ${USERS} --days ${DAYS} --seed ${SEED} --end ${END}\`)
into the \`horizon_perf\` database, in ${seconds} s (including a 65 s wait for a checkpoint before measuring).
The same command produces the same data.

- ${USERS.toLocaleString("en")} users, each with 1 to 3 tracks built by the app's own templates (\`lib/templates\`).
- ${DAYS} days per track, shaped like habits: a personal baseline between 20 % and 85 %, quieter or busier
  weekends, momentum after an active day, and lapses of 3 to 14 days.
- Materials drawn from real book titles and authors, notes from a word list, so text search has something
  to find.
- Documents come from \`splitWorkspace\`, the server's own mapping, and pass the collections'
  \`$jsonSchema\` validators on the way in.

| Collection | Documents | Average size | Data | On disk (compressed) | Indexes | Index names |
|---|---|---|---|---|---|---|
${rows.join("\n")}

Database: ${mb(dbStats.dataSize)} MB of data, ${mb(dbStats.storageSize)} MB on disk, ${mb(dbStats.indexSize)} MB of indexes
(one member's figures; each of the three replica set members holds a full copy).

"Data" is the uncompressed BSON; "on disk" is after WiredTiger's compression.
`
  );
  console.log(rows.join("\n"));
  console.log(`Done in ${seconds} s. Wrote docs/nosql/DATA.md.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
