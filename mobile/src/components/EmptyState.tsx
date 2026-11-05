// What a screen says when it has nothing to show.
//
// These used to be one grey sentence describing the emptiness — "No materials
// on this track yet." — next to an Edit button that was the actual way in.
// That is a dead end: the screen states a fact and leaves you to work out that
// the toolbar holds the remedy. An empty screen is the one moment you can be
// certain what the person wants to do next, so it says it and offers it.

import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { Tappable } from "./Tappable";

export function EmptyState({
  title,
  hint,
  action,
  icon = "add",
  onAct,
}: {
  title: string;
  hint?: string;
  /** Omitted when there is nothing useful to offer — a screen waiting on a
   *  connection has no button that would help. */
  action?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  onAct?: () => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {action && onAct ? (
        <Tappable accessibilityRole="button" onPress={onAct} style={styles.button}>
          <Ionicons name={icon} size={16} color={palette.background} />
          <Text style={styles.label}>{action}</Text>
        </Tappable>
      ) : null}
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    card: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
      marginTop: SPACING.sm,
    },
    title: { color: palette.foreground, ...TYPE.subhead, fontWeight: "700" },
    hint: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.xs,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      backgroundColor: palette.accent,
      marginTop: SPACING.xs,
    },
    label: { color: palette.background, ...TYPE.body, fontWeight: "700" },
  });
}
