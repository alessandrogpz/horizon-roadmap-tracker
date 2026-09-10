// Measures the app's real queries against the generated dataset
// (npm run db:seed first), with and without the indexes they rely on, and
// writes docs/nosql/PERFORMANCE.md plus the raw explain() output in
// docs/nosql/explain/.
//
//   npm run db:explain
//
// "Without" doesn't drop anything: a { $natural: 1 } hint makes MongoDB scan
// the collection in storage order, exactly what it would do with no usable
// index. Text search has no scan equivalent (a $text query needs its index),
// so its "without" is what you'd write instead: a case-insensitive regex over
// the same fields.

import mongoose from "mongoose";
import type { mongo } from "mongoose";
import { mkdirSync, writeFileSync } from "node:fs";
import { perfUri } from "./env";
import { COMPLETIONS, TRACKS } from "../lib/server/collections";
import { pipelines } from "../lib/server/insights/stats";

type Doc = mongo.Document;

interface Measured {
  label: string;
  plan: string;
  keys: number;
  docs: number;
  returned: number;
  medianMs: number;
}

/** "IXSCAN user_track_date → FETCH", from a winning plan (classic or SBE). */
function planSummary(explain: Doc): string {
  const stages: string[] = [];
  const walk = (node: Doc | undefined) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.stage === "string") stages.unshift(node.indexName ? `${node.stage} ${node.indexName}` : node.stage);
    walk(node.inputStage);
    (node.inputStages ?? []).forEach(walk);
    walk(node.queryPlan);
  };
  const planner = explain.queryPlanner ?? explain.stages?.[0]?.$cursor?.queryPlanner;
  walk(planner?.winningPlan);
  return stages.join(" → ") || "?";
}

/** executionStats from a find or an aggregate explain, whichever shape it has. */
function stats(explain: Doc): { keys: number; docs: number; returned: number } {
  const es = explain.executionStats ?? explain.stages?.[0]?.$cursor?.executionStats ?? {};
  return { keys: es.totalKeysExamined ?? 0, docs: es.totalDocsExamined ?? 0, returned: es.nReturned ?? 0 };
}

async function median(run: () => Promise<unknown>, times = 5): Promise<number> {
  const durations: number[] = [];
  for (let i = 0; i < times; i++) {
    const start = performance.now();
    await run();
    durations.push(performance.now() - start);
  }
  return durations.sort((a, b) => a - b)[Math.floor(times / 2)];
}

