// Provider registry and selection.
//
// Stage 3 (Chrome's built-in Prompt API) will add a third entry here. It is
// deliberately absent for now: detecting the API proves it exists, not that it
// can do this task, and Gemini Nano is a small on-device model of exactly the
// class that failed model screening. See AI_ROADMAP_PLAN.md D2.

import {
  AIError,
  describeAIError,
  type AIModelInfo,
  type AIProvider,
  type AIProviderId,
  type GenerateOpts,
  type GenerateResult,
} from "./types";
import { geminiProvider } from "./providers/gemini";
import { openrouterProvider } from "./providers/openrouter";
import { activeAIKey, aiModelFor, getSettings } from "../settings";

/** In preference order. */
export const PROVIDERS: readonly AIProvider[] = [geminiProvider, openrouterProvider];

export function getProvider(id: AIProviderId | ""): AIProvider | null {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

/** The configured provider, or null when the user hasn't set one up. Null is a
 *  normal state, not an error — it's what hides every AI affordance. */
export function activeProvider(): AIProvider | null {
  const provider = getProvider(getSettings().ai.provider);
  if (!provider) return null;
  return provider.isAvailable() ? provider : null;
}

export function hasAIConfigured(): boolean {
  return activeProvider() !== null;
}

/**
 * The single entry point for every generation in the app.
 *
 * Wraps the chosen provider so that the two rules that must never be bypassed
 * are enforced in one place rather than per-call-site: a truncated response is
 * always a failure (D12), and a wall-clock timeout always applies even if the
 * provider's own request never resolves.
 */
export async function generate(
  opts: GenerateOpts & { timeoutMs?: number },
): Promise<GenerateResult> {
  const provider = activeProvider();
  if (!provider) throw new AIError("no-provider", "No AI provider configured.");

  const timeoutMs = opts.timeoutMs ?? 90_000;
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  // The caller's signal (a cancel button) and ours (the timeout) both need to
  // abort the request; AbortSignal.any is how you combine them.
  const signal = opts.signal
    ? AbortSignal.any([opts.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const result = await provider.generate({ ...opts, signal });
    if (result.stopReason === "length") {
      throw new AIError(
        "truncated",
        "The model hit its length limit without finishing.",
        true,
      );
    }
    return result;
  } catch (err) {
    // A timeout surfaces as an abort; distinguish it from a user cancellation,
    // because only one of the two deserves a "try again".
    if (err instanceof AIError && err.kind === "aborted" && timeoutController.signal.aborted) {
      throw new AIError("network", `Generation timed out after ${Math.round(timeoutMs / 1000)}s.`, true);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export interface KeyCheckResult {
  ok: boolean;
  message: string;
  /** Populated only by providers that implement `listModels`. */
  models: AIModelInfo[];
}

/**
 * Verifies the configured provider end to end.
 *
 * Listing models proves the *key* works. It does not prove the *chosen model*
 * works — a model can be listed and still have no quota, or be withdrawn, or
 * spend its whole budget thinking. Every failure this feature has actually hit
 * was of that second kind, so the check finishes with a real (tiny) generation
 * against the selected model rather than stopping at a successful key lookup.
 */
export async function checkProvider(): Promise<KeyCheckResult> {
  const provider = activeProvider();
  if (!provider) {
    return { ok: false, message: "No provider configured, or its key is empty.", models: [] };
  }

  let models: AIModelInfo[] = [];
  if (provider.listModels) {
    try {
      models = await provider.listModels(activeAIKey());
    } catch (err) {
      return { ok: false, message: describeAIError(err), models: [] };
    }
  }

  const model = aiModelFor(provider.id);
  try {
    // Small but not tiny: reasoning models bill thinking against the output
    // budget, so an allowance of a handful of tokens would fail on a working
    // setup. Providers add their own thinking headroom on top of this.
    await generate({ prompt: "Reply with the single word: OK", maxOutputTokens: 64, timeoutMs: 30_000 });
  } catch (err) {
    return {
      ok: false,
      message: `Key accepted, but "${model}" failed: ${describeAIError(err)}`,
      models,
    };
  }

  return {
    ok: true,
    message: models.length
      ? `Working — "${model}" responded. ${models.length} models available to this key.`
      : `Working — "${model}" responded.`,
    models,
  };
}

/**
 * Pulls JSON out of a model response.
 *
 * Even with a response schema, models wrap output in ```json fences often
 * enough that not handling it is a bug. Throws AIError rather than returning
 * null so every failure path through the wizard looks the same.
 */
export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    // Last resort: the model prefaced the JSON with prose. Take the outermost
    // brace-delimited span and try that.
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(unfenced.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
    throw new AIError("malformed", "The model's response wasn't valid JSON.", true);
  }
}
