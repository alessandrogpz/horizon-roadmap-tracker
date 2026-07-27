import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkProvider, generate, parseModelJson } from "../ai/provider";
import { AIError, describeAIError } from "../ai/types";
import {
  aiKeyFor,
  aiModelFor,
  resetSettings,
  setAIKeyFor,
  setAIModelFor,
  updateAISettings,
} from "../settings";

// A minimal localStorage, since these run in node.
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

/** Shapes a Gemini REST response. */
const geminiResponse = (text: string, finishReason = "STOP") => ({
  ok: true,
  json: async () => ({
    candidates: [{ finishReason, content: { parts: [{ text }] } }],
  }),
});

beforeEach(() => {
  vi.stubGlobal("window", {
    localStorage: new MemoryStorage(),
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { origin: "http://localhost" },
  });
  resetSettings();
  updateAISettings({ provider: "byok-gemini", geminiKey: "test-key" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("generate — the D12 guarantees", () => {
  it("always sends the token cap to the provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse("hello"));
    vi.stubGlobal("fetch", fetchMock);

    await generate({ prompt: "p", maxOutputTokens: 3000 });

    const { generationConfig } = JSON.parse(fetchMock.mock.calls[0][1].body);
    // Gemini bills thinking against maxOutputTokens, so the wire value is the
    // caller's output allowance plus a bounded thinking budget. Sending 3000
    // flat leaves reasoning to consume all of it and return nothing.
    expect(generationConfig.thinkingConfig.thinkingBudget).toBeGreaterThan(0);
    expect(generationConfig.maxOutputTokens).toBe(
      3000 + generationConfig.thinkingConfig.thinkingBudget,
    );
  });

  it("retries without thinkingConfig for models that reject it", async () => {
    // The model is user-configurable, so an older non-thinking model must not
    // be a dead end.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "",
        text: async () =>
          JSON.stringify({ error: { message: "thinkingConfig is not supported", status: "INVALID_ARGUMENT" } }),
      })
      .mockResolvedValueOnce(geminiResponse("ok"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generate({ prompt: "p", maxOutputTokens: 3000 });

    expect(result.text).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retry = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(retry.generationConfig.thinkingConfig).toBeUndefined();
    expect(retry.generationConfig.maxOutputTokens).toBe(3000);
  });

  it("does not retry a 400 that has nothing to do with thinking", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "",
      text: async () => JSON.stringify({ error: { message: "Invalid responseSchema" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const err = await generate({ prompt: "p", maxOutputTokens: 3000 }).catch((e) => e);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(err.kind).toBe("malformed");
    // The detail read while deciding about the retry must still reach the user.
    expect(err.message).toContain("Invalid responseSchema");
  });

  it("treats a truncated response as a failure, never as parseable output", async () => {
    // The exact failure that ran away to 81k tokens in screening. A partial
    // roadmap must not reach the validator, however plausible it looks.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse('{"name":"Half a roa', "MAX_TOKENS")));

    await expect(generate({ prompt: "p", maxOutputTokens: 10 })).rejects.toMatchObject({
      kind: "truncated",
      retryable: true,
    });
  });

  it("aborts the request when the wall-clock timeout expires", async () => {
    // Verifies the signal actually reaches fetch, rather than the UI merely
    // hiding a spinner while generation keeps billing.
    let seenSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        seenSignal = init.signal as AbortSignal;
        return new Promise((_resolve, reject) => {
          seenSignal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        });
      }),
    );

    const promise = generate({ prompt: "p", maxOutputTokens: 100, timeoutMs: 20 });
    await expect(promise).rejects.toMatchObject({ kind: "network", retryable: true });
    expect(seenSignal?.aborted).toBe(true);
  });

  it("reports a caller's cancellation as aborted, not as a retryable error", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        const signal = init.signal as AbortSignal;
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      }),
    );

    const promise = generate({ prompt: "p", maxOutputTokens: 100, signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ kind: "aborted", retryable: false });
  });
});

