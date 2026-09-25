// The frame every panel sits in.
//
// One card shape for all of them, because a column of panels that each invent
// their own padding and heading reads as a pile rather than a page. The header
// carries an icon and a title, and — where the panel is a summary of something
// bigger — a chevron that opens the full screen.

import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export function PanelCard({
  title,
  icon,
  accent,
  onOpen,
  children,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  /** Tints the icon; panels are told apart by colour before they are read. */
  accent?: string;
  /** Opens the full screen this panel summarises, if it has one. Given as a
   *  callback rather than a `Link` so the caller can decline it — a touch
   *  that lands to stop a moving list is not a tap, and a list that
   *  navigates when you stop it is unusable at speed. */
  onOpen?: () => void;
  children: ReactNode;
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const tint = accent ?? palette.accent;

  const header = (
    <View style={styles.head}>
      <View style={[styles.iconWrap, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={icon} size={15} color={tint} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {onOpen ? <Ionicons name="chevron-forward" size={16} color={palette.subtleForeground} /> : null}
    </View>
  );

  const inside = (
    <>
      {header}
      <View style={styles.body}>{children}</View>
    </>
  );

  // The whole card opens the screen behind it, not just its heading. A panel
  // is one thing to the eye — a title and the figures under it — so having
  // only the top strip respond meant aiming at a target you cannot see, and
  // the rest of the card reading as inert when it is the part you were
  // looking at. Holding still picks the panel up: the drag above this only
  // activates after the finger has been still a moment, so a tap never
  // reaches it and a hold never becomes a tap.
  // No touch handler of its own. Opening the panel is one of the things the
  // gesture above this can decide a touch was (panels/../(tabs)/index.tsx),
  // alongside picking it up and scrolling past it — and it is the only one of
  // the three that can tell a press from the end of a drag, because it is the
  // only one watching how far the finger travelled. A Pressable here saw a
  // press whenever a finger went down and came up on the card, which is also
  // what dragging the column to its end looks like.
  //
  // Screen readers keep a way in through `onAccessibilityTap`, which is not a
  // touch and so has nothing to be confused with.
  return (
    <View
      style={styles.card}
      accessible={Boolean(onOpen)}
      accessibilityRole={onOpen ? "button" : undefined}
      accessibilityLabel={onOpen ? `Open ${title}` : undefined}
      onAccessibilityTap={onOpen}
    >
      {inside}
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    card: {
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
      overflow: "hidden",
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    iconWrap: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    title: { flex: 1, color: palette.foreground, ...TYPE.body, fontWeight: "700" },
    body: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.sm },
  });
}

/** A labelled bar. Used by half the panels, and the reason none of them draw
 *  their own: a column of progress bars that disagree about height reads as
 *  noise. */
export function Meter({ label, value, total, tint }: { label: string; value: number; total: number; tint?: string }) {
  const palette = usePalette();
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;

  return (
    <View style={meterStyles.row}>
      <Text style={[meterStyles.label, { color: palette.mutedForeground }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[meterStyles.track, { backgroundColor: palette.surfaceMuted }]}>
        <View style={[meterStyles.fill, { width: `${pct}%`, backgroundColor: tint ?? palette.accent }]} />
      </View>
      <Text style={[meterStyles.value, { color: palette.mutedForeground }]}>
        {value}/{total}
      </Text>
    </View>
  );
}

// The label carries its own complete style rather than borrowing the card's
// title. Borrowing it looked tidy and silently broke the label: the title is
// `flex: 1`, which resolves to `flexBasis: 0`, and a fixed `width` layered on
// top of that collapses to nothing — a row of bars with no idea what they
// measure.
const meterStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  label: { width: 88, ...TYPE.caption, fontWeight: "600" },
  track: { flex: 1, height: 7, borderRadius: 4, overflow: "hidden" },
  fill: { height: 7, borderRadius: 4 },
  value: { width: 46, ...TYPE.micro, textAlign: "right" },
});
