// A scrolling screen that syncs when you pull it down — and looks like it.
//
// Android's own `RefreshControl` drops a spinner over the top of the page and
// leaves the page exactly where it was, which reads as something happening
// *to* the screen rather than because of what your thumb is doing. The gesture
// everyone actually has in mind is the page itself coming down, showing what
// is behind it, and springing back.
//
// So this does it by hand: a pan gesture that only takes over when the scroll
// is already at the top and the drag is downwards, translating the content
// with resistance so it slows as it stretches. Past a threshold it commits;
// short of it, it springs back having cost nothing.
//
// Written with the gesture running alongside the ScrollView's own rather than
// instead of it (`simultaneousWithExternalGesture`), so ordinary scrolling is
// untouched — the pull only exists in the one place the scroll cannot go.

import { useCallback, useState, type ComponentProps } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSync } from "../sync/SyncProvider";
import { settle } from "../feedback/haptics";
import { usePalette } from "../theme/ThemeProvider";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

/** How far the page has to come down before letting go syncs. */
const COMMIT_AT = 72;
/** Where it rests while the sync runs, so the spinner has somewhere to be. */
const RESTING = 56;
/** Beyond this the page stops following the thumb at all. */
const MAX = 120;

export function Refreshable({
  children,
  scrollRef,
  ...props
}: ComponentProps<typeof ScrollView> & {
  /** For screens that need to drive the scroll themselves — the consistency
   *  graph opens at its most recent end rather than its oldest. */
  scrollRef?: React.Ref<ScrollView>;
}) {
  const palette = usePalette();
  const { sync } = useSync();
  const [pulling, setPulling] = useState(false);

  const pull = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const armed = useSharedValue(false);
  // Decided once, when the finger lands, and not revisited for the rest of the
  // drag. Checking "are we at the top" on every frame is what made a fast
  // flick downwards unreliable: the flick is *also* how you scroll back to the
  // top, so half way up the check would start passing and the pull would grab
  // a gesture that was already a scroll.
  const canPull = useSharedValue(false);
  // The scroll view's own gesture, named so the pull can be composed *with* it
  // rather than pointed at a ref and hoped for. Handing
  // `simultaneousWithExternalGesture` a plain component ref is the part that
  // made scrolling unreliable: it does not register, so the two gestures
  // arbitrate instead of running together.
  const native = Gesture.Native();

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const run = useCallback(async () => {
    setPulling(true);
    try {
      await sync();
    } finally {
      setPulling(false);
      pull.value = withTiming(0, { duration: 220 });
    }
  }, [pull, sync]);

  const pan = Gesture.Pan()
    // A deliberate drag, not a flick: 24 points is past what a scroll gesture
    // covers before the list starts moving, so an ordinary swipe never trips
    // it. Any upward movement fails it outright.
    .activeOffsetY(24)
    .failOffsetY(-4)
    .onBegin(() => {
      canPull.value = scrollY.value <= 0;
    })
    .onUpdate((event) => {
      if (!canPull.value || event.translationY <= 0) return;
      // Square-root resistance: it follows the thumb closely at first and
      // stiffens as it stretches, which is what makes it feel elastic rather
      // than loose.
      pull.value = Math.min(MAX, Math.sqrt(event.translationY) * 9);

      const nowArmed = pull.value >= COMMIT_AT;
      if (nowArmed !== armed.value) {
        armed.value = nowArmed;
        if (nowArmed) runOnJS(settle)();
      }
    })
    .onEnd(() => {
      const committed = canPull.value && pull.value >= COMMIT_AT;
      armed.value = false;
      canPull.value = false;
      if (committed) {
        pull.value = withTiming(RESTING, { duration: 160 });
        runOnJS(run)();
      } else {
        pull.value = withTiming(0, { duration: 220 });
      }
    });

  const content = useAnimatedStyle(() => ({ transform: [{ translateY: pull.value }] }));
  const indicator = useAnimatedStyle(() => ({
    opacity: interpolate(pull.value, [0, COMMIT_AT * 0.6], [0, 1], "clamp"),
    transform: [
      { translateY: pull.value - RESTING },
      // The arrow turns over as it becomes committable, so the threshold is
      // visible as well as felt.
      { rotate: `${interpolate(pull.value, [0, COMMIT_AT], [0, 180], "clamp")}deg` },
    ],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.indicator, indicator]} pointerEvents="none">
        {pulling ? (
          <ActivityIndicator size="small" color={palette.accent} />
        ) : (
          <Ionicons name="arrow-down" size={20} color={palette.accent} />
        )}
      </Animated.View>

      <Animated.View style={[styles.fill, content]}>
        <GestureDetector gesture={Gesture.Simultaneous(pan, native)}>
          <AnimatedScrollView ref={scrollRef} {...props} onScroll={onScroll} scrollEventThrottle={16}>
            {children}
          </AnimatedScrollView>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  fill: { flex: 1 },
  indicator: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: RESTING,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});