describe("generate — provider and transport errors", () => {
  it("fails clearly when no provider is configured", async () => {
    updateAISettings({ provider: "" });
    await expect(generate({ prompt: "p", maxOutputTokens: 100 })).rejects.toMatchObject({
      kind: "no-provider",
    });
  });

  /** An error response shaped the way Google actually sends them. */
  const errorResponse = (status: number, message: string, apiStatus = "") => ({
    ok: false,
    status,
    statusText: "",
    text: async () => JSON.stringify({ error: { message, status: apiStatus } }),
  });

  it("maps a rejected key to an auth error that is not worth retrying", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(403, "API key not valid")));
    await expect(generate({ prompt: "p", maxOutputTokens: 100 })).rejects.toMatchObject({
      kind: "auth",
      retryable: false,
    });
  });

  it("maps a rate limit to a retryable error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(429, "Quota exceeded")));
    await expect(generate({ prompt: "p", maxOutputTokens: 100 })).rejects.toMatchObject({
      kind: "rate-limit",
      retryable: true,
    });
  });

  it("surfaces the provider's own explanation rather than swallowing it", async () => {
    // The whole point: a 429 can mean "too fast" OR "this model has no
    // free-tier quota". Only Google's text distinguishes them, so it must
    // reach the user.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        errorResponse(429, "Quota exceeded for quota metric 'Generate requests'", "RESOURCE_EXHAUSTED"),
      ),
    );

    const err = await generate({ prompt: "p", maxOutputTokens: 100 }).catch((e) => e);
    expect(err.message).toContain("Quota exceeded for quota metric");
    expect(err.message).toContain("RESOURCE_EXHAUSTED");
    expect(describeAIError(err)).toContain("Quota exceeded for quota metric");
  });

  it("does not report a malformed request as a bad API key", async () => {
    // 400 usually means the responseSchema was rejected. Calling that an auth
    // failure sends the user to re-check a key that was never the problem.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(errorResponse(400, "Invalid JSON payload received.", "INVALID_ARGUMENT")),
    );

    const err = await generate({ prompt: "p", maxOutputTokens: 100 }).catch((e) => e);
    expect(err.kind).toBe("malformed");
    expect(err.message).toContain("Invalid JSON payload");
  });

  it("names the model when it is unavailable to the key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(404, "models/x is not found")));
    const err = await generate({ prompt: "p", maxOutputTokens: 100 }).catch((e) => e);
    expect(err.message).toContain("gemini-flash-latest");
  });

  it("maps a transport failure to a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(generate({ prompt: "p", maxOutputTokens: 100 })).rejects.toMatchObject({
      kind: "network",
      retryable: true,
    });
  });

  it("never sends the key anywhere but the provider's own endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await generate({ prompt: "p", maxOutputTokens: 100 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^https:\/\/generativelanguage\.googleapis\.com\//);
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
    // The key must never leak into the prompt or the query string.
    expect(url).not.toContain("test-key");
    expect(init.body).not.toContain("test-key");
  });
});

describe("parseModelJson", () => {
  it("parses plain JSON", () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("unwraps a fenced block", () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("recovers JSON that the model prefaced with prose", () => {
    expect(parseModelJson('Here is your roadmap:\n{"a":1}\nHope that helps!')).toEqual({ a: 1 });
  });

  it("throws a typed error rather than a SyntaxError", () => {
    expect(() => parseModelJson("not json at all")).toThrowError(AIError);
    try {
      parseModelJson("not json at all");
    } catch (err) {
      expect((err as AIError).kind).toBe("malformed");
    }
  });
});

describe("checkProvider", () => {
  it("reports success only when the chosen model actually answers", async () => {
    // Listing models proves the key works. It does not prove the model does —
    // every real failure this feature hit was a listed model that then refused.
    const fetchMock = vi
      .fn()
      // listModels
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: "models/gemini-flash-latest", displayName: "Flash", supportedGenerationMethods: ["generateContent"] }],
        }),
      })
      // the probe generation
      .mockResolvedValueOnce(geminiResponse("OK"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkProvider();
    expect(result.ok).toBe(true);
    expect(result.models).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails when the key lists models but the model refuses to answer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: "models/x", displayName: "X", supportedGenerationMethods: ["generateContent"] }],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "",
        text: async () => JSON.stringify({ error: { message: "Quota exceeded", status: "RESOURCE_EXHAUSTED" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkProvider();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Quota exceeded");
    // The model list is still returned so the user can pick a different one.
    expect(result.models).toHaveLength(1);
  });

  it("fails cleanly when no provider is configured", async () => {
    updateAISettings({ provider: "" });
    const result = await checkProvider();
    expect(result.ok).toBe(false);
    expect(result.models).toEqual([]);
  });
});

describe("per-provider settings accessors", () => {
  it("reads and writes the field belonging to each provider", () => {
    setAIKeyFor("byok-gemini", "gem-key");
    setAIKeyFor("byok-openrouter", "or-key");
    setAIModelFor("byok-gemini", "gem-model");
    setAIModelFor("byok-openrouter", "or-model");

    expect(aiKeyFor("byok-gemini")).toBe("gem-key");
    expect(aiKeyFor("byok-openrouter")).toBe("or-key");
    expect(aiModelFor("byok-gemini")).toBe("gem-model");
    expect(aiModelFor("byok-openrouter")).toBe("or-model");
    // Switching providers must not discard the other one's saved key.
    expect(aiKeyFor("byok-gemini")).toBe("gem-key");
  });

  it("returns empty for a provider with no key of its own", () => {
    expect(aiKeyFor("")).toBe("");
    expect(aiModelFor("builtin")).toBe("");
  });
});
