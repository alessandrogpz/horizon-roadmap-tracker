// The row of links at the top of a tab.
//
// Each tab lands on something useful — Plan opens on the phases themselves,
// Library on the reading list — rather than on a menu of further choices. But
// each one does have two or three siblings, and this is how you reach them: a
// short scrollable row of chips, above content that is already worth reading.
//
// Chips rather than a list because they take one line instead of four, and the
// content underneath is the point of the screen.

import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { Link } from "expo-router";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export function SubNav({ links }: { links: { href: string; label: string }[] }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      // Without this the row steals the vertical pull-to-refresh gesture from
      // the screen it sits on.
      directionalLockEnabled
    >
      {links.map((link) => (
        <Link key={link.href} href={link.href as never} asChild>
          <Pressable accessibilityRole="button" style={styles.chip}>
            <Text style={styles.label}>{link.label}</Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    // No horizontal padding of its own: every screen that uses this already
    // pads its content, and adding a second gutter would push the row in
    // twice as far as everything under it.
    row: { gap: SPACING.sm, paddingBottom: SPACING.sm },
    chip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    label: { color: palette.foreground, fontSize: 13, fontWeight: "600" },
  });
}
