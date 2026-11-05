// One control for "which of these am I looking at".
//
// It replaces the pairs of outlined buttons that were doing this job. Two
// buttons side by side say "here are two things you can press"; the selected
// one was told apart by a border colour, which is the weakest signal available
// and reads as decoration rather than state. A single track with one filled
// thumb says "this is one setting, and it is currently here" — and because the
// thumb travels between positions rather than blinking out and in somewhere
// else, the change is something you watch happen instead of something you have
// to notice afterwards.
//
// The thumb is sprung rather than timed. A spring overshoots slightly and
// settles, which is what makes a small movement read as a physical one; a
// linear slide of 80 points in 200ms reads as a redraw.

import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { tap } from "../feedback/haptics";
import { TRAVEL_SPRING } from "../motion";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

/** The track's inset, and therefore the thumb's margin on every side. */
const PAD = 3;

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [width, setWidth] = useState(0);

  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const position = useSharedValue(index);

  useEffect(() => {
    position.value = withSpring(index, TRAVEL_SPRING);
  }, [index, position]);

  // Equal segments, measured rather than assumed: the labels are different
  // lengths and letting them size themselves would make the thumb's travel
  // depend on the words in it.
  const segment = width > 0 ? (width - PAD * 2) / options.length : 0;

  const thumb = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: PAD + position.value * segment }],
  }));

  return (
    <View style={styles.track} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {segment > 0 && <Animated.View style={[styles.thumb, thumb]} pointerEvents="none" />}

      {options.map((option, i) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityState={{ selected: option.value === value }}
          onPress={() => {
            if (option.value === value) return;
            tap();
            onChange(option.value);
          }}
          style={styles.segment}
        >
          <Label text={option.label} index={i} position={position} palette={palette} />
        </Pressable>
      ))}
    </View>
  );
}

/** The label hands its colour over as the thumb passes under it, rather than
 *  switching when the press lands. Two labels mid-handover is what makes the
 *  thumb look like it is carrying the selection with it. */
function Label({
  text,
  index,
  position,
  palette,
}: {
  text: string;
  index: number;
  position: SharedValue<number>;
  palette: Palette;
}) {
  const animated = useAnimatedStyle(() => ({
    color: interpolateColor(
      // Clamped, because the spring overshoots and an unclamped input would
      // send the colour past the end of the range it was given.
      Math.max(index - 1, Math.min(index + 1, position.value)),
      [index - 1, index, index + 1],
      [palette.mutedForeground, palette.foreground, palette.mutedForeground]
    ),
  }));

  return (
    <Animated.Text style={[labelStyles.label, animated]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
      {text}
    </Animated.Text>
  );
}

const labelStyles = StyleSheet.create({
  label: { ...TYPE.caption, fontWeight: "600", textAlign: "center" },
});

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    track: {
      flexDirection: "row",
      padding: PAD,
      borderRadius: RADIUS.control,
      backgroundColor: palette.surfaceMuted,
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
    thumb: {
      position: "absolute",
      top: PAD,
      bottom: PAD,
      borderRadius: RADIUS.control - PAD + 1,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
    segment: { flex: 1, paddingVertical: SPACING.xs, alignItems: "center", justifyContent: "center" },
  });
}
