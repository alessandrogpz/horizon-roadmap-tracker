"use client";

import React, { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

/** The active theme lives as `data-theme` on <html>: set pre-paint by the
 *  inline script in layout.tsx and persisted to localStorage under
 *  `horizon-theme`. We read it via useSyncExternalStore so there's no
 *  setState-in-effect and hydration is handled correctly — the server snapshot
 *  is "dark" and the client reconciles to the real value after mount (there's
 *  no visual flash because the pre-paint script already applied the theme). */
const THEME_EVENT = "horizon-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}

function getSnapshot(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function getServerSnapshot(): "light" | "dark" {
  return "dark";
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("horizon-theme", next);
    } catch {
      // localStorage unavailable (private mode) — theme still applies for this session.
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center w-7 h-7 rounded-md bg-transparent border border-card-border text-muted-foreground cursor-pointer hover:text-foreground hover:border-card-border-hover shrink-0 transition-colors"
      title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
      aria-label="Toggle light/dark theme"
      suppressHydrationWarning
    >
      {theme === "light" ? <Moon size={15} strokeWidth={2} /> : <Sun size={15} strokeWidth={2} />}
    </button>
  );
}
