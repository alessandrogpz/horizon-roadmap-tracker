// One figure, and what it is a figure of.
//
// The same shape wherever a number leads: something on the left to identify it
// at a glance — an icon, or a ring when the number is a proportion — then the
// name of the thing in small caps, then the figure with its unit beside it.
//
// Shared because these were being rebuilt per screen, and numbers that mean
// the same kind of thing should not be laid out three different ways. It is
// also the difference between a screen that opens with a sentence and one that
// opens with its figures: a sentence has to be read before it says anything.

import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export function StatTile({
  label,
  value,
  unit,
  icon,
  tint,
  leading,
  wide,
  compact,
  children,
}: {
  label: string;
  value: number | string;
  /** Sits next to the figure, small — "days", "/ 92 days", "in phase 1". */
  unit?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  tint?: string;
  /** Takes the icon's place when the mark is something richer, like a ring. */
  leading?: ReactNode;
  /** Gives the tile more of the row than its neighbours, for a longer unit. */
  wide?: boolean;
  /**
   * Three tiles to a row rather than one or two.
   *
   * Side by side, a tile this narrow has about fifty points left for its
   * name once the icon and the padding have taken theirs, and a word in
   * small caps needs more than that. Stacking gives the name the tile's
   * whole width and costs one line, which is cheaper than losing either
   * the icon or the end of the word.
   */
  compact?: boolean;
  /** Anything that belongs under the figure — a bar, a second line. */
  children?: ReactNode;
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const figures = (
    <View style={styles.figureRow}>
      <Text style={styles.figure}>{value}</Text>
      {unit ? (
        <Text style={styles.unit} numberOfLines={1}>
          {unit}
        </Text>
      ) : null}
    </View>
  );

  if (compact) {
    return (
      <View style={[styles.tile, styles.compact]}>
        <View style={styles.compactHead}>
          {icon ? <Ionicons name={icon} size={15} color={tint ?? palette.accent} /> : null}
          <Text style={[styles.label, styles.compactLabel]} numberOfLines={1}>
            {label}
          </Text>
        </View>
        {figures}
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.tile, wide && styles.wide]}>
      {leading ?? (icon ? <Ionicons name={icon} size={20} color={tint ?? palette.accent} /> : null)}

      <View style={styles.text}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {figures}
        {children}
      </View>
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    tile: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    wide: { flex: 1.5 },
    compact: { flexDirection: "column", alignItems: "stretch", gap: 3, paddingHorizontal: SPACING.sm },
    compactHead: { flexDirection: "row", alignItems: "center", gap: 5 },
    // Small caps are set loose to be read at a glance; in a tile this
    // narrow the tracking is what pushes the word off the end.
    compactLabel: { flexShrink: 1 },
    text: { flex: 1, gap: 2 },
    label: { ...TYPE.marker, color: palette.subtleForeground, fontWeight: "700" },
    figureRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
    figure: { ...TYPE.figure, color: palette.foreground, fontWeight: "700" },
    unit: { ...TYPE.micro, color: palette.mutedForeground, flexShrink: 1 },
  });
}
