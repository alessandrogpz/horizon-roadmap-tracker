// The timer.
//
// Not "focus timer" any more: twenty-five minutes of work and five of rest is
// a shape that suits a set at the gym, a language drill or a stretch of
// reading equally, and calling it "focus" implied it was for studying and made
// it look out of place anywhere else.
//
// The state lives in ../timer/TimerProvider, above every screen, so leaving
// this one does not stop it — which is the point of a timer you start and then
// go and do the thing. The header says it is still running from wherever you
// happen to be.

import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatRemaining, TIMER_MINUTES, useTimer, type TimerMode } from "../timer/TimerProvider";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export default function TimerScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { mode, remaining, running, finished, paused, start, pause, resume, reset } = useTimer();

  return (
    <View style={styles.screen}>
      <View style={styles.modes}>
        {(Object.keys(TIMER_MINUTES) as TimerMode[]).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === option }}
            onPress={() => start(option)}
            style={[styles.mode, mode === option && { borderColor: palette.accent }]}
          >
            <Text style={[styles.modeLabel, mode === option && { color: palette.foreground }]}>
              {option === "focus" ? `Work · ${TIMER_MINUTES.focus}` : `Rest · ${TIMER_MINUTES.rest}`}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.clock, finished && { color: palette.success }]}>
        {finished ? "done" : formatRemaining(remaining)}
      </Text>

      <View style={styles.controls}>
        {!running && !paused && (
          <Pressable accessibilityRole="button" onPress={() => start(mode)} style={[styles.button, styles.primary]}>
            <Text style={styles.primaryLabel}>Start</Text>
          </Pressable>
        )}
        {running && !finished && (
          <Pressable accessibilityRole="button" onPress={pause} style={styles.button}>
            <Text style={styles.buttonLabel}>Pause</Text>
          </Pressable>
        )}
        {paused && (
          <Pressable accessibilityRole="button" onPress={resume} style={[styles.button, styles.primary]}>
            <Text style={styles.primaryLabel}>Resume</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={reset} style={styles.button}>
          <Text style={styles.buttonLabel}>Reset</Text>
        </Pressable>
      </View>

      <Text style={styles.footnote}>
        Keeps running if you leave this screen — the header shows how long is left. The countdown is
        worked out from the clock rather than counted tick by tick, so putting the phone away and
        coming back shows the right time. It can&apos;t alert you when it ends yet.
      </Text>
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: palette.background,
      padding: SPACING.xl,
      gap: SPACING.xl,
      alignItems: "center",
      justifyContent: "center",
    },
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
