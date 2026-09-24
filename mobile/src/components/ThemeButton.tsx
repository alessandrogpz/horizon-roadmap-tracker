// The theme, as one icon in the header.
//
// It used to be three chips in Settings, which is a lot of screen for a thing
// people flip on the train when the light changes — and Settings is exactly
// where you are not when that happens. The website puts it in the top bar for
// the same reason; this is the phone's version of that button.
//
// Tapping cycles system → light → dark → system. Three states rather than two
// because "follow the phone" is the default and has to be reachable again
// after someone has pinned one: a two-way toggle would strand them on an
// explicit choice forever. The icon says which of the three it is on, and the
// choice is written to storage by the provider, so it survives a restart.

import { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme, type ThemePreference } from "../theme/ThemeProvider";
import { RADIUS, SPACING, type Palette } from "../theme";

const NEXT: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const ICON = {
  system: "phone-portrait-outline",
  light: "sunny-outline",
  dark: "moon-outline",
} as const;

const SAYS = {
  system: "following the phone",
  light: "light",
  dark: "dark",
};

export function ThemeButton() {
  const { palette, preference, setPreference } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Theme: ${SAYS[preference]}. Tap for ${SAYS[NEXT[preference]]}.`}
      onPress={() => setPreference(NEXT[preference])}
      style={styles.button}
      hitSlop={6}
    >
      <Ionicons name={ICON[preference]} size={15} color={palette.mutedForeground} />
    </Pressable>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    button: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 5,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
  });
}
