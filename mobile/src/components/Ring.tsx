// A progress ring, drawn without SVG.
//
// The website draws this with an SVG circle and a dash offset, which is two
// lines and exact. `react-native-svg` is not in this build, and adding it
// would mean a new APK rather than an update that arrives on its own — a ring
// is not worth costing every phone a reinstall.
//
// So it is built the old way: a full circle whose border is coloured on two
// adjacent sides makes a half-ring, and two of those, each clipped to its own
// half of the box and rotated, sweep anything from nothing to the whole
// circle. The left half only starts moving once the right one has finished,
// which is what the 180-degree hinge below is.

import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { usePalette } from "../theme/ThemeProvider";

export function Ring({
  pct,
  size = 52,
  stroke = 5,
  tint,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  tint?: string;
  children?: React.ReactNode;
}) {
  const palette = usePalette();
  const colour = tint ?? palette.accent;
  const half = size / 2;
  const angle = Math.max(0, Math.min(100, pct)) * 3.6;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        box: { width: size, height: size, alignItems: "center", justifyContent: "center" },
        track: {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: half,
          borderWidth: stroke,
          borderColor: palette.cardBorder,
        },
        // Each half is a window onto one side of the box; the arc inside it is
        // a whole circle, most of which is clipped away.
        window: { position: "absolute", width: half, height: size, overflow: "hidden" },
        arc: {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: half,
          borderWidth: stroke,
          borderColor: "transparent",
          borderTopColor: colour,
          borderRightColor: colour,
        },
      }),
    [colour, half, palette.cardBorder, size, stroke]
  );

  return (
    <View style={styles.box}>
      <View style={styles.track} />

      {/* The first half-turn, clockwise from twelve. */}
      <View style={[styles.window, { left: half }]}>
        <View
          style={[
            styles.arc,
            { left: -half, transform: [{ rotate: `${Math.min(angle, 180) - 135}deg` }] },
          ]}
        />
      </View>

      {/* The second half-turn. Both halves use the same rotation; the only
          difference is which way they are clamped at 180, which is what
          keeps the left one entirely inside the right one's window — and so
          invisible — until the sweep has actually got there. */}
      <View style={[styles.window, { left: 0 }]}>
        <View
          style={[
            styles.arc,
            { left: 0, transform: [{ rotate: `${Math.max(angle, 180) - 135}deg` }] },
          ]}
        />
      </View>

      {children}
    </View>
  );
}
