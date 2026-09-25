// "No track open" — the same empty state several screens need when the
// workspace has nothing to show them. One component rather than the same six
// lines of StyleSheet in each of them.

import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export function NoTrack({ message = "No track open." }: { message?: string }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.screen}>
      <Text style={styles.muted}>{message}</Text>
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: SPACING.xl,
      backgroundColor: palette.background,
    },
    muted: { color: palette.mutedForeground, ...TYPE.label, textAlign: "center" },
  });
}
