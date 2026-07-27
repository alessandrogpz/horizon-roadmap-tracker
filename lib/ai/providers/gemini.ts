// Google Gemini via the user's own AI Studio key.
//
// The default provider: free tier with no card, works on every device including
// iOS, and supports real response schemas rather than "please return JSON".
// Requests go from the user's browser straight to Google — never through us,
// because there is no "us" to go through.

import { AIError, type AIModelInfo, type AIProvider, type GenerateOpts, type GenerateResult } from "../types";
import { getSettings } from "../../settings";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

// The default model id lives in lib/settings.ts, which owns the setting. Ids
// and their free-tier eligibility change over time, and a stale default fails
// as a 404 or a zero-quota 429 — neither of which reads like "wrong model" to
// a user. Hence: configurable, with listGeminiModels() below to show what this
// key can actually reach rather than making anyone guess.

/**
 * Asks the key which models it can use. This is the diagnostic that turns
 * "rate limit hit" — which can mean a model with no free-tier quota at all —
 * into something actionable.
 */
async function listModels(key: string, signal?: AbortSignal): Promise<AIModelInfo[]> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?pageSize=200`, {
      headers: { "x-goog-api-key": key },
      signal,
    });
  } catch {
    throw new AIError("network", "Couldn't reach Google's API.", true);
  }
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    if (res.status === 401 || res.status === 403) {
      throw new AIError("auth", `Gemini rejected the API key: ${detail}`);
    }
    throw new AIError("unknown", `Gemini returned ${res.status}: ${detail}`);
  }

  const json = await res.json();
  const models: AIModelInfo[] = (json?.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      (m.supportedGenerationMethods ?? []).includes("generateContent"),
    )
    .map((m: { name?: string; displayName?: string }) => ({
      // Bare id — the "models/" prefix is stripped for the generateContent URL.
      id: String(m.name ?? "").replace(/^models\//, ""),
      label: String(m.displayName ?? m.name ?? ""),
    }))
    .filter((m: AIModelInfo) => m.id.length > 0);

  return models;
}

/** Gemini rejects unknown JSON Schema keywords outright, so the schema we send
 *  has to be stripped down to the subset it accepts. Anything we drop here is
 *  still enforced by the validator, which never trusts the model regardless. */
function toGeminiSchema(schema: object): object {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "additionalProperties" || key === "$schema" || key === "default") continue;
      out[key] = strip(value);
    }
    return out;
  };
  return strip(schema) as object;
}

/** Pulls Google's own explanation out of an error response, falling back to
 *  raw text. Never throws — a diagnostic must not fail while diagnosing. */
async function readErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.text();
    try {
      const json = JSON.parse(body);
      const message = json?.error?.message;
      const status = json?.error?.status;
      if (message) return status ? `${message} (${status})` : message;
    } catch {
      // Not JSON; fall through to the raw body.
    }
    return body.slice(0, 300) || res.statusText || "no detail given";
  } catch {
    return res.statusText || "no detail given";
  }
}

/**
 * Room for the model's internal reasoning, on top of the caller's output cap.
 *
 * Gemini 2.5+ think by default, and thinking tokens are billed against
 * `maxOutputTokens` — so a cap sized purely for the JSON gets consumed by
 * reasoning and returns MAX_TOKENS with nothing in it. Left unset, the model
 * decides for itself and can spend up to ~8k thinking, which is both slow and
 * wasteful for a task this constrained.
 *
 * Bounding it explicitly keeps the D12 runaway guard meaningful: the total
 * ceiling stays fixed and knowable rather than being whatever the model felt
 * like spending.
 */
const THINKING_BUDGET = 2048;

async function generate(opts: GenerateOpts): Promise<GenerateResult> {
  const { geminiKey: key, geminiModel: model } = getSettings().ai;
  if (!key) throw new AIError("auth", "No Gemini API key configured.");

  const buildBody = (withThinking: boolean): Record<string, unknown> => ({
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature: 0.7,
      // D12: the cap is mandatory. Without it a model that never stops bills
      // the user until it exhausts the context window. The thinking allowance
      // is added on top so the caller's number still means "room for output".
      maxOutputTokens: opts.maxOutputTokens + (withThinking ? THINKING_BUDGET : 0),
      ...(withThinking ? { thinkingConfig: { thinkingBudget: THINKING_BUDGET } } : {}),
      ...(opts.schema
        ? { responseMimeType: "application/json", responseSchema: toGeminiSchema(opts.schema) }
        : {}),
    },
  });

  const post = (withThinking: boolean) =>
    fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(buildBody(withThinking)),
      signal: opts.signal,
    });

  let res: Response;
  // A response body can only be read once, so hold on to whatever we read
  // while deciding about the retry rather than reaching for it again below.
  let errorDetail: string | null = null;
  try {
    res = await post(true);
    // Older, non-thinking models reject `thinkingConfig` outright. The model is
    // user-configurable, so rather than forbid those, retry once without it.
    if (res.status === 400) {
      errorDetail = await readErrorDetail(res);
      if (/thinking/i.test(errorDetail)) {
        res = await post(false);
        errorDetail = null;
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AIError("aborted", "Generation cancelled.");
    }
    throw new AIError("network", "Couldn't reach Google's API.", true);
  }

  if (!res.ok) {
    // Google explains itself in the body — an unsupported model, a schema it
    // won't accept, an expired key. Throwing that away and guessing from the
    // status code alone produces confidently wrong diagnoses, so read it.
    const detail = errorDetail ?? (await readErrorDetail(res));

    // 400 is *not* an auth failure. It usually means the request was malformed
    // — most often a responseSchema Gemini rejects — and reporting it as a bad
    // key sends you to re-check a key that was fine all along.
    if (res.status === 400) {
      throw new AIError("malformed", `Gemini rejected the request: ${detail}`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new AIError("auth", `Gemini rejected the API key: ${detail}`);
    }
    if (res.status === 404) {
      throw new AIError(
        "unknown",
        `Gemini has no model "${model}" available to this key: ${detail}`,
      );
    }
    if (res.status === 429) {
      // RESOURCE_EXHAUSTED covers both "too many requests this minute" and
      // "this model has no free-tier quota at all". They need different
      // responses from the user, and only the body distinguishes them.
      throw new AIError("rate-limit", `Gemini quota: ${detail}`, true);
    }
    throw new AIError("unknown", `Gemini returned ${res.status}: ${detail}`, res.status >= 500);
  }

  const json = await res.json();
  const candidate = json?.candidates?.[0];
  // MAX_TOKENS is Gemini's name for "hit the cap". Surfaced as a hard failure:
  // partial JSON is not something to repair (D12).
  const stopReason: GenerateResult["stopReason"] =
    candidate?.finishReason === "MAX_TOKENS" ? "length" : "stop";

  const text = (candidate?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");

  if (!text && stopReason === "stop") {
    // Usually a safety block: the request succeeded but produced nothing.
    throw new AIError("malformed", "Gemini returned an empty response.", true);
  }

  return { text, stopReason };
}

export const geminiProvider: AIProvider = {
  id: "byok-gemini",
  label: "Google Gemini",
  hint: "Free tier, no card required. Best quality.",
  keyUrl: "https://aistudio.google.com/apikey",
  keyPlaceholder: "AIza…",
  isAvailable: () => getSettings().ai.geminiKey.length > 0,
  generate,
  listModels,
};
