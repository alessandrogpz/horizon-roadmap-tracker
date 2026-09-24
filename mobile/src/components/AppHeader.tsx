// The header the tabs share: which track you are in, whether it is synced, and
// the way out to everything occasional.
//
// It replaces a "Switch" button that sat inside Today's content and a row of
// ten links at the bottom of it. Putting the track name here is not decoration
// — with four tabs and a dozen screens, "which track am I editing?" stops
// being obvious the moment you leave Today, and every edit on every screen
// belongs to one.

import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { AppMenu } from "./AppMenu";
import { SyncChip } from "./SyncChip";
import { TimerChip } from "./TimerChip";
import { SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export function AppHeader({ title }: { title?: string }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const { track } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // A tab is not "back" from another tab, so nothing gives these screens an
  // arrow by itself — but My Space is where you came from and where everything
  // here is a drill-down of, so every other tab offers the way back to it.
  // The system back gesture does the same, via `backBehavior="firstRoute"`.
  const home = pathname === "/";

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        {!home && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to My Space"
            onPress={() => router.navigate("/")}
            hitSlop={8}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={22} color={palette.foreground} />
          </Pressable>
        )}
        <Text style={styles.title} numberOfLines={1}>
          {title ?? track?.meta.name ?? "Horizon"}
        </Text>
        <TimerChip />
        <SyncChip />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Menu"
          onPress={() => setMenuOpen(true)}
          style={styles.menuButton}
          hitSlop={8}
        >
          <Text style={styles.menuGlyph}>⋯</Text>
        </Pressable>
      </View>

      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.sm,
      backgroundColor: palette.background,
      borderBottomWidth: 1,
      borderBottomColor: palette.cardBorder,
    },
    title: { flex: 1, color: palette.foreground, fontSize: 18, fontWeight: "700" },
    back: { paddingRight: 2, marginLeft: -SPACING.xs },
    menuButton: { paddingHorizontal: SPACING.sm, paddingVertical: 2 },
    menuGlyph: { color: palette.foreground, fontSize: 22, lineHeight: 24 },
  });
}
