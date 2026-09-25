// The sync indicator, in the header of every screen.
//
// Small on purpose. It answers one question — "is what I am looking at the
// same as what my laptop has?" — and the answer is a colour and two words.
// Tapping it syncs; holding the thought that it might need tapping is the
// thing the app should spare people, which is why it also syncs by itself.
//
// "Offline" is a state, not a fault, and is coloured accordingly. A phone
// spends a good part of its life offline and the app is fully usable there; an
// angry red badge every time a lift door closes would train people to stop
// reading it.

import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { describeLastSync, useSync } from "../sync/SyncProvider";
import { HEADER_CONTROL, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export function SyncChip() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { state, lastSyncedAt, sync } = useSync();

  const { label, colour } = describe(state, lastSyncedAt, palette);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sync status: ${label}. Tap to sync now.`}
      onPress={() => void sync()}
      style={styles.chip}
      hitSlop={10}
    >
      {state === "syncing" ? (
        <ActivityIndicator size="small" color={palette.accent} />
      ) : (
        <View style={[styles.dot, { backgroundColor: colour }]} />
      )}
      <Text style={[styles.label, { color: colour }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function describe(state: string, lastSyncedAt: number | null, palette: Palette) {
  switch (state) {
    case "syncing":
      return { label: "Syncing", colour: palette.accent };
    case "offline":
      return { label: "Offline", colour: palette.mutedForeground };
    case "error":
      return { label: "Sync failed", colour: palette.danger };
    case "signed-out":
      return { label: "Local only", colour: palette.mutedForeground };
    default:
      return { label: describeLastSync(lastSyncedAt), colour: palette.success };
  }
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      height: HEADER_CONTROL.height,
      paddingHorizontal: HEADER_CONTROL.paddingHorizontal,
      borderRadius: HEADER_CONTROL.radius,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
      maxWidth: 120,
    },
    dot: { width: 7, height: 7, borderRadius: 4 },
    label: { ...TYPE.micro, fontWeight: "600" },
  });
}
