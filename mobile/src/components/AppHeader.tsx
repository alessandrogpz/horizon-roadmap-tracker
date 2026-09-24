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
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { AppMenu } from "./AppMenu";
import { SyncChip } from "./SyncChip";
import { SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export function AppHeader({ title }: { title?: string }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const { track } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Text style={styles.title} numberOfLines={1}>
          {title ?? track?.meta.name ?? "Horizon"}
        </Text>
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
    menuButton: { paddingHorizontal: SPACING.sm, paddingVertical: 2 },
    menuGlyph: { color: palette.foreground, fontSize: 22, lineHeight: 24 },
  });
}
