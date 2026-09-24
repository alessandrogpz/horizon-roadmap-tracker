// The phone's home for the device settings blob.
//
// `lib/settings.ts` reads synchronously — it is called from "which day is it"
// on every render — and a phone's key-value store is asynchronous. The gap is
// bridged by loading the blob once at startup and keeping it in memory, then
// writing through to storage in the background. A write that hasn't landed yet
// costs nothing: the in-memory copy is what the app reads, and the next launch
// loads whatever did land.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSettingsStore, type SettingsStore } from "@shared/settings";

const KEY = "horizon-settings";

let blob: string | null = null;

const store: SettingsStore = {
  read: () => blob,
  write: (value) => {
    blob = value;
    void AsyncStorage.setItem(KEY, value);
  },
  remove: () => {
    blob = null;
    void AsyncStorage.removeItem(KEY);
  },
};

/** Call once, before the first screen renders. */
export async function loadSettings(): Promise<void> {
  try {
    blob = await AsyncStorage.getItem(KEY);
  } catch {
    // Storage unavailable: the defaults apply for this session.
    blob = null;
  }
  useSettingsStore(store);
}
