// Device-level app preferences: the handful of choices that belong to this
// browser rather than to a track. Kept in localStorage, deliberately *not* in
// the synced workspace — they describe how this device behaves (when your day
// rolls over, how it draws a week), so syncing them would let one device
// silently reconfigure another. The theme is the same idea and
// already lives under its own `horizon-theme` key, read pre-paint by the
// inline script in app/layout.tsx.
//
// Framework-free, and safe to call during SSR or in a node test (both fall
// back to the defaults / an in-memory copy).

import type { AIProviderId } from "./ai/types";

/** Bring-your-own-key AI config. Lives here — rather than on the workspace —
 *  specifically because this file is the *unsynced* one: a key written into a
 *  track would be serialised into database.json and uploaded to the user's
 *  Google Drive. See AI_ROADMAP_PLAN.md D11. */
export interface AISettings {
  /** "" means no provider configured; the AI affordances stay hidden. */
  provider: AIProviderId | "";
  /** Per-provider so switching back and forth doesn't discard a working key. */
  geminiKey: string;
  openrouterKey: string;
  /** Model ids come and go, and free-tier eligibility changes under them. Both
   *  are editable so a stale default is a setting to change, not a dead end. */
  geminiModel: string;
  openrouterModel: string;
}

export interface AppSettings {
  /** Hour (0-11, local) at which a new day begins. 0 = calendar midnight.
   *  Set it to 4 and work logged at 01:00 still counts for the previous day. */
  dayRolloverHour: number;
  /** Which column the consistency grid starts its weeks on. */
  weekStartsOn: "sun" | "mon";
  ai: AISettings;
}

export const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.0-flash-exp:free";
/**
 * An alias, not a pinned version, and deliberately so.
 *
 * Pinned ids rot: `gemini-2.0-flash` lost its free-tier quota (surfacing as a
 * baffling 429 on a brand-new key) and `gemini-2.5-flash` was withdrawn from
 * new users entirely. Both failures land on the user as an error about a model
 * they never chose. `gemini-flash-latest` tracks whatever the current GA Flash
 * is, so the default ages gracefully.
 *
 * The trade-off is real — an alias can shift model behaviour underneath us —
 * but it is the lesser risk here: the field is user-editable, "Check key" lists
 * what this key can actually reach, and every generation is reviewed by a human
 * in the wizard before anything is saved.
 *
 * Flash is the right tier: one ~3k-token generation per roadmap. Flash-Lite has
 * higher quota but is weaker, and screening showed weak models fail this task
 * badly; Pro is overkill and carries the lowest free-tier request ceiling.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: "",
  geminiKey: "",
  openrouterKey: "",
  geminiModel: DEFAULT_GEMINI_MODEL,
  openrouterModel: DEFAULT_OPENROUTER_MODEL,
};

export const DEFAULT_SETTINGS: AppSettings = {
  dayRolloverHour: 0,
  weekStartsOn: "sun",
  ai: DEFAULT_AI_SETTINGS,
};

export const SETTINGS_EVENT = "horizon-settings-change";
const STORAGE_KEY = "horizon-settings";

/** Read once, then held in memory: getSettings() is called from date helpers on
 *  hot paths, and localStorage access is synchronous I/O. Invalidated on every
 *  write, and on another tab's write via the `storage` event below. */
let cache: AppSettings | null = null;

const clampHour = (value: unknown): number => {
  const n = typeof value === "number" ? Math.floor(value) : NaN;
  return Number.isFinite(n) ? Math.min(11, Math.max(0, n)) : DEFAULT_SETTINGS.dayRolloverHour;
};

const AI_PROVIDERS: readonly string[] = ["builtin", "byok-gemini", "byok-openrouter"];

/** Gemini ids we shipped as defaults that Google has since withdrawn. A stored
 *  value is normally left alone — it's the user's choice — but these were never
 *  chosen, they were inherited from an older default, and leaving them in place
 *  means the feature stays broken until someone edits a setting they don't know
 *  exists. Anything the user typed themselves is preserved. */
const RETIRED_GEMINI_MODELS: readonly string[] = ["gemini-2.0-flash", "gemini-2.5-flash"];

/** Trims and length-caps a stored string. The cap is generous next to any real
 *  key, and exists only so a corrupted blob can't put megabytes on a request. */
const cleanKey = (value: unknown): string =>
  typeof value === "string" ? value.trim().slice(0, 512) : "";

