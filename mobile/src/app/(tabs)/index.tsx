// My Space: the track, as a column of panels you arrange yourself.
//
// This is the idea the website's dashboard is built on, brought over rather
// than reinvented — the same module ids, the same `hiddenPanels` on the track,
// so closing the notepad here closes it on the laptop too. What does not come
// over is the two-column layout: a phone has one column, and the order is kept
// on the device for that reason (panels/layout.ts explains why).
//
// There are two ways to rearrange, and they are for different things.
//
// Holding a panel picks it up. Every panel folds down to its own header,
// the held one comes to the thumb, and the rest step aside as it passes;
// letting go drops it where it is and everything opens back up. Nothing is
// confirmed and nothing is entered — the gesture is the whole interaction,
// which is why it has to be the folding that the eye follows rather than a
// cut to a different screen. A cut would lose the one thing the hand is
// keeping track of: which panel is still under the finger.
//
// Tapping Arrange is the other thing: a mode that stays put, for adding
// panels and removing them, where a list of rows beats a column of cards.
//
// Collapsed panels are all one height, which is what makes the drag honest:
// the distance moved divides cleanly into a number of slots, where
// variable-height cards would need measuring every one of them and would
// still jump under the thumb.

import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  type AnimatedRef,
  type SharedValue,
  measure,
  runOnJS,
  useAnimatedRef,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { TrackState } from "@shared/types";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { Refreshable } from "../../components/Refreshable";
import { PanelCard } from "../../panels/PanelCard";
import { PanelBoundary } from "../../components/PanelBoundary";
import { SwipeRow } from "../../components/SwipeRow";
import { settle, tap } from "../../feedback/haptics";
import { PanelBody, PANEL_HREF, PANEL_ICON, tintFor } from "../../panels/registry";
import { availablePanels, panelDefinition, setPanelHidden, visiblePanels } from "../../panels/layout";
import { panelOrder, setPanelOrder } from "../../storage/deviceSettings";
import { RADIUS, SPACING, TYPE, type Palette } from "../../theme";
import { usePalette } from "../../theme/ThemeProvider";

/** A folded panel: tall enough for its header and nothing else. */
const ROW = 56;
/** The gap `styles.stack` puts between panels, needed as a number because
 *  the drag has to do arithmetic with it. */
const GAP = SPACING.md;
const SLOT = ROW + GAP;
/** Stands in for a panel's open height until it has been measured: tall
 *  enough to constrain nothing. */
const UNMEASURED = 10000;

