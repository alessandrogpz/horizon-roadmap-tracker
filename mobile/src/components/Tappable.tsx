// A Pressable that answers the press.
//
// There were 141 Pressables in this app and exactly one of them — the SubNav
// chip — did anything when you touched it. The other 140 registered the tap
// and showed nothing until whatever the tap started had finished, which on a
// touch screen is the only feedback channel there is: there is no hover, and
// the thumb is covering the thing it pressed, so a colour change under it is
// invisible by definition.
//
// What is visible is the control *giving*: the whole element shrinks by a few
// percent and dims, so the movement happens around the edges of the shape,
// outside the contact patch. Sprung rather than timed, so a second press
// takes over from wherever the first had got to instead of restarting.
//
// Haptics are the other half and stay where they are — deliberately sparing,
// on ticking something off, snapping a wheel, dropping a drag and anything
// destructive (see src/feedback/haptics.ts). This is for every press,
// including the ordinary navigation that should not buzz.
//
// A drop-in for Pressable: the animated style goes on the Pressable itself
// rather than on a wrapper, so nothing about the layout changes and `style`
// keeps meaning what it meant. It costs 3% of the hit area for the ~140ms the
// spring is settling, which is after the finger has already landed.

import { forwardRef, useMemo } from "react";
import { Pressable, type PressableProps, type View, type ViewStyle, type StyleProp } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { PRESS_DIM, PRESS_SCALE, PRESS_SPRING, useReducedMotion } from "../motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface TappableProps extends Omit<PressableProps, "style" | "children"> {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Opt out of the give — for a full-screen backdrop, or anything whose own
   *  transform is already doing a job. The press handlers and the hit area
   *  are unchanged. */
  noPress?: boolean;
}

export const Tappable = forwardRef<View, TappableProps>(function Tappable(
  { style, noPress = false, onPressIn, onPressOut, children, ...rest },
  ref
) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  // Scale is movement, so it goes when motion is reduced; dimming is not, and
  // it is enough on its own to say the press landed.
  const scale = reduced || noPress ? 0 : PRESS_SCALE;
  const dim = noPress ? 0 : PRESS_DIM;

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * scale }],
    opacity: 1 - pressed.value * dim,
  }));

  const composed = useMemo(() => [style, animated], [style, animated]);

  return (
    <AnimatedPressable
      ref={ref as never}
      style={composed}
      onPressIn={(event) => {
        pressed.value = withSpring(1, PRESS_SPRING);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withSpring(0, PRESS_SPRING);
        onPressOut?.(event);
      }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
});

export default Tappable;
