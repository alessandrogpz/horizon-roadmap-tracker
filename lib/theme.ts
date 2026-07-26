// The theme, in three states. `horizon-theme` in localStorage holds the user's
// *preference*: "light" and "dark" pin it, and no stored value means "follow
// the system" — which is why choosing System clears the key rather than storing
// a third word. The inline script in app/layout.tsx reads exactly this before
// first paint, so the two must agree on the encoding.

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "horizon-theme";
export const THEME_EVENT = "horizon-theme-change";

export function getThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function systemTheme(): ResolvedTheme {
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** What's actually on <html> right now. */
export function resolvedTheme(): ResolvedTheme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function setThemePreference(preference: ThemePreference): void {
  const resolved = preference === "system" ? systemTheme() : preference;
  document.documentElement.setAttribute("data-theme", resolved);
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, preference);
  } catch {
    // Private mode — the attribute above still applies for this session.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}