export default function SpaceScreen() {
  const { track, today, editTrack } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [arranging, setArranging] = useState(false);
  // The order lives on the device, so the screen keeps a copy in state to
  // re-render from and writes through on every change.
  const [order, setOrder] = useState<string[]>([]);

  const shown = useMemo(() => {
    if (!track) return [];
    const resolved = visiblePanels(track);
    // `order` is the working copy while arranging; outside that, whatever the
    // device last stored wins.
    return order.length ? order.filter((id) => resolved.includes(id)) : resolved;
  }, [order, track]);

  const available = useMemo(() => (track ? availablePanels(track) : []), [track]);

  // How far through the fold everything is: 0 is the ordinary column, 1 is
  // every panel reduced to its header. One value shared by all of them, so the
  // whole column moves together and the held panel keeps its place in it.
  const collapse = useSharedValue(0);
  /** Which panel is in the hand, by index, or -1. */
  const held = useSharedValue(-1);
  /** Where it would land if released now — what the others step aside for. */
  const target = useSharedValue(-1);
  const dragY = useSharedValue(0);
  /** How far the whole folded column has to move so that the held panel's
   *  slot lands exactly where the held panel already is — under the finger.
   *  Moving the column rather than the panel is what keeps the two agreeing:
   *  the panel stays put, and the gap opens around it. */
  const columnShift = useSharedValue(0);
  /** The column's open height, taken at pick-up. While a panel is held the
   *  column is pinned to it, so the page keeps the length it had. Letting it
   *  shrink is what made this break once the page was scrolled: a ScrollView
   *  whose content gets shorter pulls its offset back to the new bottom, and
   *  the whole column slides up out from under the finger. At the top of the
   *  page there is no offset to pull back, which is why it only showed up
   *  after scrolling. */
  const lockedHeight = useSharedValue(0);
  /** The column itself, so the drag can measure where it really is rather
   *  than reconstruct it from arithmetic. */
  const stackRef = useAnimatedRef<View>();
  const [dragging, setDragging] = useState(false);

  // The column gets shorter as it folds, which would drag the scroll position
  // up from under the drag. This makes up the difference, so the content is
  // the same height throughout and nothing moves that was not asked to.
  // The fold happens around the held panel instead of at the top of the
  // page. Without this the column collapses upward and the gap opens
  // wherever the column ended up, which can be most of a screen away from
  // the thumb that is supposed to be pointing at it.
  const column = useAnimatedStyle(() => ({
    // Held at its open height for the whole gesture, and released only once
    // the panels have finished growing back into it.
    minHeight: collapse.value > 0 ? lockedHeight.value : 0,
    transform: [{ translateY: columnShift.value * collapse.value }],
  }));

  // Everything that is not a panel gets out of the way while one is held.
  // The column folds around the thumb, and a paragraph of explanation
  // sitting in the middle of it is just something to read by accident.
  const chrome = useAnimatedStyle(() => ({ opacity: 1 - collapse.value }));


  const startArranging = useCallback(() => {
    if (!track) return;
    setOrder(visiblePanels(track));
    setArranging(true);
  }, [track]);

  // Built from what is on screen rather than from `order`, which is empty
  // until Arrange seeds it. Dragging a panel starts from the column as it is,
  // so it has to read the same list the column was drawn from.
  const move = useCallback(
    (from: number, to: number) => {
      if (!track) return;
      const next = [...shown];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(Math.max(0, Math.min(next.length, to)), 0, moved);
      setPanelOrder(track.meta.id, next);
      setOrder(next);
    },
    [shown, track]
  );

  const beginDrag = useCallback(() => {
    setDragging(true);
    tap();
  }, []);

  const endDrag = useCallback(
    (from: number, to: number) => {
      if (to !== from && to >= 0) {
        move(from, to);
        settle();
      }
      held.value = -1;
      target.value = -1;
      dragY.value = 0;
      // The shift deliberately stays where it is. The column's offset is
      // `columnShift * collapse`, so letting collapse fall to zero unwinds it
      // on exactly the path it came in on: the panel just dropped holds its
      // place and the others open outward from it. Zeroing the shift here
      // instead snapped the column back to the top of the page first, and
      // what you saw was every panel teleporting up there and growing
      // downwards — the fold played back as a cut rather than in reverse.
      // Nothing needs resetting: at rest collapse is 0, so the offset is 0
      // whatever the shift holds, and the next pick-up recomputes it.
      collapse.value = withTiming(0, { duration: 260 });
      setDragging(false);
    },
    [collapse, columnShift, dragY, held, move, target]
  );

  const show = useCallback(
    (id: string) => {
      if (!track) return;
      editTrack((t) => setPanelHidden(t, id, false));
      // A panel that has just been asked for belongs where it was asked for —
      // the end of the list — rather than wherever its id happens to sort.
      const next = [...(panelOrder(track.meta.id).length ? panelOrder(track.meta.id) : visiblePanels(track)), id];
      setPanelOrder(track.meta.id, next);
      setOrder(next);
    },
    [editTrack, track]
  );

  const hide = useCallback(
    (id: string) => {
      if (!track) return;
      editTrack((t) => setPanelHidden(t, id, true));
      setOrder((current) => {
        const next = current.filter((x) => x !== id);
        setPanelOrder(track.meta.id, next);
        return next;
      });
    },
    [editTrack, track]
  );

  if (!track) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>No track open.</Text>
      </View>
    );
  }

  return (
    // Scrolling is off while a panel is in the hand: the page moving under a
    // drag that is itself vertical would be two answers to one gesture.
    <Refreshable style={styles.screen} contentContainerStyle={styles.content} scrollEnabled={!dragging}>
      <View style={styles.bar}>
        <Text style={styles.barTitle}>{arranging ? "Drag to reorder" : "My space"}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => (arranging ? setArranging(false) : startArranging())}
          style={[styles.barButton, arranging && { borderColor: palette.accent }]}
        >
          <Ionicons
            name={arranging ? "checkmark" : "options-outline"}
            size={14}
            color={arranging ? palette.accent : palette.mutedForeground}
          />
          <Text style={[styles.barLabel, arranging && { color: palette.accent }]}>
            {arranging ? "Done" : "Arrange"}
          </Text>
        </Pressable>
      </View>

      {arranging ? (
        <>
          <View style={{ height: shown.length * ROW }}>
            {shown.map((id, index) => (
              <ArrangeRow
                key={id}
                id={id}
                index={index}
                count={shown.length}
                onMove={move}
                onRemove={() => hide(id)}
                styles={styles}
                palette={palette}
              />
            ))}
          </View>

          {available.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Add a panel</Text>
              {available.map((panel) => (
                <Pressable
                  key={panel.id}
                  accessibilityRole="button"
                  onPress={() => show(panel.id)}
                  style={styles.addRow}
                >
                  <View style={[styles.addIcon, { backgroundColor: `${tintFor(panel.id) ?? palette.accent}22` }]}>
                    <Ionicons
                      name={PANEL_ICON[panel.id] ?? "add"}
                      size={15}
                      color={tintFor(panel.id) ?? palette.accent}
                    />
                  </View>
                  <View style={styles.addText}>
                    <Text style={styles.addLabel}>{panel.label}</Text>
                    <Text style={styles.muted}>{panel.hint}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={20} color={palette.mutedForeground} />
                </Pressable>
              ))}
            </>
          )}
        </>
      ) : (
        <Animated.View ref={stackRef} style={[styles.stack, column]}>
          {shown.map((id, index) => (
            <DraggablePanel
              key={id}
              id={id}
              index={index}
              count={shown.length}
              dragging={dragging}
              collapse={collapse}
              held={held}
              target={target}
              dragY={dragY}
              columnShift={columnShift}
              lockedHeight={lockedHeight}
              stackRef={stackRef}
              onBegin={beginDrag}
              onEndDrag={endDrag}
              onHide={hide}
              track={track}
              today={today}
              styles={styles}
              palette={palette}
            />
          ))}

        </Animated.View>
      )}

      {/* Outside the column, because the column moves to the thumb when a
          panel is picked up and a footnote has no business following it —
          and faded out entirely while it is held. */}
      {!arranging && (
        <Animated.View style={[styles.chrome, chrome]} pointerEvents={dragging ? "none" : "auto"}>
          {shown.length === 0 && (
            <Text style={styles.muted}>
              No panels yet. Tap Arrange to add some — this is the screen that shows the whole track
              at once.
            </Text>
          )}

          <Text style={styles.footnote}>
            Hold a panel anywhere to pick it up and drag it somewhere else, or swipe one away to
            hide it. Which panels you have follows your account; the order they are
            in is this phone&apos;s, because a phone has one column and the website has two.
          </Text>
        </Animated.View>
      )}
    </Refreshable>
  );
}