async function main() {
  await mongoose.connect(perfUri());
  const db = mongoose.connection.db!;
  const tracks = db.collection(TRACKS);
  const days = db.collection(COMPLETIONS);
  mkdirSync("docs/nosql/explain", { recursive: true });

  // The busiest user: the worst case for every per-user query.
  const [busiest] = await days.aggregate([{ $group: { _id: "$userId", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 1 }]).toArray();
  if (!busiest) throw new Error("horizon_perf is empty. Run `npm run db:seed` first.");
  const userId = busiest._id;
  const { trackId } = (await days.findOne({ userId }, { sort: { date: -1 } }))!;
  const total = await days.estimatedDocumentCount();
  const lastMonth = { $gte: "2026-08-01", $lte: "2026-08-31" };

  const sections: string[] = [];
  const raw: Record<string, Doc> = {};

  async function find(name: string, label: string, collection: mongo.Collection, filter: Doc, hint?: Doc | string): Promise<Measured> {
    const options = hint ? { hint } : {};
    const explain = await collection.find(filter, options).explain("executionStats");
    raw[name] = explain;
    return { label, plan: planSummary(explain), ...stats(explain), medianMs: await median(() => collection.find(filter, options).toArray()) };
  }

  async function aggregate(name: string, label: string, pipeline: Doc[], hint?: Doc): Promise<Measured> {
    const options = hint ? { hint } : {};
    const explain = await days.aggregate(pipeline, options).explain("executionStats");
    raw[name] = explain;
    return { label, plan: planSummary(explain), ...stats(explain), medianMs: await median(() => days.aggregate(pipeline, options).toArray()) };
  }

  const table = (rows: Measured[]) =>
    [
      "| Run | Plan | Index keys examined | Documents examined | Returned | Median time |",
      "|---|---|---|---|---|---|",
      ...rows.map((r) => `| ${r.label} | \`${r.plan}\` | ${r.keys.toLocaleString("en")} | ${r.docs.toLocaleString("en")} | ${r.returned.toLocaleString("en")} | ${r.medianMs.toFixed(1)} ms |`),
    ].join("\n");

  // 1. One track's days over a date range: equality on userId and trackId, a range on date.
  const month = { userId, trackId, date: lastMonth };
  const year = { userId, trackId, date: { $gte: "2025-09-01", $lte: "2026-08-31" } };
  await days.createIndex({ date: 1, userId: 1, trackId: 1 }, { name: "date_first" }); // the wrong order, for comparison
  const monthRows = [
    await find("month-scan", "A month, no index (collection scan)", days, month, { $natural: 1 }),
    await find("month-wrong-order", "A month, index `{date, userId, trackId}` (range first)", days, month, "date_first"),
    await find("month-index", "A month, index `{userId, trackId, date}` (the app's)", days, month),
    await find("year-wrong-order", "A year, index `{date, userId, trackId}` (range first)", days, year, "date_first"),
    await find("year-index", "A year, index `{userId, trackId, date}` (the app's)", days, year),
  ];
  await days.dropIndex("date_first");
  sections.push(`## 1. One track's days over a date range

\`completions.find({ userId, trackId, date: { $gte: …, $lte: … } })\`

${table(monthRows)}

The **ESR rule** in action: in a compound index, **E**quality fields go first, then **S**ort, then
**R**ange. With \`date\` first, the index is ordered by day, so this track's entries are scattered: one
per day, among every other user's. MongoDB has to jump to them day by day, examining keys it then
skips, and the waste grows with the range. With the equality fields first, this track's days form one
contiguous stretch of the index, and MongoDB reads exactly the keys it returns.`);

  // 2. Everything one user has (what a sync loads).
  const userRows = [
    await find("user-scan", "No index (collection scan)", days, { userId }, { $natural: 1 }),
    await find("user-index", "Prefix of `{userId, trackId, date}`", days, { userId }),
  ];
  sections.push(`## 2. All of one user's days (what a sync reads)

\`completions.find({ userId })\`

${table(userRows)}

No separate \`{userId}\` index is needed: a compound index serves any query on a *prefix* of its fields.`);

  // 3. Text search within one user's tracks, for a word from one of their own books.
  const theirs = await tracks.findOne({ userId, "materials.0": { $exists: true } }, { projection: { "materials.title": 1 } });
  const word = ((theirs?.materials?.[0]?.title as string) ?? "algebra")
    .split(/[^A-Za-z]+/)
    .sort((a, b) => b.length - a.length)[0]
    .toLowerCase();
  const regex = { userId, $or: ["materials.title", "materials.author", "phases.title", "roadmapContent"].map((f) => ({ [f]: { $regex: word, $options: "i" } })) };
  const searchRows = [
    await find("search-regex-scan", "Regex, no index (collection scan)", tracks, regex, { $natural: 1 }),
    await find("search-regex-user", "Regex, `{userId, trackId}` index", tracks, regex, "user_track"),
    await find("search-text", "`$text`, compound text index (the app's)", tracks, { userId, $text: { $search: word } }),
  ];
  sections.push(`## 3. Searching one user's tracks for "${word}"

${table(searchRows)}

The \`userId\` prefix does most of the narrowing on its own; the text index then finds the word
without reading any document's text, ranks results by relevance, and matches stems ("algebras").
A regex can do neither, and a leading-wildcard regex can't use an ordinary index at all.`);

  // 4. The stats pipelines.
  const pipelineRows: Measured[] = [];
  for (const name of ["byMonth", "longestStreaks"] as const) {
    const pipeline = pipelines[name](userId);
    pipelineRows.push(await aggregate(`${name}-scan`, `\`${name}\`, no index (collection scan)`, pipeline, { $natural: 1 }));
    pipelineRows.push(await aggregate(`${name}-index`, `\`${name}\`, with the index`, pipeline));
  }
  sections.push(`## 4. The stats pipelines (one user)

${table(pipelineRows)}

Each pipeline starts with \`$match: { userId }\`, so the index hands it only this user's days; the
\`$group\`, \`$setWindowFields\` and \`$lookup\` stages then work on a few hundred documents instead
of all ${total.toLocaleString("en")}.`);

  for (const [name, explain] of Object.entries(raw)) {
    // explain() names the machine it ran on; that doesn't belong in the repo.
    if (explain.serverInfo) explain.serverInfo.host = "localhost";
    writeFileSync(`docs/nosql/explain/${name}.json`, JSON.stringify(explain, null, 2) + "\n");
  }

  writeFileSync(
    "docs/nosql/PERFORMANCE.md",
    `# Query performance, with and without indexes

Measured by \`scripts/explain.ts\` (\`npm run db:explain\`) on the generated dataset
(\`docs/nosql/DATA.md\`: ${total.toLocaleString("en")} completion documents), for the user with the most
days (${busiest.n} documents), on the local three-member replica set. Times are the median of 5 runs
on a development machine and will differ elsewhere; the keys and documents examined won't.
The full \`explain("executionStats")\` output of every run is in \`docs/nosql/explain/\`.

How to read a plan: \`COLLSCAN\` reads every document in the collection; \`IXSCAN <index>\` walks an
index; \`FETCH\` then loads the matching documents; \`TEXT_MATCH\`/\`TEXT_OR\` are the text index at work.
The number that matters most is **documents examined** compared with **returned**: ideally equal.

${sections.join("\n\n")}
`
  );
  console.log(sections.join("\n\n"));
  console.log("\nWrote docs/nosql/PERFORMANCE.md and docs/nosql/explain/.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