function normalizeAI(raw: unknown): AISettings {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<AISettings>;
  const provider = typeof obj.provider === "string" && AI_PROVIDERS.includes(obj.provider)
    ? (obj.provider as AIProviderId)
    : "";
  const openrouterModel = cleanKey(obj.openrouterModel);
  const storedGemini = cleanKey(obj.geminiModel);
  const geminiModel =
    !storedGemini || RETIRED_GEMINI_MODELS.includes(storedGemini)
      ? DEFAULT_GEMINI_MODEL
      : storedGemini;
  return {
    provider,
    geminiKey: cleanKey(obj.geminiKey),
    openrouterKey: cleanKey(obj.openrouterKey),
    geminiModel,
    openrouterModel: openrouterModel || DEFAULT_OPENROUTER_MODEL,
  };
}

/** Merges a stored (possibly older, possibly hand-edited) blob over the
 *  defaults, so a missing or malformed field can never break the app. */
function normalize(raw: unknown): AppSettings {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<AppSettings>;
  return {
    dayRolloverHour: clampHour(obj.dayRolloverHour),
    weekStartsOn: obj.weekStartsOn === "mon" ? "mon" : "sun",
    ai: normalizeAI(obj.ai),
  };
}

export function getSettings(): AppSettings {
  if (cache) return cache;
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    cache = normalize(stored ? JSON.parse(stored) : {});
  } catch {
    cache = { ...DEFAULT_SETTINGS };
  }
  return cache;
}

/** Applies a partial change, persists it, and notifies subscribers. Returns
 *  the settings as they now stand. */
export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const next = normalize({ ...getSettings(), ...patch });
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  } catch {
    // Private mode, or a non-browser test environment: the in-memory copy
    // above still applies for this session.
  }
  return next;
}

/** Patches the nested AI block. `updateSettings` merges shallowly, so passing a
 *  partial `ai` object to it would silently drop the other AI fields — this
 *  exists so callers can't hit that. */
export function updateAISettings(patch: Partial<AISettings>): AppSettings {
  return updateSettings({ ai: { ...getSettings().ai, ...patch } });
}

/** The key for whichever provider is selected, or "" when none applies.
 *  `builtin` has no key by design — the browser owns the model. */
export function activeAIKey(settings: AppSettings = getSettings()): string {
  return aiKeyFor(settings.ai.provider, settings);
}

// The per-provider fields below are addressed through these accessors so UI
// code never has to know which settings field belongs to which provider.
// Deliberately a switch rather than a Record keyed by provider id: the stored
// shape stays as it is, so adding a provider later doesn't migrate — or
// discard — a key someone already saved.

export function aiKeyFor(provider: AIProviderId | "", settings: AppSettings = getSettings()): string {
  switch (provider) {
    case "byok-gemini": return settings.ai.geminiKey;
    case "byok-openrouter": return settings.ai.openrouterKey;
    default: return "";
  }
}

export function setAIKeyFor(provider: AIProviderId | "", key: string): AppSettings {
  switch (provider) {
    case "byok-gemini": return updateAISettings({ geminiKey: key });
    case "byok-openrouter": return updateAISettings({ openrouterKey: key });
    default: return getSettings();
  }
}

export function aiModelFor(provider: AIProviderId | "", settings: AppSettings = getSettings()): string {
  switch (provider) {
    case "byok-gemini": return settings.ai.geminiModel;
    case "byok-openrouter": return settings.ai.openrouterModel;
    default: return "";
  }
}

export function setAIModelFor(provider: AIProviderId | "", model: string): AppSettings {
  switch (provider) {
    case "byok-gemini": return updateAISettings({ geminiModel: model });
    case "byok-openrouter": return updateAISettings({ openrouterModel: model });
    default: return getSettings();
  }
}

/** Test seam — drops the cache and the stored blob. */
export function resetSettings(): void {
  cache = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored to clear.
  }
}

/** Subscribe to changes, including ones made in another tab. */
export function subscribeSettings(callback: () => void): () => void {
  const onExternal = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      callback();
    }
  };
  window.addEventListener(SETTINGS_EVENT, callback);
  window.addEventListener("storage", onExternal);
  return () => {
    window.removeEventListener(SETTINGS_EVENT, callback);
    window.removeEventListener("storage", onExternal);
  };
}
