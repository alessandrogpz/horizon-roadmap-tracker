// Settings: the few things worth changing from a phone, and the honest exits.
//
// Deliberately short. The website has the full set — theme, when a day starts,
// which day a week begins on, exporting a backup — and most of it is desk work
// done once. What belongs here is what you might need *while holding the
// phone*: the account, what this device is holding, and how to get rid of it.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { Link } from "expo-router";
import Constants from "expo-constants";
import { visibleTracks } from "@shared/selectors";
import { SERVER_URL } from "../config";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { DARK, LIGHT, RADIUS, SPACING, type Palette } from "../theme";

export default function SettingsScreen() {
  const { workspace, resetLocal } = useWorkspace();
  const palette = useColorScheme() === "light" ? LIGHT : DARK;
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // A destructive confirmation that stays armed forever is a trap: come back
  // to the screen ten minutes later and the next tap deletes everything.
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 8000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const wipe = useCallback(async () => {
    setBusy(true);
    await resetLocal();
    setBusy(false);
    setConfirming(false);
  }, [resetLocal]);

  const tracks = workspace ? visibleTracks(workspace).length : 0;
  const version = Constants.expoConfig?.version ?? "";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Link href="/account" asChild>
        <Pressable style={styles.row} accessibilityRole="button">
          <Text style={styles.rowTitle}>Account</Text>
          <Text style={styles.muted}>Sign in, sync, or sign out</Text>
        </Pressable>
      </Link>

      <View style={styles.row}>
        <Text style={styles.rowTitle}>This device</Text>
        <Text style={styles.muted}>
          Horizon {version} · {tracks} track{tracks === 1 ? "" : "s"} stored here
        </Text>
      </View>

      <Pressable style={styles.row} accessibilityRole="link" onPress={() => void Linking.openURL(`${SERVER_URL}/privacy`)}>
        <Text style={styles.rowTitle}>Privacy</Text>
        <Text style={styles.muted}>What is stored, where it lives, how to delete it</Text>
      </Pressable>

      <Pressable style={styles.row} accessibilityRole="link" onPress={() => void Linking.openURL(`${SERVER_URL}/security`)}>
        <Text style={styles.rowTitle}>Security</Text>
        <Text style={styles.muted}>How your data is protected</Text>
      </Pressable>

      <View style={styles.danger}>
        <Text style={styles.dangerTitle}>Delete local data</Text>
        <Text style={styles.muted}>
          Clears every track, note and step count from this phone. Anything already synced stays in your
          account — signing in brings it back. It does not delete the account itself; that is on the
          Account screen.
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => (confirming ? void wipe() : setConfirming(true))}
          style={[styles.dangerButton, confirming && { borderColor: palette.danger }]}
        >
          <Text style={[styles.dangerLabel, confirming && { color: palette.danger }]}>
            {busy ? "Clearing…" : confirming ? "Tap again to delete everything on this phone" : "Delete local data…"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md },
    row: {
      gap: 3,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    rowTitle: { color: palette.foreground, fontSize: 15, fontWeight: "600" },
    muted: { color: palette.mutedForeground, fontSize: 13, lineHeight: 18 },
    danger: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: "rgba(248, 113, 113, 0.3)",
      backgroundColor: "rgba(248, 113, 113, 0.05)",
    },
    dangerTitle: { color: palette.foreground, fontSize: 15, fontWeight: "600" },
    dangerButton: {
      alignItems: "center",
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
    dangerLabel: { color: palette.mutedForeground, fontSize: 14, fontWeight: "600" },
  });
}
