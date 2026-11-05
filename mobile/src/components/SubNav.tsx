// The row of links to a tab's siblings.
//
// Each tab lands on something useful — Plan opens on the phases themselves,
// Library on the reading list — rather than on a menu of further choices. But
// each one does have two or three siblings, and this is how you reach them: a
// short scrollable row, under content that is already worth reading.
//
// These used to be bare outlined pills, which is also what the view switches
// looked like, so a row of them read as a set of options where one ought to be
// on. They are not options; they are places. Each one now carries the icon of
// where it goes and a chevron saying that it goes there at all, and the switch
// between views has become a single track with a sliding thumb (Segmented), so
// the two are no longer drawn the same way.

import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import { Link } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { PRESS_DIM, PRESS_SCALE, PRESS_SPRING, useReducedMotion } from "../motion";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export interface SubNavLink {
  href: string;
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}

export function SubNav({ links }: { links: SubNavLink[] }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // A scroll view will take all the room it is offered, and this one
      // scrolls sideways — so on a screen that does not scroll itself it was
      // claiming a couple of hundred points of *height* for a single row of
      // chips, starving whatever it sat beside.
      style={styles.scroller}
      contentContainerStyle={styles.row}
      // Without this the row steals the vertical pull-to-refresh gesture from
      // the screen it sits on.
      directionalLockEnabled
    >
      {links.map((link) => (
        <Chip key={link.href} link={link} styles={styles} palette={palette} />
      ))}
    </ScrollView>
  );
}

function Chip({
  link,
  styles,
  palette,
}: {
  link: SubNavLink;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  // Presses answer rather than just registering. The chip gives under the
  // thumb and springs back, which is the smallest amount of motion that still
  // tells you the tap landed on this one and not the one beside it.
  //
  // This chip was where that idea started, and for a while it was the only
  // place in the app that had it. It is now `Tappable`, which every other
  // control uses — but not this one: the chip sits inside a horizontal
  // ScrollView and needs gesture-handler's Pressable to tell a tap from the
  // start of a sideways drag, which `Tappable` (plain Pressable, so that it
  // can stand in anywhere) does not use. So it keeps its own three lines and
  // takes the numbers from the same place, rather than holding a second
  // opinion about how hard a press should answer.
  const reduced = useReducedMotion();
  const scale = reduced ? 0 : PRESS_SCALE;
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * scale }],
    opacity: 1 - pressed.value * PRESS_DIM,
  }));

  return (
    <Link href={link.href as never} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={link.label}
        onPressIn={() => {
          pressed.value = withSpring(1, PRESS_SPRING);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, PRESS_SPRING);
        }}
      >
        <Animated.View style={[styles.chip, animated]}>
          {link.icon ? <Ionicons name={link.icon} size={14} color={palette.mutedForeground} /> : null}
          <Text style={styles.label}>{link.label}</Text>
          <Ionicons name="chevron-forward" size={13} color={palette.subtleForeground} />
        </Animated.View>
      </Pressable>
    </Link>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    // No horizontal padding of its own: every screen that uses this already
    // pads its content, and adding a second gutter would push the row in
    // twice as far as everything under it.
    scroller: { flexGrow: 0 },
    row: { gap: SPACING.sm, paddingBottom: SPACING.sm },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      paddingLeft: SPACING.md,
      paddingRight: SPACING.sm,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    label: { color: palette.foreground, ...TYPE.label, fontWeight: "600" },
  });
}
