// The ⋯ menu: everything that is not a place you spend time.
//
// The four tabs are the app. What is here is the things you do *to* it — sync,
// change track, check the account, adjust settings — plus the shortcuts that
// do not deserve a tab.
//
// It reads as a sheet of tiles rather than a list of sentences, which is the
// difference between recognising a destination and reading one. Every row has
// an icon in its own tinted square; the sync row is a card of its own at the
// top, because it is the only thing here with a state worth reporting.

import { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { describeLastSync, useSync } from "../sync/SyncProvider";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { shareTrack } from "../share/shareTrack";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface Tile {
  label: string;
  icon: IconName;
  tint: string;
  go: string;
}

// Switching track left this menu when the track name in the header became the
// control for it — the name was already the label for that choice, and having
// both meant two ways to do one thing, one of them three taps deep.
//
// The grid of shortcuts went with it. Materials, Notes and the Timer all have
// panels that link straight to them, so the grid was a third route to screens
// that already had two, and it pushed the things only reachable here further
// down the sheet.
const MANAGE: Tile[] = [
  { label: "Account", icon: "person-circle-outline", tint: "#22c55e", go: "/account" },
  { label: "Search", icon: "search-outline", tint: "#0ea5e9", go: "/search" },
  { label: "Settings", icon: "settings-outline", tint: "#64748b", go: "/settings" },
];

// Fade, not slide. A sliding modal is translated a whole viewport and animated
// back into place, so the sheet's position depends on an animation having run —
// one more thing that can leave it off-screen. The sheet is pinned to the
// bottom edge already; fading the backdrop in reads the same.
export function AppMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const { state, message, lastSyncedAt, sync } = useSync();
  const { track, today } = useWorkspace();

  // Close first: pushing a screen under an open sheet leaves the sheet on top.
  const go = (to: string) => {
    onClose();
    router.push(to as never);
  };

  const syncing = state === "syncing";
  const tone =
    state === "error" ? palette.danger : state === "idle" ? palette.success : palette.mutedForeground;

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close the menu" />

        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.content}>
            <Pressable
              accessibilityRole="button"
              style={[styles.syncCard, { borderColor: tone }]}
              onPress={() => void sync()}
              disabled={syncing}
            >
              <View style={[styles.iconSquare, { backgroundColor: `${tone}22` }]}>
                <Ionicons
                  name={
                    syncing
                      ? "sync"
                      : state === "error"
                        ? "alert-circle-outline"
                        : state === "offline"
                          ? "cloud-offline-outline"
                          : state === "signed-out"
                            ? "phone-portrait-outline"
                            : "cloud-done-outline"
                  }
                  size={19}
                  color={tone}
                />
              </View>
              <View style={styles.syncText}>
                <Text style={styles.tileLabel}>{syncing ? "Syncing…" : "Sync now"}</Text>
                <Text style={styles.hint} numberOfLines={2}>
                  {state === "signed-out"
                    ? "Not signed in — everything stays on this phone"
                    : message || `Last synced ${describeLastSync(lastSyncedAt)}`}
                </Text>
              </View>
            </Pressable>

            <Text style={styles.sectionTitle}>This track</Text>

            {/* Sharing left Today, where it was an odd thing to meet every
                morning. It belongs with the other occasional actions. */}
            {track && (
              <Pressable
                accessibilityRole="button"
                style={styles.row}
                onPress={() => {
                  onClose();
                  void shareTrack(track, today, { done: 0, total: 0 });
                }}
              >
                <View style={[styles.iconSquare, { backgroundColor: "#0ea5e922" }]}>
                  <Ionicons name="share-outline" size={19} color="#0ea5e9" />
                </View>
                <Text style={styles.tileLabel}>Share progress</Text>
                <Ionicons name="chevron-forward" size={17} color={palette.subtleForeground} />
              </Pressable>
            )}
            {MANAGE.map((tile) => (
              <Pressable key={tile.go} accessibilityRole="button" style={styles.row} onPress={() => go(tile.go)}>
                <View style={[styles.iconSquare, { backgroundColor: `${tile.tint}22` }]}>
                  <Ionicons name={tile.icon} size={19} color={tile.tint} />
                </View>
                <Text style={styles.tileLabel}>{tile.label}</Text>
                <Ionicons name="chevron-forward" size={17} color={palette.subtleForeground} />
              </Pressable>
            ))}

            <Pressable accessibilityRole="button" style={styles.close} onPress={onClose}>
              <Text style={styles.closeLabel}>Close</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: palette.card,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderTopWidth: 1,
      borderColor: palette.cardBorder,
      paddingBottom: SPACING.xl,
      maxHeight: "82%",
    },
    grabber: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: palette.cardBorder,
      marginTop: SPACING.sm,
    },
    content: { padding: SPACING.lg, gap: SPACING.sm },
    iconSquare: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    syncCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      backgroundColor: palette.surfaceMuted,
    },
    syncText: { flex: 1, gap: 1 },
    sectionTitle: {
      color: palette.subtleForeground,
      ...TYPE.marker,
      fontWeight: "700",
      letterSpacing: 1.2,
      marginTop: SPACING.md,
    },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
    gridTile: {
      width: "47%",
      flexGrow: 1,
      alignItems: "center",
      gap: SPACING.xs,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    gridLabel: { color: palette.foreground, ...TYPE.caption, fontWeight: "600" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    tileLabel: { flex: 1, color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
    hint: { color: palette.mutedForeground, ...TYPE.caption, lineHeight: 16 },
    close: { alignItems: "center", paddingVertical: SPACING.md, marginTop: SPACING.sm },
    closeLabel: { color: palette.mutedForeground, ...TYPE.body, fontWeight: "600" },
  });
}
