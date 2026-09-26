// Light, dark, or whatever the phone is doing.
//
// The website keeps the same three-way choice under its own `horizon-theme`
// key, read before the first paint so the page never flashes the wrong colours.
// A phone has no flash to avoid — the splash screen covers the gap — but the
// choice should persist, and every screen should ask one place for its palette
// rather than reading the system scheme directly.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DARK, LIGHT, type Palette } from "../theme";

const KEY = "horizon-theme";

/** What the person has pinned. `null` means they have not pinned anything, so
 *  the phone's own setting decides — which is the state every install starts
 *  in and the reason there is no "system" button to press. */
export type ThemePreference = "light" | "dark" | null;

interface ThemeValue {
  palette: Palette;
  /**
   * Paints the app in the open track's colour.
   *
   * The accent is the one colour that says "this is the thing you are looking
   * at" — the ticked box, the ring on Plan, the link you can follow — so it is
   * the right place to say *which* track you are in. Passing `null` puts the
   * default back, which is what a screen with no track open wants.
   *
   * This lives here rather than being read from the workspace because the
   * theme is mounted above it: the palette has to exist before anything can
   * ask for one, including the provider that knows which track is open.
   */
  setAccent: (color: string | null) => void;
  /** What the user asked for, which may be "follow the phone". */
  preference: ThemePreference;
  /** Which of the two is actually being shown right now. */
  resolved: "light" | "dark";
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function usePalette(): Palette {
  return useTheme().palette;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setStored] = useState<ThemePreference>(null);
  const [accent, setAccentState] = useState<string | null>(null);

  const setAccent = useCallback((color: string | null) => {
    // Guarded because this is called on every workspace change, and setting a
    // colour to the colour it already is would re-render every screen.
    setAccentState((current) => (current === color ? current : color));
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((value) => {
        // Anything else, including the "system" this used to store, means
        // unpinned — which is the correct reading of it.
        if (value === "light" || value === "dark") setStored(value);
      })
      .catch(() => undefined);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setStored(next);
    if (next === null) void AsyncStorage.removeItem(KEY).catch(() => undefined);
    else void AsyncStorage.setItem(KEY, next).catch(() => undefined);
  }, []);

  const resolved: "light" | "dark" = preference ?? (system === "light" ? "light" : "dark");

  const value = useMemo<ThemeValue>(() => {
    const base = resolved === "light" ? LIGHT : DARK;
    return {
      palette: accent ? { ...base, accent } : base,
      preference,
      resolved,
      setPreference,
      setAccent,
    };
  }, [resolved, preference, setPreference, accent, setAccent]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
