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

export type ThemePreference = "light" | "dark" | "system";

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
  const [preference, setStored] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((value) => {
        if (value === "light" || value === "dark" || value === "system") setStored(value);
      })
      .catch(() => undefined);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setStored(next);
    void AsyncStorage.setItem(KEY, next).catch(() => undefined);
  }, []);

  const resolved: "light" | "dark" = preference === "system" ? (system === "light" ? "light" : "dark") : preference;

  const value = useMemo<ThemeValue>(
    () => ({ palette: resolved === "light" ? LIGHT : DARK, preference, resolved, setPreference }),
    [resolved, preference, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