/**
 * A panel in the column, and the gesture that picks it up.
 *
 * The gesture is a pan that only activates after the finger has been still for
 * a moment, which is what lets it share the screen with everything else: a tap
 * opens the panel, a sideways swipe hides it, a drag scrolls the page, and only
 * a hold reaches this. Because it is a pan and not a long-press followed by a
 * separate drag, the finger never has to lift — picking up and moving are one
 * continuous gesture, which is the difference between reordering and entering a
 * reordering mode.
 *
 * Two measurements make the fold work. `heights` is what the panel is when
 * open, taken from a plain inner view that keeps its natural size whatever the
 * animated wrapper is doing to it. `anchor` is the distance the held panel has
 * to travel to stay under the finger once the panels above it have folded —
 * the sum of what they lose, plus where in the panel the finger actually
 * landed. Without it the panel would collapse upward out of the hand.
 */
function DraggablePanel({
  id,
  index,
  count,
  dragging,
  collapse,
  held,
  target,
  dragY,
  columnShift,
  lockedHeight,
  stackRef,
  onBegin,
  onEndDrag,
  onHide,
  track,
  today,
  styles,
  palette,
}: {
  id: string;
  index: number;
  count: number;
  dragging: boolean;
  collapse: SharedValue<number>;
  held: SharedValue<number>;
  target: SharedValue<number>;
  dragY: SharedValue<number>;
  columnShift: SharedValue<number>;
  lockedHeight: SharedValue<number>;
  stackRef: AnimatedRef<View>;
  onBegin: () => void;
  onEndDrag: (from: number, to: number) => void;
  onHide: (id: string) => void;
  track: TrackState;
  today: string;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const definition = panelDefinition(id);
  const [open, setOpen] = useState<number | null>(null);
  /** This panel's own step out of the way, animated so the column parts rather
   *  than snaps. Reset instantly when the drag ends, because by then the real
   *  order has changed and layout has already put the panel where the shift
   *  was pretending it was. */
  const shift = useSharedValue(0);
  /** Set by onEnd so onFinalize can tell a finished drag from a cancelled one
   *  — a call arriving mid-drag must not leave the column folded. */
  const ended = useSharedValue(false);

  useAnimatedReaction(
    () => ({ h: held.value, t: target.value }),
    ({ h, t }) => {
      if (h < 0 || h === index || t < 0) {
        shift.value = 0;
        return;
      }
      const step = index > h && index <= t ? -SLOT : index < h && index >= t ? SLOT : 0;
      shift.value = withTiming(step, { duration: 160 });
    },
    [index]
  );

  const drag = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart((event) => {
      held.value = index;
      target.value = index;
      ended.value = false;

      // Where the panel has to go to stay under the finger, taken from where
      // the column actually is on screen rather than from adding up what every
      // panel above it measured. The arithmetic version had to reproduce
      // Yoga's layout exactly — every gap, every bit of padding, every height
      // arriving from a shared value that may not have reached this thread
      // yet — and when it was off, the panel left the finger at the fold.
      // Where this panel's folded slot would land if the column folded in
      // place, against where the finger actually is. The difference is what
      // the column has to move so the two coincide.
      const box = measure(stackRef);
      columnShift.value = box ? event.absoluteY - ROW / 2 - (box.pageY + index * SLOT) : 0;
      lockedHeight.value = box ? box.height : 0;

      collapse.value = withTiming(1, { duration: 240 });
      runOnJS(onBegin)();
    })
    .onUpdate((event) => {
      dragY.value = event.translationY;
      // Slots travelled, not where the panel has ended up. The panel sits
      // under the finger, which means it starts off the grid by however far
      // down it was grabbed — measuring its position against the slots would
      // make "up one panel" a different distance every time, depending on
      // where the finger happened to land.
      const next = Math.max(0, Math.min(count - 1, index + Math.round(dragY.value / SLOT)));
      if (next !== target.value) {
        target.value = next;
        runOnJS(tap)();
      }
    })
    .onEnd(() => {
      ended.value = true;
      const to = target.value;
      // Settle into the slot before the order actually changes, so the panel
      // is already where it is going when the list catches up and there is
      // nothing left to jump.
      // The panel already sits in its own slot within the shifted column, so
      // landing somewhere else is simply that many slots away.
      const landing = (to - index) * SLOT;
      // Dropped where it was picked up: there is nothing to settle, and
      // handing `withTiming` a value it already holds means the release waits
      // on an animation that has nowhere to go.
      if (Math.abs(landing - dragY.value) < 1) {
        dragY.value = landing;
        runOnJS(onEndDrag)(index, to);
        return;
      }
      dragY.value = withTiming(landing, { duration: 170 }, (finished) => {
        if (finished) runOnJS(onEndDrag)(index, to);
      });
    })
    .onFinalize(() => {
      if (held.value === index && !ended.value) runOnJS(onEndDrag)(index, index);
    });

  const animated = useAnimatedStyle(() => {
    // `maxHeight`, not `height`, so an unmeasured panel is simply
    // unconstrained rather than wrong. That is what lets this render the same
    // way whether or not the measurement has arrived: there used to be a
    // second branch for the frame before it, and a panel whose layout event
    // never came a second time stayed in that branch for good — rendered, but
    // with no wrapper to fold.
    const full = open ?? UNMEASURED;
    const mine = held.value === index;
    return {
      maxHeight: full + (ROW - full) * collapse.value,
      transform: [
        { translateY: mine ? dragY.value : shift.value },
        // Just enough lift to read as picked up rather than as a layout bug.
        { scale: mine ? 1 + 0.03 * collapse.value : 1 },
      ],
      zIndex: mine ? 20 : 1,
    };
  }, [open, index]);

  const body = useAnimatedStyle(() => ({ opacity: 1 - collapse.value }));
  const ring = useAnimatedStyle(() => ({
    opacity: held.value === index ? collapse.value : 0,
  }));

  if (!definition) return null;

  const content = (
    // One panel failing should cost one panel, not the home screen.
    <PanelBoundary label={definition.label}>
      {/* Swiping a panel away hides it, the same gesture as anywhere else.
          Nothing is lost — it is waiting in Arrange, and the data behind it is
          untouched — so this one needs no undo. */}
      <SwipeRow left={{ label: "Hide", icon: "eye-off-outline", colour: "#64748b", onAct: () => onHide(id) }}>
        <PanelCard
          title={definition.label}
          icon={PANEL_ICON[id] ?? "square-outline"}
          accent={tintFor(id)}
          href={PANEL_HREF[id]}
        >
          <Animated.View style={body}>
            <PanelBody id={id} track={track} today={today} />
          </Animated.View>
        </PanelCard>
      </SwipeRow>
    </PanelBoundary>
  );

  const remember = (height: number) => {
    if (open !== null && Math.abs(open - height) < 1) return;
    setOpen(height);
  };

  return (
    <GestureDetector gesture={drag}>
      <Animated.View style={[styles.slot, animated]}>
        {/* Inside the clipped wrapper but unconstrained by it, so it keeps
            reporting what the panel *would* be if it were open. */}
        <View
          onLayout={(event) => remember(event.nativeEvent.layout.height)}
          pointerEvents={dragging ? "none" : "auto"}
        >
          {content}
        </View>
        <Animated.View style={[styles.ring, ring, { borderColor: palette.accent }]} pointerEvents="none" />
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * One draggable row.
 *
 * The gesture moves the row under the thumb and, on release, reports how many
 * row-heights it travelled. Nothing re-orders mid-drag: the list stays still
 * and only the dragged row moves, which is less pretty than neighbours sliding
 * apart and far more predictable to land.
 */
function ArrangeRow({
  id,
  index,
  count,
  onMove,
  onRemove,
  styles,
  palette,
}: {
  id: string;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const offset = useSharedValue(0);
  const lifted = useSharedValue(0);
  const definition = panelDefinition(id);

  const drag = Gesture.Pan()
    .activateAfterLongPress(120)
    .onStart(() => {
      lifted.value = 1;
      runOnJS(tap)();
    })
    .onUpdate((event) => {
      offset.value = event.translationY;
    })
    .onEnd(() => {
      const moved = Math.round(offset.value / ROW);
      const target = Math.max(0, Math.min(count - 1, index + moved));
      offset.value = 0;
      lifted.value = 0;
      if (target !== index) {
        runOnJS(onMove)(index, target);
        runOnJS(settle)();
      }
    });

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }, { scale: lifted.value ? 1.03 : 1 }],
    zIndex: lifted.value ? 10 : 1,
    opacity: lifted.value ? 0.95 : 1,
  }));

  if (!definition) return null;

  return (
    <Animated.View style={[styles.arrangeRow, { top: index * ROW }, animated]}>
      <GestureDetector gesture={drag}>
        <View style={styles.grip}>
          <Ionicons name="reorder-three" size={22} color={palette.subtleForeground} />
        </View>
      </GestureDetector>

      <View style={[styles.addIcon, { backgroundColor: `${tintFor(id) ?? palette.accent}22` }]}>
        <Ionicons name={PANEL_ICON[id] ?? "square-outline"} size={15} color={tintFor(id) ?? palette.accent} />
      </View>
      <Text style={styles.addLabel} numberOfLines={1}>
        {definition.label}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${definition.label}`}
        onPress={onRemove}
        hitSlop={8}
      >
        <Ionicons name="close-circle" size={20} color={palette.subtleForeground} />
      </Pressable>
    </Animated.View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xl },
    centered: { alignItems: "center", justifyContent: "center" },
    stack: { gap: SPACING.md },
    chrome: { gap: SPACING.md },
    // Clips the panel to whatever the fold has left of it.
    slot: { overflow: "hidden", borderRadius: RADIUS.card },
    ring: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: RADIUS.card,
      borderWidth: 2,
    },
    bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    barTitle: { color: palette.foreground, ...TYPE.subhead, fontWeight: "700" },
    barButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    barLabel: { color: palette.mutedForeground, ...TYPE.caption, fontWeight: "600" },
    arrangeRow: {
      position: "absolute",
      left: 0,
      right: 0,
      height: ROW - 8,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    grip: { paddingVertical: SPACING.sm, paddingRight: SPACING.xs },
    sectionTitle: {
      color: palette.subtleForeground,
      ...TYPE.eyebrow,
      fontWeight: "700",
      letterSpacing: 1.2,
      marginTop: SPACING.md,
    },
    addRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    addIcon: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    addText: { flex: 1, gap: 1 },
    addLabel: { flex: 1, color: palette.foreground, ...TYPE.body, fontWeight: "600" },
    muted: { color: palette.mutedForeground, ...TYPE.caption, lineHeight: 17 },
    footnote: { color: palette.subtleForeground, ...TYPE.micro, lineHeight: 16, marginTop: SPACING.md },
  });
}
