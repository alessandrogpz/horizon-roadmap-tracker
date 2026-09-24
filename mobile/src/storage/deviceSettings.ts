// Settings that belong to this phone rather than to the account.
//
// Kept apart from `@shared/settings` on purpose. That blob is shared with the
// website — the rollover hour, which day a week starts on — and everything in
// it means something on both platforms. What is here does not: the step
// counter is this phone's hardware, and the website has no step counter to
// have an opinion about.
//
// Keeping it out of the workspace matters for a second reason. The server
// validates the workspace against a strict schema and refuses documents with
// fields it does not know (learning log 13, and the 0.21.x releases that
// taught it). A per-track display toggle is not worth a schema migration on
// the server and a field on every track, so it lives here, keyed by track id.
//
// The cost is honest and small: turning the step panel on for a track does not
// turn it on for the same track on another phone. That is arguably correct —
// the other phone is a different pedometer in a different pocket.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "horizon-device";

interface DeviceSettings {
  /** track id -> whether the step panel is shown on Today for that track. */
  stepsByTrack: Record<string, boolean>;
}

const EMPTY: DeviceSettings = { stepsByTrack: {} };

// Read once into memory so screens can ask synchronously during render, the
// same shape `@shared/settings` uses and for the same reason.
let cache: DeviceSettings = EMPTY;

export async function loadDeviceSettings(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<DeviceSettings>) } : EMPTY;
  } catch {
    // Unreadable or absent: the defaults are a perfectly good answer.
    cache = EMPTY;
  }
}

/** Off unless it has been turned on. A step counter that appeared on every
 *  track by default would be noise on most of them — which is the whole reason
 *  this setting exists. */
export function stepsEnabled(trackId: string | null | undefined): boolean {
  return trackId ? cache.stepsByTrack[trackId] === true : false;
}

export function setStepsEnabled(trackId: string, enabled: boolean): void {
  cache = { ...cache, stepsByTrack: { ...cache.stepsByTrack, [trackId]: enabled } };
  void AsyncStorage.setItem(KEY, JSON.stringify(cache));
}

/** Used by "delete local data", which should mean all of it. */
export async function clearDeviceSettings(): Promise<void> {
  cache = EMPTY;
  await AsyncStorage.removeItem(KEY);
}
