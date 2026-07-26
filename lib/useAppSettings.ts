"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, getSettings, subscribeSettings, type AppSettings } from "./settings";

/** Live app settings. Same shape as `getSettings()`, but re-renders the
 *  component whenever they change — including from another tab. The server
 *  snapshot is the defaults; the client reconciles after mount, which is
 *  invisible because nothing here affects first paint (the theme, which does,
 *  is applied pre-paint by the inline script in app/layout.tsx). */
export function useAppSettings(): AppSettings {
  return useSyncExternalStore(subscribeSettings, getSettings, () => DEFAULT_SETTINGS);
}
