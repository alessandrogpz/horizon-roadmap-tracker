// The theme, as one icon in the header.
//
// It used to be three chips in Settings, which is a lot of screen for a thing
// people flip on a train when the light changes — and Settings is exactly
// where they are not when that happens.
//
// Two states, not three. The app starts on whatever the phone is set to, so a
// fresh install already matches its surroundings and there is nothing to
// choose; the button is there for the moment that stops being what you want.
// The icon shows what you are looking at — sun in light, moon in dark — rather
// than what tapping would do, because the first is a fact and the second is a
// guess about which way round someone reads a button.

import { useMemo } from "react";
import { StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../theme/ThemeProvider";
import { tap } from "../feedback/haptics";
import { HEADER_CONTROL, type Palette } from "../theme";
import { Tappable } from "./Tappable";

export function ThemeButton() {
  const { palette, resolved, setPreference } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const dark = resolved === "dark";

  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={dark ? "Dark theme. Switch to light." : "Light theme. Switch to dark."}
      onPress={() => {
        tap();
        setPreference(dark ? "light" : "dark");
      }}
      style={styles.button}
      // The icon is small; the target it sits in should not be.
      hitSlop={12}
    >
      <Ionicons name={dark ? "moon" : "sunny"} size={16} color={palette.mutedForeground} />
    </Tappable>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    button: {
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
