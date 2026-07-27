// The provider-agnostic surface every AI backend implements.
//
// Horizon runs no inference of its own: there is no Horizon-operated model, no
// API key held by us, and no server in this repo that could host one. Every
// path here is either the browser's own built-in model or the user's own key.
// That constraint is the reason this abstraction is deliberately thin — it
// exists to keep provider quirks out of the wizard, not to be a plugin system.

/** Which backend produced a generation. Ordered by preference in provider.ts. */
export type AIProviderId = "builtin" | "byok-gemini" | "byok-openrouter";

export interface GenerateOpts {
  /** The full prompt, system framing already applied by the caller. */
  prompt: string;
  /** JSON Schema constraining the response. Omit for free-form prose. */
  schema?: object;
  signal?: AbortSignal;
  /**
   * Hard ceiling on generated tokens. Required, never optional.
   *
   * Model screening found that ~23% of small-model generations never emitted a
   * stop token at all — the schema permits unbounded array repetition, so a
   * model that fails to stop simply appends forever. Two runs reached 40k and
   * 81k tokens before being killed. On a BYO key that is the *user's* money
   * being spent, silently, which makes this a trust issue rather than a
   * performance one. See AI_ROADMAP_PLAN.md D12.
   */
  maxOutputTokens: number;
}

export interface GenerateResult {
  /** Raw response text. Parsing is the caller's job — see parseModelJson(). */
  text: string;
  /**
   * Why generation ended. `"length"` means the cap above was hit, which is
   * always a failure: a truncated response is not a short response, it is an
   * unfinished one. Callers must not attempt to parse or repair it.
   */
  stopReason: "stop" | "length";
}

export interface AIModelInfo {
  id: string;
  label: string;
}

export interface AIProvider {
  id: AIProviderId;
  label: string;
  /** Short phrase for the settings UI, e.g. "Free tier, no card required". */
  hint: string;
  /** Where to get a key. Shown in settings; omit for providers that need none. */
  keyUrl?: string;
  /** Placeholder for the key field — key formats differ visibly per provider. */
  keyPlaceholder?: string;
  /** Whether this provider can run right now — key present, API detected. */
  isAvailable(): boolean | Promise<boolean>;
  generate(opts: GenerateOpts): Promise<GenerateResult>;
  /**
   * Optional: ask the provider which models this key can reach, so the settings
   * UI can offer a list instead of a free-text field. Providers that expose
   * hundreds of models are better served by the text field, so this is not
   * required.
   */
  listModels?(key: string, signal?: AbortSignal): Promise<AIModelInfo[]>;
}

/**
 * Everything that can go wrong, mapped to something the wizard can show a user
 * and decide whether to offer a retry for. Provider SDKs and fetch() surface
 * these very differently; normalising here keeps that mess out of the UI.
 */
export type AIErrorKind =
  | "no-provider"     // nothing configured
  | "auth"            // key missing, malformed, or rejected
  | "rate-limit"      // quota or per-minute limit
  | "network"         // offline, DNS, CORS, connection reset
  | "truncated"       // hit maxOutputTokens (D12)
  | "malformed"       // returned something that isn't the JSON we asked for
  | "aborted"         // user cancelled
  | "unknown";

export class AIError extends Error {
  readonly kind: AIErrorKind;
  /** Whether offering "try again" is honest, or just theatre. */
  readonly retryable: boolean;

  constructor(kind: AIErrorKind, message: string, retryable = false) {
    super(message);
    this.name = "AIError";
    this.kind = kind;
    this.retryable = retryable;
  }
}

/**
 * User-facing copy. Deliberately plain, and honest about whose fault it is.
 *
 * Guidance first, then the provider's own words. Suppressing the underlying
 * message entirely is what made a "rate limit" indistinguishable from a model
 * that has no free-tier quota at all — the advice ("wait a minute") was wrong
 * for the actual problem, and the text that would have explained it was thrown
 * away. Anything the provider tells us gets shown.
 */
export function describeAIError(err: unknown): string {
  if (!(err instanceof AIError)) {
    return err instanceof Error ? err.message : "Generation failed.";
  }

  const guidance = (): string => {
    switch (err.kind) {
      case "no-provider":
        return "No AI provider is set up yet. Add a key in Settings to use this.";
      case "auth":
        return "That API key was rejected. Check it in Settings — keys are stored on this device only.";
      case "rate-limit":
        return "The provider refused on quota. If this happened on the first try, the model may have no free-tier quota rather than you being rate-limited — use “Check key” in Settings to see what this key can reach.";
      case "network":
        return "Couldn't reach the provider. Check your connection and try again.";
      case "truncated":
        return "The model hit its length limit before finishing. If this keeps happening, try a different model in Settings — reasoning-heavy models spend the whole budget thinking and leave nothing for the answer.";
      case "malformed":
        return "The provider rejected the request or returned something unusable.";
      case "aborted":
        return "Generation cancelled.";
      default:
        return "Generation failed.";
    }
  };

  if (err.kind === "aborted" || !err.message) return guidance();
  return `${guidance()}\n\nProvider said: ${err.message}`;
}
