#!/usr/bin/env node
// Screening harness for the Horizon AI roadmap generator.
//
// Answers one question before any WebLLM code gets written: can a small
// open-weights model actually produce a *useful* roadmap, not merely a
// schema-valid one? Runs every prompt N times against every model via a local
// Ollama server, applies the same structural checks the real validator will,
// and reports pass rates plus a "genericness" score.
//
// Usage:
//   node run-eval.mjs                          # all models, all prompts, 5 runs each
//   node run-eval.mjs --runs 10                # more samples
//   node run-eval.mjs --models qwen2.5:1.5b-instruct-q4_K_M
//   node run-eval.mjs --prompts vulkan,fitness
//
// Results land in ./results/<timestamp>.json for later diffing.

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OLLAMA = process.env.OLLAMA_HOST || "http://localhost:11434";

const DEFAULT_MODELS = [
  "qwen2.5:1.5b-instruct-q4_K_M",
  "qwen2.5:3b-instruct-q4_K_M",
  "qwen2.5:7b-instruct-q4_K_M",
];

// ---------------------------------------------------------------------------
// Test prompts. Deliberately varied: a niche technical goal, a mainstream
// technical goal, a non-technical goal (does it escape programming framing?),
// an absurdly compressed timeline (does it push back or hallucinate?), and a
// vague one-liner (does it invent structure or produce mush?).
// ---------------------------------------------------------------------------
const PROMPTS = {
  vulkan: {
    goal: "Learn Vulkan, C++ memory management, and graphics rendering in 3 months",
    durationDays: 90,
    notes: "Niche + technical. Tests real domain knowledge. Watch for invented API names.",
  },
  webdev: {
    goal: "Become a competent full-stack web developer in 6 months, starting from basic HTML",
    durationDays: 180,
    notes: "Mainstream. Heavily represented in training data — should be the model's best showing.",
  },
  fitness: {
    goal: "Get from couch to running a 5k in 8 weeks",
    durationDays: 56,
    notes: "Non-technical. Tests whether the model escapes the programming framing and leaves `math` empty.",
  },
  compressed: {
    goal: "Master OpenGL and C++ shader programming in 4 weeks",
    durationDays: 28,
    notes: "Unrealistic timeline. Does it scale scope down, or promise mastery anyway?",
  },
  vague: {
    goal: "I want to get better at music",
    durationDays: 90,
    notes: "Almost no signal. Tests whether it asks-by-structuring or emits filler.",
  },
  broad: {
    goal: "Learn game engine development, linear algebra, physics simulation, and shipping a game on Steam in 13 months",
    durationDays: 395,
    notes: "Very broad + long. Tests phase pacing across a long horizon.",
  },
};

// ---------------------------------------------------------------------------
// The JSON schema handed to Ollama's structured-output `format` field. This is
// the local analogue of WebLLM's XGrammar constraint, so pass rates here are
// indicative of the real thing. Mirrors §5 of AI_ROADMAP_PLAN.md.
// ---------------------------------------------------------------------------
const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    color: { type: "string" },
    durationDays: { type: "integer" },
    phases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          recommendedByDay: { type: "integer" },
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: { title: { type: "string" } },
              required: ["title"],
            },
          },
          detailedInfo: {
            type: "object",
            properties: {
              focus: {
                type: "array",
                items: {
                  type: "object",
                  properties: { item: { type: "string" }, desc: { type: "string" } },
                  required: ["item", "desc"],
                },
              },
              deliverable: {
                type: "array",
                items: {
                  type: "object",
                  properties: { item: { type: "string" }, desc: { type: "string" } },
                  required: ["item", "desc"],
                },
              },
              math: {
                type: "array",
                items: {
                  type: "object",
                  properties: { item: { type: "string" }, desc: { type: "string" } },
                  required: ["item", "desc"],
                },
              },
            },
            required: ["focus", "deliverable", "math"],
          },
        },
        required: ["title", "description", "recommendedByDay", "tasks", "detailedInfo"],
      },
    },
    weekSchedule: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string" },
          label: { type: "string" },
        },
        required: ["name", "type", "label"],
      },
    },
    focusTypes: { type: "object" },
  },
  required: ["name", "color", "durationDays", "phases", "weekSchedule", "focusTypes"],
};

const SYSTEM_PROMPT = `You design structured learning and training roadmaps.

Given a user's goal and a total duration in days, produce a roadmap as JSON.

Rules:
- Produce between 3 and 6 phases. Each phase must be a distinct, concrete stage
  of progress — never a generic label like "Introduction", "Basics",
  "Intermediate", "Advanced", or "Mastery".
- "recommendedByDay" is the cumulative day count from the start by which the
  phase should be finished. Values must strictly increase, and the final phase
  must equal the total duration.
- Give each phase 3 to 6 tasks. A task is a specific action the person performs,
  not a topic. "Write a program that allocates and frees a 1GB buffer" is a
  task; "Learn memory management" is not.
- "detailedInfo.focus" is what they are concentrating on; "deliverable" is what
  they will have produced. "math" applies only if the goal genuinely involves
  mathematics — otherwise return an empty array.
- "weekSchedule" must contain exactly 7 entries, named Mon, Tue, Wed, Thu, Fri,
  Sat, Sun in that order. Each "type" must be a key present in "focusTypes".
- "focusTypes" maps each type key to { "label", "color" }, where color is a
  #rrggbb hex string.
- "color" is a #rrggbb hex string representing the whole track.
- Never invent book titles, course names, or URLs.
- Scale the scope to the time available. A short duration means a narrower goal,
  not a compressed promise of mastery.`;

