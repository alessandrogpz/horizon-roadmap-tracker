// Swipe a row sideways to act on it.
//
// The gesture everyone already knows from every mail and list app on the
// phone, and the one that was missing here: archiving a track meant holding
// it, opening a panel and finding a button. A swipe says what it will do while
// you are still deciding — the action appears behind the row and grows as you
// pull — and lets go of the idea without committing if you change your mind.
//
// Two directions, two meanings, deliberately not interchangeable:
//
//   left  (pull the row leftwards)  the gentle one — archive, hide, put away
//   right (pull the row rightwards) the destructive one — remove
//
// Either can be omitted, and a row with only one action only swipes that way.
// Nothing is confirmed: what protects the destructive side is the undo bar,
// which is a better answer than a dialog for the same reason it always was.

import { useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { warn } from "../feedback/haptics";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

/** How far the row has to travel before letting go commits it. About a
 *  thumb's width: far enough that a sideways scroll does not trigger it, near
 *  enough that it never feels like a drag. */
const COMMIT_AT = 96;
const MAX = 140;

export interface SwipeAction {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  colour: string;
  onAct: () => void;
}

export function SwipeRow({
  left,
  right,
  children,
}: {
  /** Revealed by pulling the row leftwards. The gentle action. */
  left?: SwipeAction;
  /** Revealed by pulling the row rightwards. The destructive one. */
  right?: SwipeAction;
  children: React.ReactNode;
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const offset = useSharedValue(0);
  const armed = useSharedValue(false);

  const act = useCallback(
    (which: "left" | "right") => {
      const action = which === "left" ? left : right;
      action?.onAct();
    },
    [left, right]
  );

  const pan = Gesture.Pan()
    // Only a decidedly horizontal drag, and it gives up on the first hint of a
    // vertical one. These numbers are why scrolling felt sticky: every row and
    // every panel is wrapped in one of these, so a 12-point vertical dead zone
    // at the start of a drag was a 12-point dead zone at the start of *every
    // scroll*. Four points is past a resting thumb's wobble and under anything
    // deliberate.
    .activeOffsetX([-14, 14])
    .failOffsetY([-4, 4])
    .onUpdate((event) => {
      const wanted = event.translationX;
      // Nothing to reveal on a side with no action, so the row does not move
      // that way at all.
      if ((wanted < 0 && !left) || (wanted > 0 && !right)) return;
      offset.value = Math.max(-MAX, Math.min(MAX, wanted));

      const nowArmed = Math.abs(offset.value) >= COMMIT_AT;
      if (nowArmed !== armed.value) {
        armed.value = nowArmed;
        // A nudge exactly when it becomes committable, so the threshold can be
        // felt rather than guessed at.
        if (nowArmed) runOnJS(warn)();
      }
    })
    .onEnd(() => {
      const committed = Math.abs(offset.value) >= COMMIT_AT;
      const direction = offset.value < 0 ? "left" : "right";
      armed.value = false;
      offset.value = withTiming(0, { duration: 180 });
      if (committed) runOnJS(act)(direction);
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  // Each action's backdrop is only visible while the row is pulled its way.
  const leftStyle = useAnimatedStyle(() => ({ opacity: offset.value < 0 ? 1 : 0 }));
  const rightStyle = useAnimatedStyle(() => ({ opacity: offset.value > 0 ? 1 : 0 }));

  return (
    <View style={styles.wrap}>
      {left && (
        <Animated.View style={[styles.action, styles.actionRight, { backgroundColor: left.colour }, leftStyle]}>
          <Ionicons name={left.icon} size={18} color="#fff" />
          <Text style={styles.actionLabel}>{left.label}</Text>
        </Animated.View>
      )}
      {right && (
        <Animated.View style={[styles.action, styles.actionLeft, { backgroundColor: right.colour }, rightStyle]}>
          <Ionicons name={right.icon} size={18} color="#fff" />
          <Text style={styles.actionLabel}>{right.label}</Text>
        </Animated.View>
      )}

      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    wrap: { borderRadius: RADIUS.card, overflow: "hidden", backgroundColor: palette.background },
    action: {
      position: "absolute",
      top: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      paddingHorizontal: SPACING.lg,
    },
    actionLeft: { left: 0 },
    actionRight: { right: 0 },
    actionLabel: { color: "#fff", fontSize: 13, fontWeight: "700" },
  });
}
