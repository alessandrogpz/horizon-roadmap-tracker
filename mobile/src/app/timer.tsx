// A focus timer: twenty-five minutes of work, five of rest, the usual shape.
//
// The phone is a better home for this than the laptop — it can sit next to you
// while you work on something else — but it comes with the platform's central
// constraint: JavaScript timers do not run while the app is in the background.
// Android suspends them, and on a locked phone nothing ticks at all.
//
// So the timer does not count ticks. It records the moment it should finish and
// derives the remaining time from the clock, every second while visible and once
// more whenever the app comes back. Coming back from ten minutes away shows the
// right number — or "done" — rather than ten minutes of lost countdown. A
// notification when it ends would need a native module and a new build; this
// screen says so rather than pretending.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus, Pressable, StyleSheet, Text, View } from "react-native";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

const MINUTES = { focus: 25, rest: 5 } as const;
type Mode = keyof typeof MINUTES;

export default function TimerScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [mode, setMode] = useState<Mode>("focus");
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(MINUTES.focus * 60_000);
  const paused = useRef<number | null>(null);

  const recompute = useCallback(() => {
    if (endsAt === null) return;
    setRemaining(Math.max(0, endsAt - Date.now()));
  }, [endsAt]);

  // One tick a second while the screen is up. Nothing depends on it being
  // accurate — it only refreshes a number the clock already decided.
  useEffect(() => {
    if (endsAt === null) return;
    recompute();
    const interval = setInterval(recompute, 1000);
    return () => clearInterval(interval);
  }, [endsAt, recompute]);

  // Back from the background: the clock moved on even though this app didn't.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === "active") recompute();
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, [recompute]);

  const start = useCallback(
    (which: Mode) => {
      setMode(which);
      paused.current = null;
      setEndsAt(Date.now() + MINUTES[which] * 60_000);
      setRemaining(MINUTES[which] * 60_000);
    },
    []
  );

  const pause = useCallback(() => {
    if (endsAt === null) return;
    paused.current = Math.max(0, endsAt - Date.now());
    setEndsAt(null);
    setRemaining(paused.current);
  }, [endsAt]);

  const resume = useCallback(() => {
    const left = paused.current ?? MINUTES[mode] * 60_000;
    paused.current = null;
    setEndsAt(Date.now() + left);
  }, [mode]);

  const reset = useCallback(() => {
    paused.current = null;
    setEndsAt(null);
    setRemaining(MINUTES[mode] * 60_000);
  }, [mode]);

  const running = endsAt !== null;
  const finished = running && remaining === 0;
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return (
    <View style={styles.screen}>
      <View style={styles.modes}>
        {(Object.keys(MINUTES) as Mode[]).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === option }}
            onPress={() => start(option)}
            style={[styles.mode, mode === option && { borderColor: palette.accent }]}
          >
            <Text style={[styles.modeLabel, mode === option && { color: palette.foreground }]}>
              {option === "focus" ? "Focus · 25" : "Rest · 5"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.clock, finished && { color: palette.success }]}>
        {finished ? "done" : `${minutes}:${String(seconds).padStart(2, "0")}`}
      </Text>

      <View style={styles.controls}>
        {!running && paused.current === null && (
          <Pressable accessibilityRole="button" onPress={() => start(mode)} style={[styles.button, styles.primary]}>
            <Text style={styles.primaryLabel}>Start</Text>
          </Pressable>
        )}
        {running && !finished && (
          <Pressable accessibilityRole="button" onPress={pause} style={styles.button}>
            <Text style={styles.buttonLabel}>Pause</Text>
          </Pressable>
        )}
        {!running && paused.current !== null && (
          <Pressable accessibilityRole="button" onPress={resume} style={[styles.button, styles.primary]}>
            <Text style={styles.primaryLabel}>Resume</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={reset} style={styles.button}>
          <Text style={styles.buttonLabel}>Reset</Text>
        </Pressable>
      </View>

      <Text style={styles.footnote}>
        The countdown is worked out from the clock, not counted tick by tick, so leaving the app and
        coming back shows the right time. It can&apos;t notify you when it ends — that needs a
        notification permission and a new build.
      </Text>
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background, padding: SPACING.xl, gap: SPACING.xl, alignItems: "center", justifyContent: "center" },
    modes: { flexDirection: "row", gap: SPACING.sm },
    mode: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    modeLabel: { color: palette.mutedForeground, fontSize: 13, fontWeight: "600" },
    clock: { color: palette.foreground, fontSize: 72, fontWeight: "200", fontVariant: ["tabular-nums"] },
    controls: { flexDirection: "row", gap: SPACING.md },
    button: {
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    primary: { backgroundColor: palette.accent, borderColor: palette.accent },
    buttonLabel: { color: palette.foreground, fontSize: 15, fontWeight: "600" },
    primaryLabel: { color: "#04121c", fontSize: 15, fontWeight: "700" },
    footnote: { color: palette.subtleForeground, fontSize: 12, lineHeight: 17, textAlign: "center" },
  });
}
