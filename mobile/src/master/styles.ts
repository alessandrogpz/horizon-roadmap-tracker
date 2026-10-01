// The shared look of the all-tracks tabs.
//
// One sheet rather than four, because the four tabs are deliberately the same
// shape as each other: a read-only band, the switches, then rows. Four copies
// of these rules would drift the moment one of them was adjusted.

import { StyleSheet } from "react-native";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";

export function makeMasterStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xl },
    centered: { alignItems: "center", justifyContent: "center" },

    card: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    sectionTitle: { color: palette.foreground, ...TYPE.subhead, fontWeight: "700", marginTop: SPACING.sm },

    tiles: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
    tile: {
      flexGrow: 1,
      flexBasis: "45%",
      gap: 2,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    tileLabel: { color: palette.mutedForeground, ...TYPE.eyebrow, fontWeight: "700", letterSpacing: 1 },
    tileValue: { color: palette.foreground, ...TYPE.title, fontWeight: "700" },
    tileRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    tileRowText: { flex: 1 },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    rowHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    rowText: { flex: 1, gap: 2 },
    rowTitle: { color: palette.foreground, ...TYPE.body, fontWeight: "600" },
    struck: { color: palette.subtleForeground, textDecorationLine: "line-through" },
    now: { ...TYPE.micro, fontWeight: "800", letterSpacing: 1 },
    box: { width: 16, height: 16, borderRadius: 4, borderWidth: 1 },

    muted: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
    footnote: { color: palette.subtleForeground, ...TYPE.micro, lineHeight: 15 },
  });
}

export type MasterStyles = ReturnType<typeof makeMasterStyles>;
