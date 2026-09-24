// The ⋯ menu in the header: everything that is not a place you spend time.
//
// The four tabs are the app. What is here is the things you do *to* it —
// change track, check the account, adjust settings, take a backup — which are
// occasional, and which used to be a wall of buttons at the bottom of Today
// competing for attention with the day's actual work.
//
// A sheet rather than a dropdown because a dropdown anchored to a corner icon
// is a thumb-stretch on a phone, and because a sheet can afford to say what
// each item is for.

import { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { describeLastSync, useSync } from "../sync/SyncProvider";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

interface Item {
  label: string;
  hint: string;
  go: string;
}

const ITEMS: Item[] = [
  { label: "Switch track", hint: "Or start a new one", go: "/tracks" },
  { label: "Account", hint: "Signing in, syncing, deleting", go: "/account" },
  { label: "Settings", hint: "Theme, when a day starts, backups", go: "/settings" },
];

export function AppMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const { state, message, lastSyncedAt, sync } = useSync();

  // Fade, not slide. A sliding modal is translated a whole viewport and
  // animated back into place, so the sheet's position depends on an animation
  // having run — one more thing that can leave it off-screen. The sheet is
  // pinned to the bottom edge already; fading the backdrop in reads the same
  // and cannot land in the wrong place.
  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
      {/* Both layers are positioned rather than stacked with flex. Relying on
          flex inside a Modal leaves the sheet's placement at the mercy of
          whatever the platform decides the modal container is; pinning it to
          the bottom edge is the same on every one of them. */}
      <View style={styles.fill}>
        {/* Tapping away closes it — the thing everyone tries first. */}
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close the menu" />

        <View style={styles.sheet}>
        <View style={styles.grabber} />
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            accessibilityRole="button"
            style={styles.syncRow}
            onPress={() => void sync()}
            disabled={state === "syncing"}
          >
            <View style={styles.syncText}>
              <Text style={styles.itemLabel}>
                {state === "syncing" ? "Syncing…" : "Sync now"}
              </Text>
              <Text style={styles.itemHint}>
                {state === "signed-out"
                  ? "Not signed in — everything stays on this phone"
                  : message || `Last synced ${describeLastSync(lastSyncedAt)}`}
              </Text>
            </View>
          </Pressable>

          {ITEMS.map((item) => (
            <Pressable
              key={item.go}
              accessibilityRole="button"
              style={styles.item}
              onPress={() => {
                // Close first: pushing a screen under an open sheet leaves the
                // sheet on top of it.
                onClose();
                router.push(item.go as never);
              }}
            >
              <Text style={styles.itemLabel}>{item.label}</Text>
              <Text style={styles.itemHint}>{item.hint}</Text>
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
    backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: palette.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderTopWidth: 1,
      borderColor: palette.cardBorder,
      paddingBottom: SPACING.xl,
      maxHeight: "70%",
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
    syncRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.surfaceMuted,
    },
    syncText: { flex: 1, gap: 2 },
    item: {
      gap: 2,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    itemLabel: { color: palette.foreground, fontSize: 15, fontWeight: "600" },
    itemHint: { color: palette.mutedForeground, fontSize: 12, lineHeight: 17 },
    close: { alignItems: "center", paddingVertical: SPACING.md },
    closeLabel: { color: palette.mutedForeground, fontSize: 14, fontWeight: "600" },
  });
}