// ---------------------------------------------------------------------------
// Structural checks — the same family of rules as lib/ai/validate.ts (§6).
// A result that fails these would need repair before reaching the UI.
// ---------------------------------------------------------------------------
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEX = /^#[0-9a-fA-F]{6}$/;

// Phrases that signal filler rather than a real plan.
const GENERIC_MARKERS = [
  "introduction to", "getting started", "the basics", "basic concepts",
  "fundamentals of", "intermediate", "advanced topics", "advanced concepts",
  "mastery", "final project", "putting it all together", "next steps",
  "learn the", "understand the", "explore the", "practice more",
  "continue learning", "review everything", "wrap up",
];

function checkStructure(out, expectedDuration) {
  const problems = [];
  const ok = (cond, msg) => { if (!cond) problems.push(msg); };

  ok(HEX.test(out?.color ?? ""), "color not #rrggbb");

  const phases = Array.isArray(out?.phases) ? out.phases : [];
  ok(phases.length >= 3 && phases.length <= 6, `phase count ${phases.length} outside 3-6`);

  let prev = 0;
  let monotonic = true;
  for (const p of phases) {
    const d = p?.recommendedByDay;
    if (typeof d !== "number" || d <= prev) monotonic = false;
    else prev = d;
  }
  ok(monotonic, "recommendedByDay not strictly increasing");
  ok(
    phases.length > 0 && Math.abs((phases.at(-1)?.recommendedByDay ?? 0) - expectedDuration) <= expectedDuration * 0.1,
    `final recommendedByDay ${phases.at(-1)?.recommendedByDay} != duration ${expectedDuration}`
  );

  const taskCounts = phases.map((p) => (Array.isArray(p?.tasks) ? p.tasks.length : 0));
  ok(taskCounts.every((n) => n >= 3 && n <= 6), `task counts ${taskCounts.join(",")} outside 3-6`);

  const ws = Array.isArray(out?.weekSchedule) ? out.weekSchedule : [];
  ok(ws.length === 7, `weekSchedule length ${ws.length} != 7`);
  ok(ws.every((d, i) => d?.name === DAYS[i]), "weekSchedule days not Mon..Sun in order");

  const ft = out?.focusTypes && typeof out.focusTypes === "object" ? out.focusTypes : {};
  const orphans = ws.map((d) => d?.type).filter((t) => t && !(t in ft));
  ok(orphans.length === 0, `weekSchedule types missing from focusTypes: ${[...new Set(orphans)].join(",")}`);
  ok(
    Object.values(ft).every((v) => HEX.test(v?.color ?? "")),
    "focusTypes contains a non-#rrggbb color"
  );

  return problems;
}

// Fraction of phase/task titles containing filler language. Lower is better.
function genericness(out) {
  const titles = [];
  for (const p of Array.isArray(out?.phases) ? out.phases : []) {
    if (p?.title) titles.push(String(p.title));
    for (const t of Array.isArray(p?.tasks) ? p.tasks : []) {
      if (t?.title) titles.push(String(t.title));
    }
  }
  if (!titles.length) return 1;
  const hits = titles.filter((t) =>
    GENERIC_MARKERS.some((m) => t.toLowerCase().includes(m))
  ).length;
  return hits / titles.length;
}

// Mean task title length in words — a crude proxy for specificity.
function meanTaskWords(out) {
  const lens = [];
  for (const p of Array.isArray(out?.phases) ? out.phases : []) {
    for (const t of Array.isArray(p?.tasks) ? p.tasks : []) {
      if (t?.title) lens.push(String(t.title).trim().split(/\s+/).length);
    }
  }
  return lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
}

// ---------------------------------------------------------------------------

// Real roadmaps top out around 2200 tokens. Small models sometimes never emit a
// stop token — the grammar allows unbounded array repetition, so they append
// forever, context-shifting past num_ctx. Observed: 40k and 81k tokens on single
// generations. Cap well above the legitimate ceiling so a truncation is
// unambiguously a runaway, never a roadmap that just ran long.
const MAX_TOKENS = 3000;
// Backstop for a stall that num_predict can't catch (e.g. no tokens at all).
const REQUEST_TIMEOUT_MS = 120_000;

