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
import { useMasterMode } from "../master/MasterMode";
import { AppMenu } from "./AppMenu";
import { SyncChip } from "./SyncChip";
import { TimerChip } from "./TimerChip";
import { ThemeButton } from "./ThemeButton";
import { HEADER_CONTROL, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export function AppHeader({ title }: { title?: string }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const { track } = useWorkspace();
  const { master } = useMasterMode();
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
        {/* The track name is the switcher. Which track you are in is the most
            consequential thing on this bar, and it was three taps away inside
            a menu; the name is already the label for that choice, so it may as
            well be the control. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            master
              ? "All tracks, read only. Tap to pick a single track."
              : `Track: ${track?.meta.name ?? "none"}. Tap to switch or create a track.`
          }
          onPress={() => router.push("/tracks")}
          style={styles.titleButton}
          hitSlop={8}
        >
          {/* The name of what you are looking at, which in the all-tracks
              mode is not a track. The layers mark rather than a colour dot:
              there is no one colour to show. */}
          {master && <Ionicons name="layers" size={15} color={palette.accent} />}
          <Text style={[styles.title, master && { color: palette.accent }]} numberOfLines={1}>
            {master ? "All tracks" : (title ?? track?.meta.name ?? "Horizon")}
          </Text>
          <Ionicons name="chevron-down" size={14} color={palette.subtleForeground} />
        </Pressable>
        <TimerChip />
        <SyncChip />
        <ThemeButton />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Menu"
          onPress={() => setMenuOpen(true)}
          style={styles.menuButton}
          hitSlop={10}
        >
          <Ionicons name="ellipsis-horizontal" size={17} color={palette.mutedForeground} />
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
    titleButton: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4, minHeight: HEADER_CONTROL.height },
    title: { flexShrink: 1, color: palette.foreground, ...TYPE.heading, fontWeight: "700" },
    back: { paddingRight: 2, marginLeft: -SPACING.xs },
    menuButton: {
      alignItems: "center",
      justifyContent: "center",
      height: HEADER_CONTROL.height,
      minWidth: HEADER_CONTROL.minWidth,
      paddingHorizontal: HEADER_CONTROL.paddingHorizontal,
      borderRadius: HEADER_CONTROL.radius,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
  });
}
