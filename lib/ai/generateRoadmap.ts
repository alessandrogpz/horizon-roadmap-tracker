// Orchestration: goal text in, a validated roadmap out.

import { generate, parseModelJson } from "./provider";
import { buildRoadmapDocPrompt, buildRoadmapPrompt } from "./prompts";
import { ROADMAP_SCHEMA } from "./roadmapSchema";
import { validateRoadmap, type ValidatedRoadmap } from "./validate";
import { AIError } from "./types";

/**
 * Output allowance for a full roadmap.
 *
 * Originally 3000, sized from screening where a roadmap was phases and a week
 * and nothing else. The payload now also carries materials, portfolio,
 * rotations (up to 3 × 12 items) and algoDS, which roughly doubles it. Still a
 * real ceiling rather than an open budget — D12's point is that the limit is
 * knowable, not that it is small.
 *
 * Note this counts output only; each provider adds its own reasoning allowance
 * on top, because thinking tokens are billed against the same budget and would
 * otherwise consume it entirely.
 */
const ROADMAP_MAX_TOKENS = 8000;
const DOC_MAX_TOKENS = 2000;

export async function generateRoadmap(
  goal: string,
  durationDays: number,
  signal?: AbortSignal,
): Promise<ValidatedRoadmap> {
  const { text } = await generate({
    prompt: buildRoadmapPrompt(goal.trim(), durationDays),
    schema: ROADMAP_SCHEMA,
    maxOutputTokens: ROADMAP_MAX_TOKENS,
    signal,
  });
  return validateRoadmap(parseModelJson(text), durationDays);
}

/** Stage 1: the free-form roadmap document. No schema, no structure to corrupt. */
export async function generateRoadmapDoc(
  trackName: string,
  goal: string,
  phases: { title: string; description: string }[],
  signal?: AbortSignal,
): Promise<string> {
  const { text } = await generate({
    prompt: buildRoadmapDocPrompt(trackName, goal, phases),
    maxOutputTokens: DOC_MAX_TOKENS,
    signal,
  });

  // Models fence markdown roughly as often as they fence JSON, despite being
  // asked not to.
  const cleaned = text
    .trim()
    .replace(/^```(?:markdown|md)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  if (!cleaned) throw new AIError("malformed", "The model returned an empty document.", true);
  return cleaned;
}
