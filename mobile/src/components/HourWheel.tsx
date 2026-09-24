// Picking an hour, by spinning it rather than by hunting for it.
//
// This replaced twenty-four buttons. A grid of chips is fine for two or three
// choices and absurd for a full day: it fills the screen, every option looks
// as likely as every other, and the one you want is somewhere in the middle of
// a wall of numbers.
//
// A wheel is the platform's own idiom for "one value from an ordered range",
// and this one is built out of a ScrollView rather than a native picker on
// purpose — a native picker is a new build, and a snapping ScrollView is the
// same gesture and the same result. The scroll snaps to whole rows, the row in
// the centre is the value, and the highlight band is what tells you so.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

const ROW = 44;
/** Rows of padding above and below, so the first and last hour can reach the
 *  centre band instead of stopping at the edge. */
const PAD = 2;

export function HourWheel({
  open,
  value,
  onPick,
  onClose,
}: {
  open: boolean;
  value: number;
  onPick: (hour: number) => void;
  onClose: () => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const scroller = useRef<ScrollView>(null);
  const chosen = useRef(value);

  // Open on the current value rather than at the top, so the wheel starts
  // where the setting already is.
  useEffect(() => {
    if (!open) return;
    chosen.current = value;
    const id = setTimeout(() => scroller.current?.scrollTo({ y: value * ROW, animated: false }), 0);
    return () => clearTimeout(id);
  }, [open, value]);

  const settle = useCallback((offsetY: number) => {
    chosen.current = Math.max(0, Math.min(23, Math.round(offsetY / ROW)));
  }, []);

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />

        <View style={styles.sheet}>
          <Text style={styles.title}>My day starts at</Text>
          <Text style={styles.hint}>
            Work logged before this hour counts for the previous day, so a late session doesn&apos;t
            land on tomorrow and break a streak.
          </Text>

          <View style={styles.wheel}>
            {/* The band marks which row counts. It sits behind the list and
                ignores touches, so it never eats a scroll. */}
            <View pointerEvents="none" style={[styles.band, { top: PAD * ROW }]} />
            <ScrollView
              ref={scroller}
              showsVerticalScrollIndicator={false}
              snapToInterval={ROW}
              decelerationRate="fast"
              onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.y)}
              // A slow drag that never gains momentum ends here instead, or the
              // value would keep whatever the last flick left behind.
              onScrollEndDrag={(event) => settle(event.nativeEvent.contentOffset.y)}
              contentContainerStyle={{ paddingVertical: PAD * ROW }}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <View key={hour} style={styles.row}>
                  {/* The wheel snaps to a fixed row height, so this one label
                      cannot grow with the OS font scale without breaking the
                      maths that decides which hour is selected. */}
                  <Text style={styles.rowLabel} allowFontScaling={false}>
                    {hour === 0 ? "Midnight" : hour === 12 ? "Midday" : `${String(hour).padStart(2, "0")}:00`}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.button}>
              <Text style={styles.buttonLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onPick(chosen.current);
                onClose();
              }}
              style={[styles.button, styles.primary]}
            >
              <Text style={styles.primaryLabel}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** How an hour reads outside the wheel. */
export function describeHour(hour: number): string {
  if (hour === 0) return "Midnight";
  if (hour === 12) return "Midday";
  return `${String(hour).padStart(2, "0")}:00`;
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      gap: SPACING.sm,
      padding: SPACING.lg,
      paddingBottom: SPACING.xl,
      backgroundColor: palette.card,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderTopWidth: 1,
      borderColor: palette.cardBorder,
    },
    title: { color: palette.foreground, fontSize: 16, fontWeight: "700" },
    hint: { color: palette.mutedForeground, fontSize: 12, lineHeight: 17 },
    wheel: { height: ROW * (PAD * 2 + 1), marginVertical: SPACING.sm },
    band: {
      position: "absolute",
      left: 0,
      right: 0,
      height: ROW,
      borderRadius: RADIUS.control,
      backgroundColor: palette.surfaceMuted,
      borderWidth: 1,
      borderColor: palette.accent,
    },
    row: { height: ROW, alignItems: "center", justifyContent: "center" },
    rowLabel: { color: palette.foreground, fontSize: 17, fontWeight: "600" },
    actions: { flexDirection: "row", gap: SPACING.sm },
    button: {
      flex: 1,
      alignItems: "center",
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    primary: { backgroundColor: palette.accent, borderColor: palette.accent },
    buttonLabel: { color: palette.mutedForeground, fontSize: 15, fontWeight: "600" },
    primaryLabel: { color: "#04121c", fontSize: 15, fontWeight: "700" },
  });
}
