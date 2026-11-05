"use client";

import React, { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import { THEME_EVENT, resolvedTheme, setThemePreference } from "@/lib/theme";

/** The active theme lives as `data-theme` on <html>: set pre-paint by the
 *  inline script in layout.tsx and persisted to localStorage under
 *  `horizon-theme`. We read it via useSyncExternalStore so there's no
 *  setState-in-effect and hydration is handled correctly — the server snapshot
 *  is "dark" and the client reconciles to the real value after mount (there's
 *  no visual flash because the pre-paint script already applied the theme).
 *
 *  This is the quick flip: it pins light or dark. The three-way choice,
 *  including "follow my system", lives in Settings. */

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, resolvedTheme, () => "dark" as const);

  return (
    <button
      onClick={() => setThemePreference(theme === "light" ? "dark" : "light")}
      className="tap-44 flex items-center justify-center w-7 h-7 rounded-md bg-transparent border border-card-border text-muted-foreground cursor-pointer hover:text-foreground hover:border-card-border-hover shrink-0 transition-colors"
      title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
      aria-label="Toggle light/dark theme"
      suppressHydrationWarning
    >
      {theme === "light" ? <Moon size={15} strokeWidth={2} /> : <Sun size={15} strokeWidth={2} />}
    </button>
  );
}
