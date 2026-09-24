// The running timer, in the header.
//
// The point of a timer you can walk away from is that you can walk away from
// it — which only works if something on screen still says it is running.
// Otherwise leaving the screen and leaving it running look identical, and
// nobody trusts it enough to leave.
//
// Absent entirely when there is nothing to report: a chip reading "25:00" over
// a timer nobody started is furniture.

import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatRemaining, useTimer } from "../timer/TimerProvider";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export function TimerChip() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const { running, finished, paused, remaining, mode } = useTimer();

  if (!running && !paused) return null;

  const tone = finished ? palette.success : paused ? palette.mutedForeground : palette.accent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        finished
          ? "Timer finished. Tap to open it."
          : `${mode === "focus" ? "Focus" : "Rest"} timer, ${formatRemaining(remaining)} left. Tap to open it.`
      }
      onPress={() => router.push("/timer")}
      style={[styles.chip, { borderColor: tone }]}
      hitSlop={6}
    >
      <Ionicons name={finished ? "checkmark" : paused ? "pause" : "timer-outline"} size={12} color={tone} />
      <Text style={[styles.label, { color: tone }]}>
        {finished ? "done" : formatRemaining(remaining)}
      </Text>
    </Pressable>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      backgroundColor: palette.surfaceMuted,
    },
    label: { fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] },
  });
}
