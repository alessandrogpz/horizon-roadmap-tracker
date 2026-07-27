// OpenRouter via the user's own key — an alternative to Gemini that reaches
// many models behind one OpenAI-shaped API, including several free ones.
//
// Kept as a second option rather than the default because model choice is
// explicit here, and structured-output support varies by model: OpenRouter
// passes `response_format` through to the upstream provider, which may ignore
// it. The validator assumes nothing either way.

import { AIError, type AIProvider, type GenerateOpts, type GenerateResult } from "../types";
import { getSettings } from "../../settings";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

async function generate(opts: GenerateOpts): Promise<GenerateResult> {
  const { openrouterKey: key, openrouterModel: model } = getSettings().ai;
  if (!key) throw new AIError("auth", "No OpenRouter API key configured.");

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: opts.prompt }],
    temperature: 0.7,
    // D12 — mandatory cap, same reasoning as the Gemini provider.
    max_tokens: opts.maxOutputTokens,
    ...(opts.schema
      ? {
          response_format: {
            type: "json_schema",
            json_schema: { name: "roadmap", strict: true, schema: opts.schema },
          },
        }
      : {}),
  };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        // OpenRouter attributes requests to an app via these. Harmless to send
        // and it keeps Horizon identifiable in the user's own usage dashboard.
        "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
        "X-Title": "Horizon",
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AIError("aborted", "Generation cancelled.");
    }
    throw new AIError("network", "Couldn't reach OpenRouter.", true);
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new AIError("auth", "OpenRouter rejected the API key.");
    }
    if (res.status === 429) throw new AIError("rate-limit", "OpenRouter rate limit reached.", true);
    if (res.status === 402) {
      throw new AIError("auth", "OpenRouter reports insufficient credit for this model.");
    }
    throw new AIError("unknown", `OpenRouter returned ${res.status}.`, res.status >= 500);
  }

  const json = await res.json();
  const choice = json?.choices?.[0];
  const stopReason: GenerateResult["stopReason"] = choice?.finish_reason === "length" ? "length" : "stop";
  const text: string = choice?.message?.content ?? "";

  if (!text && stopReason === "stop") {
    throw new AIError("malformed", "OpenRouter returned an empty response.", true);
  }

  return { text, stopReason };
}

export const openrouterProvider: AIProvider = {
  id: "byok-openrouter",
  label: "OpenRouter",
  hint: "Your key, many models — including free ones.",
  keyUrl: "https://openrouter.ai/keys",
  keyPlaceholder: "sk-or-…",
  isAvailable: () => getSettings().ai.openrouterKey.length > 0,
  generate,
  // Deliberately no listModels: OpenRouter routes to hundreds of models, and a
  // dropdown that long is worse than typing the slug. The key check below still
  // verifies the key and the chosen model together.
};