async function generate(model, prompt) {
  const started = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ac.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: SCHEMA,
        options: { temperature: 0.7, num_ctx: 8192, num_predict: MAX_TOKENS },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Goal: ${prompt.goal}\nTotal duration: ${prompt.durationDays} days`,
          },
        ],
      }),
    });
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error(`timeout after ${REQUEST_TIMEOUT_MS / 1000}s (no response)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`ollama ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const ms = Date.now() - started;
  // "length" means we hit MAX_TOKENS — the model never chose to stop.
  const truncated = body.done_reason === "length";
  let parsed = null;
  let parseError = null;
  try {
    parsed = JSON.parse(body.message.content);
  } catch (e) {
    parseError = e.message;
  }
  return { parsed, parseError, ms, truncated, raw: body.message.content };
}

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (flag, fallback) => {
    const i = a.indexOf(flag);
    return i >= 0 && a[i + 1] ? a[i + 1] : fallback;
  };
  return {
    runs: Number(get("--runs", "5")),
    models: get("--models", DEFAULT_MODELS.join(",")).split(",").filter(Boolean),
    prompts: get("--prompts", Object.keys(PROMPTS).join(",")).split(",").filter(Boolean),
  };
}

async function main() {
  const { runs, models, prompts } = parseArgs();
  const results = [];

  console.log(`Ollama: ${OLLAMA}`);
  console.log(`Models: ${models.join(", ")}`);
  console.log(`Prompts: ${prompts.join(", ")}  |  ${runs} run(s) each\n`);

  for (const model of models) {
    for (const key of prompts) {
      const prompt = PROMPTS[key];
      if (!prompt) { console.log(`  ! unknown prompt "${key}", skipping`); continue; }
      process.stdout.write(`${model.padEnd(32)} ${key.padEnd(12)} `);
      for (let i = 0; i < runs; i++) {
        try {
          const { parsed, parseError, ms, truncated, raw } = await generate(model, prompt);
          if (truncated) {
            // Never stopped on its own. On-device this is a pinned GPU and no
            // output, so it counts as a failure however the partial JSON looks.
            results.push({
              model, prompt: key, run: i, ms, ok: false, truncated: true,
              problems: [`runaway: hit ${MAX_TOKENS}-token cap without stopping`],
              raw,
            });
            process.stdout.write("R");
            continue;
          }
          if (parseError) {
            results.push({ model, prompt: key, run: i, ms, ok: false, problems: [`unparseable: ${parseError}`], raw });
            process.stdout.write("X");
            continue;
          }
          const problems = checkStructure(parsed, prompt.durationDays);
          results.push({
            model, prompt: key, run: i, ms,
            ok: problems.length === 0,
            problems,
            genericness: genericness(parsed),
            meanTaskWords: meanTaskWords(parsed),
            output: parsed,
          });
          process.stdout.write(problems.length === 0 ? "." : "!");
        } catch (e) {
          results.push({ model, prompt: key, run: i, ok: false, problems: [`error: ${e.message}`] });
          process.stdout.write("E");
        }
      }
      process.stdout.write("\n");
    }
  }

  // ---- summary ----
  console.log("\n" + "=".repeat(78));
  console.log("model                            prompt        pass   generic  words  med.s");
  console.log("-".repeat(78));
  for (const model of models) {
    for (const key of prompts) {
      const rows = results.filter((r) => r.model === model && r.prompt === key);
      if (!rows.length) continue;
      const passed = rows.filter((r) => r.ok).length;
      const gen = rows.filter((r) => r.genericness != null).map((r) => r.genericness);
      const wc = rows.filter((r) => r.meanTaskWords).map((r) => r.meanTaskWords);
      const times = rows.filter((r) => r.ms).map((r) => r.ms).sort((a, b) => a - b);
      const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
      const med = times.length ? times[Math.floor(times.length / 2)] / 1000 : 0;
      console.log(
        `${model.padEnd(32)} ${key.padEnd(13)} ${String(passed + "/" + rows.length).padEnd(6)} ` +
        `${mean(gen).toFixed(2).padEnd(8)} ${mean(wc).toFixed(1).padEnd(6)} ${med.toFixed(1)}`
      );
    }
  }
  console.log("=".repeat(78));

  // Runaways are a shipping blocker for on-device, not a quality nit — surface
  // them separately from structural problems the validator could repair.
  const runaways = results.filter((r) => r.truncated);
  if (runaways.length) {
    console.log(`\nRunaway generations (never stopped): ${runaways.length}/${results.length}`);
    const byModel = {};
    for (const r of runaways) byModel[r.model] = (byModel[r.model] ?? 0) + 1;
    for (const [m, n] of Object.entries(byModel).sort((a, b) => b[1] - a[1])) {
      const total = results.filter((r) => r.model === m).length;
      console.log(`  ${String(n).padStart(4)}/${total}  ${m}`);
    }
  }

  console.log("\nMost common structural problems:");
  const tally = {};
  for (const r of results) for (const p of r.problems ?? []) {
    const norm = p.replace(/\d+/g, "N");
    tally[norm] = (tally[norm] ?? 0) + 1;
  }
  for (const [p, n] of Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${String(n).padStart(4)}x  ${p}`);
  }

  const dir = join(HERE, "results");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify({ runs, models, prompts, results }, null, 2));
  console.log(`\nFull output (including every generated roadmap): ${file}`);
  console.log("Read the actual roadmaps. The numbers screen; only reading decides.");
}

main().catch((e) => { console.error(e); process.exit(1); });
