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

export interface AppSettings {
  /** Hour (0-11, local) at which a new day begins. 0 = calendar midnight.
   *  Set it to 4 and work logged at 01:00 still counts for the previous day. */
  dayRolloverHour: number;
  /** Which column the consistency grid starts its weeks on. */
  weekStartsOn: "sun" | "mon";
}

export const DEFAULT_SETTINGS: AppSettings = {
  dayRolloverHour: 0,
  weekStartsOn: "sun",
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

/** Merges a stored (possibly older, possibly hand-edited) blob over the
 *  defaults, so a missing or malformed field can never break the app. */
function normalize(raw: unknown): AppSettings {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<AppSettings>;
  return {
    dayRolloverHour: clampHour(obj.dayRolloverHour),
    weekStartsOn: obj.weekStartsOn === "mon" ? "mon" : "sun",
  };
}

export function getSettings(): AppSettings {
  if (cache) return cache;
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const raw: unknown = stored ? JSON.parse(stored) : {};
    cache = normalize(raw);
    // 0.14 and 0.15 kept bring-your-own AI provider keys in this blob. The
    // feature is gone, so don't leave a live API key sitting in storage with
    // nothing using it: rewrite the blob without it.
    if (raw && typeof raw === "object" && "ai" in raw) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
      } catch {
        // Storage refused the write; the next page load tries again.
      }
    }
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
