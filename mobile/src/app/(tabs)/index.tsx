// My Space: the track, as a column of panels you arrange yourself.
//
// This is the idea the website's dashboard is built on, brought over rather
// than reinvented — the same module ids, the same `hiddenPanels` on the track,
// so closing the notepad here closes it on the laptop too. What does not come
// over is the two-column layout: a phone has one column, and the order is kept
// on the device for that reason (panels/layout.ts explains why).
//
// Arranging is a mode, not a permanent affordance. In normal use a panel is
// something you read and tap through; holding one — or tapping Arrange —
// collapses them all to fixed-height rows that can be dragged, removed, and
// added to. Fixed height is what makes the drag honest: the distance moved
// divides cleanly into a number of rows, where variable-height cards would
// need measuring every one of them and would still jump under the thumb.

import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { Refreshable } from "../../components/Refreshable";
import { PanelCard } from "../../panels/PanelCard";
import { PanelBody, PANEL_HREF, PANEL_ICON, tintFor } from "../../panels/registry";
import { availablePanels, panelDefinition, setPanelHidden, visiblePanels } from "../../panels/layout";
import { panelOrder, setPanelOrder } from "../../storage/deviceSettings";
import { RADIUS, SPACING, type Palette } from "../../theme";
import { usePalette } from "../../theme/ThemeProvider";

const ROW = 56;

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

  const startArranging = useCallback(() => {
    if (!track) return;
    setOrder(visiblePanels(track));
    setArranging(true);
  }, [track]);

  const move = useCallback(
    (from: number, to: number) => {
      if (!track) return;
      setOrder((current) => {
        const next = [...current];
        const [moved] = next.splice(from, 1);
        next.splice(Math.max(0, Math.min(next.length, to)), 0, moved);
        setPanelOrder(track.meta.id, next);
        return next;
      });
    },
    [track]
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
    <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
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
        <Pressable onLongPress={startArranging} delayLongPress={450} style={styles.stack}>
          {shown.map((id) => {
            const definition = panelDefinition(id);
            if (!definition) return null;
            return (
              <PanelCard
                key={id}
                title={definition.label}
                icon={PANEL_ICON[id] ?? "square-outline"}
                accent={tintFor(id)}
                href={PANEL_HREF[id]}
              >
                <PanelBody id={id} track={track} today={today} />
              </PanelCard>
            );
          })}

          {shown.length === 0 && (
            <Text style={styles.muted}>
              No panels yet. Tap Arrange to add some — this is the screen that shows the whole track at
              once.
            </Text>
          )}

          <Text style={styles.footnote}>
            Hold any panel to rearrange. Which panels you have follows your account; the order they are
            in is this phone&apos;s, because a phone has one column and the website has two.
          </Text>
        </Pressable>
      )}
    </Refreshable>
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
    })
    .onUpdate((event) => {
      offset.value = event.translationY;
    })
    .onEnd(() => {
      const moved = Math.round(offset.value / ROW);
      const target = Math.max(0, Math.min(count - 1, index + moved));
      offset.value = 0;
      lifted.value = 0;
      if (target !== index) runOnJS(onMove)(index, target);
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
    bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    barTitle: { color: palette.foreground, fontSize: 15, fontWeight: "700" },
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
    barLabel: { color: palette.mutedForeground, fontSize: 12, fontWeight: "600" },
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
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
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
    addLabel: { flex: 1, color: palette.foreground, fontSize: 14, fontWeight: "600" },
    muted: { color: palette.mutedForeground, fontSize: 12, lineHeight: 17 },
    footnote: { color: palette.subtleForeground, fontSize: 11, lineHeight: 16, marginTop: SPACING.md },
  });
}
