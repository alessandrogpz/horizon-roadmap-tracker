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

  const value = useMemo<ThemeValue>(
    () => ({ palette: resolved === "light" ? LIGHT : DARK, preference, resolved, setPreference }),
    [resolved, preference, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
