// Prompts, ported from the Stage −1 screening harness (temp/ai-eval/run-eval.mjs)
// with two corrections the screening itself surfaced.
//
// The wording here is not arbitrary: this exact framing scored ~78% "would keep
// and edit" against a 7B control across six goal types. Change it and re-run
// the harness rather than guessing — it is a ten-minute experiment.

import type { WeekDay, FocusType } from "../types";

/**
 * The rhythm vocabulary the model is allowed to use.
 *
 * D13: `weekSchedule` was the worst-performing field at every model size,
 * failing in ways no validator can repair — day slots filled with phase names,
 * the schema's own field names echoed back as day types, and weeks where all
 * seven days shared one type. Rather than repair that, the model now picks from
 * a fixed set of keys and we derive `focusTypes` locally, which removes the
 * orphan-reference failure mode entirely instead of patching it after the fact.
 */
export const RHYTHM_TYPES = {
  focus: { label: "Focus", color: "#0ea5e9" },
  practice: { label: "Practice", color: "#8b5cf6" },
  build: { label: "Build", color: "#f59e0b" },
  review: { label: "Review", color: "#34d399" },
  rest: { label: "Rest", color: "#a1a1aa" },
} as const satisfies Record<string, FocusType>;

export type RhythmTypeKey = keyof typeof RHYTHM_TYPES;

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Turns the model's seven type keys into the WeekDay[] the app stores. Labels
 *  and colours come from our table, never from the model. */
export function buildWeekSchedule(types: string[]): WeekDay[] {
  return DAY_NAMES.map((name, i) => {
    const key = (types[i] in RHYTHM_TYPES ? types[i] : "focus") as RhythmTypeKey;
    return { name, type: key, label: RHYTHM_TYPES[key].label };
  });
}

/** Only the types actually used, so the rhythm editor isn't cluttered with
 *  legend entries for days that don't exist. */
export function buildFocusTypes(schedule: WeekDay[]): Record<string, FocusType> {
  const out: Record<string, FocusType> = {};
  for (const day of schedule) {
    const key = day.type as RhythmTypeKey;
    if (RHYTHM_TYPES[key]) out[key] = { ...RHYTHM_TYPES[key] };
  }
  return out;
}

const RHYTHM_KEY_LIST = Object.keys(RHYTHM_TYPES).join(", ");

/**
 * The structured-roadmap system prompt (Stage 2).
 *
 * Two changes from the screened version:
 *  - `math` (D10): screening returned an empty `math` on 100% of runs, including
 *    Vulkan, where linear algebra is exactly what the field is for. The original
 *    stated only the negative case; this states the positive one too.
 *  - `weekSchedule` (D13): the model now emits seven keys from a fixed set
 *    rather than authoring day objects and a colour palette freehand.
 */
export function buildRoadmapPrompt(goal: string, durationDays: number): string {
  return `You are helping someone plan a long-term personal goal. Given the goal and a total duration in days, produce a roadmap as JSON.

Rules:
- Produce between 3 and 6 phases. Each phase must be a distinct, concrete stage
  of progress — never a generic label like "Introduction", "Basics",
  "Intermediate", "Advanced", or "Mastery".
- "recommendedByDay" is the cumulative day count from the start by which the
  phase should be finished. Values must strictly increase, and the final phase
  must equal ${durationDays}.
- Give each phase 3 to 6 tasks. A task is a specific action the person performs,
  not a topic. "Write a program that allocates and frees a 1GB buffer" is a
  task; "Learn memory management" is not.
- "detailedInfo.focus" is what they are concentrating on; "deliverable" is what
  they will have produced.
- "detailedInfo.math" is for goals with genuine mathematical content — graphics
  and rendering (linear algebra, projections), machine learning, physics
  simulation, engineering. Populate it when the goal involves those. Return an
  empty array when it does not, as for a fitness, language, or career goal.
- "weekSchedule" is exactly 7 strings, one per day from Monday to Sunday. Each
  must be one of: ${RHYTHM_KEY_LIST}. Vary them — a realistic week has rest in
  it, and a week where every day is identical is not a plan.
- "color" is a #rrggbb hex string representing the whole track.
- "detailedInfo.algoDS" is for algorithms and data structures content. Populate
  it only when the goal genuinely involves them; return an empty array otherwise.
- "materials" is 4 to 8 study resources. Name only works you are confident
  actually exist — well-known books, standard references, official
  documentation. Never invent a title to fill the list. Give "author" only when
  you are confident of the attribution; leave it out rather than guess, since a
  misattributed work is harder to find than an unattributed one. Set
  "totalPages" only for books; use 0 otherwise. Prefer fewer, real resources
  over a longer list.
- "portfolio" is 2 to 5 concrete things they will have built by the end —
  artefacts, not activities. "A deferred renderer with shadow mapping" is a
  portfolio item; "practice rendering" is not.
- "rotations" is 1 to 3 recurring weekly cycles: a repeating list of topics that
  advances one item per week, landing on the days you choose. Use them for
  material that benefits from spaced repetition — algorithm patterns, maths
  topics, technique drills — not for one-off work that belongs in a phase.
  Give each 6 to 12 items so the cycle spans a meaningful stretch. Only put
  rotations on days the weekly rhythm actually works; never on rest days.
- Never invent book titles, course names, or URLs.
- Be specific and substantial. Descriptions should say something concrete a
  person could act on, not restate the title.
- Scale the scope to the time available. A short duration means a narrower goal,
  not a compressed promise of mastery.

Goal: ${goal}
Total duration: ${durationDays} days`;
}

/**
 * The free-form roadmap document prompt (Stage 1).
 *
 * No schema, nothing structural to corrupt — the output lands in a markdown
 * textarea the user is already editing. This is the lowest-risk use of a
 * provider in the app, which is why it ships first.
 */
export function buildRoadmapDocPrompt(
  trackName: string,
  goal: string,
  phases: { title: string; description: string }[],
): string {
  const phaseList = phases.length
    ? phases.map((p) => `- ${p.title}: ${p.description}`).join("\n")
    : "(no phases defined yet)";

  return `Write a personal roadmap document in Markdown for the track below. This is the author's own planning document — write it for them, in plain second person, with no preamble and no closing commentary.

Structure it as:
# ${trackName || "My Roadmap"}
## Overview — what the bigger goal is and why it matters
## Phases — one "### " section per phase, each with what it involves and how they'll know it's done
## How I'll work — the weekly rhythm and habits that make this stick

Rules:
- Never invent book titles, course names, or URLs.
- Be specific to this goal. Generic study advice is worse than nothing.
- Do not wrap the output in a code fence. Return the Markdown directly.

Track name: ${trackName || "(unnamed)"}
Goal: ${goal || "(not stated — infer it from the phases)"}
Phases:
${phaseList}`;
}
