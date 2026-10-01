// The furniture every all-tracks tab shares: the read-only band, the row of
// switches that says which tracks are in the view, and the chip that names
// which track a row belongs to.
//
// On every tab rather than only the first, because the question "what am I
// looking at" is asked constantly once there are six tracks, and an answer
// behind a tap is an answer you stop checking. It is one compact row, so the
// repetition costs a line.

import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { TrackState } from "@shared/types";
import { RADIUS, SPACING, TYPE, withAlpha, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { useMasterMode } from "./MasterMode";

/** Says once, at the top, what is true of everything below it. Repeating it
 *  as a disabled control on every row would be noise — and a disabled control
 *  is a thing that looks like it should work. */
export function ReadOnlyBand({ children }: { children: string }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.banner}>
      <Ionicons name="lock-closed-outline" size={13} color={palette.subtleForeground} />
      <Text style={styles.bannerText}>{children}</Text>
    </View>
  );
}

/** Which tracks are in the view. Switching one off changes this view and
 *  nothing else — said in the footnote, because a switch beside a track's name
 *  in an app that can delete tracks deserves to be unambiguous. */
export function TrackPicker({ tracks }: { tracks: TrackState[] }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { excluded, toggleTrack } = useMasterMode();

  if (tracks.length === 0) return null;

  return (
    <View style={styles.picker}>
      {tracks.map((track) => {
        const on = !excluded.includes(track.meta.id);
        const colour = track.meta.color || palette.accent;
        return (
          <Pressable
            key={track.meta.id}
            accessibilityRole="switch"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${track.meta.name}, ${on ? "shown" : "hidden"}`}
            onPress={() => toggleTrack(track.meta.id)}
            style={[
              styles.chip,
              on ? { borderColor: colour, backgroundColor: withAlpha(colour, 0.12) } : { borderColor: palette.cardBorder },
            ]}
          >
            <View style={[styles.chipDot, { backgroundColor: on ? colour : palette.cardBorder }]} />
            <Text style={[styles.chipLabel, !on && { color: palette.subtleForeground }]} numberOfLines={1}>
              {track.meta.name}
            </Text>
            <Ionicons
              name={on ? "eye-outline" : "eye-off-outline"}
              size={12}
              color={on ? palette.foreground : palette.subtleForeground}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Which track a row belongs to. On every row: an aggregate whose rows all
 *  look alike is a list you cannot read. */
export function TrackChip({ name, colour }: { name: string; colour: string }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={[styles.trackChip, { backgroundColor: withAlpha(colour, 0.16) }]}>
      <Text style={[styles.trackChipLabel, { color: colour }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

export function NothingSelected() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <Text style={styles.muted}>Every track is switched off. Turn one back on above.</Text>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: RADIUS.control,
      backgroundColor: palette.surfaceMuted,
    },
    bannerText: { flex: 1, color: palette.mutedForeground, ...TYPE.caption, lineHeight: 17 },

    picker: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
    },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    chipLabel: { color: palette.foreground, ...TYPE.label, fontWeight: "600", maxWidth: 130 },

    trackChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.control, maxWidth: 110 },
    trackChipLabel: { ...TYPE.micro, fontWeight: "700" },

    muted: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
  });
}
