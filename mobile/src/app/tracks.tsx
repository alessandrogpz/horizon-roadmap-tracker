// Switching between tracks. One goal per track is the idea the whole product
// rests on, so this is the second screen rather than a setting.

import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { visibleTracks } from "@shared/selectors";
import { currentStreakLength } from "@shared/streak";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export default function TracksScreen() {
  const { workspace, today, switchTrack } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const tracks = workspace ? visibleTracks(workspace) : [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {tracks.map((track) => {
        const active = track.meta.id === workspace?.activeTrackId;
        const streak = currentStreakLength(track.streakHistory ?? [], today);
        return (
          <Pressable
            key={track.meta.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.card, active && { borderColor: palette.accent }]}
            onPress={() => {
              switchTrack(track.meta.id);
              router.back();
            }}
          >
            <View style={[styles.dot, { backgroundColor: track.meta.color || palette.accent }]} />
            <View style={styles.text}>
              <Text style={styles.name}>{track.meta.name}</Text>
              <Text style={styles.muted}>
                {streak > 0 ? `${streak} day${streak === 1 ? "" : "s"} in a row` : "no streak yet"}
                {active ? " · open" : ""}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {tracks.length === 0 && <Text style={styles.muted}>No tracks yet.</Text>}
    </ScrollView>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    text: { flex: 1, gap: 2 },
    name: { color: palette.foreground, fontSize: 16, fontWeight: "600" },
    muted: { color: palette.mutedForeground, fontSize: 13 },
  });
}
