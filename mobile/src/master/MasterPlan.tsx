// Plan, across every track: the week, and what each track puts on each day.
//
// Seven cards read sideways, the same compromise the single-track week makes
// — seven columns wide enough to read is wider than any phone. Each card
// carries, per track, what that track calls the day and the rotation items it
// lands there. Each track keeps its own week number: they started on different
// days, so "week 12" is a different week for each of them.

import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { masterWeek } from "@shared/masterTrack";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { Refreshable } from "../components/Refreshable";
import { usePalette, useInk } from "../theme/ThemeProvider";
import { NothingSelected, ReadOnlyBand, TrackPicker } from "./MasterChrome";
import { makeMasterStyles } from "./styles";
import { useMasterSources } from "./useMasterSources";

const DAY_CARD = 136;

export function MasterPlan() {
  const palette = usePalette();
  const ink = useInk();
  const styles = useMemo(() => makeMasterStyles(palette), [palette]);
  const own = useMemo(() => makeStyles(palette), [palette]);
  const { tracks, sources, today } = useMasterSources();
  const [weekOffset, setWeekOffset] = useState(0);

  const week = useMemo(() => masterWeek(sources, weekOffset), [sources, weekOffset]);

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
      <ReadOnlyBand>
        Read only. The week each track is keeping — open one to change its rhythm.
      </ReadOnlyBand>
      <TrackPicker tracks={tracks} />

      {sources.length === 0 ? (
        <NothingSelected />
      ) : (
        <>
          <View style={own.weekBar}>
            <Step direction={-1} onPress={() => setWeekOffset(weekOffset - 1)} palette={palette} own={own} />
            <Text style={own.weekLabel}>
              {weekOffset === 0
                ? "This week"
                : weekOffset > 0
                  ? `+${weekOffset} week${weekOffset === 1 ? "" : "s"}`
                  : `${weekOffset} week${weekOffset === -1 ? "" : "s"}`}
            </Text>
            <Step direction={1} onPress={() => setWeekOffset(weekOffset + 1)} palette={palette} own={own} />
            {weekOffset !== 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setWeekOffset(0)}
                style={[own.todayButton, { backgroundColor: palette.accent }]}
              >
                <Text style={own.todayLabel}>Today</Text>
              </Pressable>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={own.weekRow}>
            {week.map((day) => {
              const isToday = day.date === today;
              return (
                <View key={day.name} style={[own.dayCard, isToday && { borderColor: palette.accent }]}>
                  <Text style={[own.dayName, isToday && { color: palette.foreground }]}>{day.name}</Text>
                  <Text style={own.dayDate}>{day.date.slice(5)}</Text>
                  {day.entries.map((entry) => (
                    <View key={entry.track.id} style={own.dayEntry}>
                      <View style={own.dayEntryHead}>
                        <Text style={[own.dayFocus, { color: ink(entry.track.color) }]} numberOfLines={2}>
                          {entry.label}
                        </Text>
                        {entry.rest && (
                          <Ionicons name="moon-outline" size={10} color={palette.subtleForeground} />
                        )}
                      </View>
                      {entry.rotations.map((rotation) => (
                        <Text
                          key={`${rotation.label}-${rotation.title}`}
                          style={own.dayItem}
                          numberOfLines={2}
                        >
                          {rotation.title}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              );
            })}
          </ScrollView>

          <Text style={styles.footnote}>
            Each track keeps its own week number — they began on different days, so the same date is
            a different week of each plan.
          </Text>
        </>
      )}
    </Refreshable>
  );
}

function Step({
  direction,
  onPress,
  palette,
  own,
}: {
  direction: -1 | 1;
  onPress: () => void;
  palette: Palette;
  own: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === -1 ? "Previous week" : "Next week"}
      onPress={onPress}
      hitSlop={8}
      style={own.step}
    >
      <Ionicons
        name={direction === -1 ? "chevron-back" : "chevron-forward"}
        size={16}
        color={palette.foreground}
      />
    </Pressable>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    weekBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm },
    weekLabel: { minWidth: 110, textAlign: "center", color: palette.foreground, ...TYPE.subhead, fontWeight: "700" },
    step: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    todayButton: { paddingHorizontal: SPACING.md, paddingVertical: 5, borderRadius: RADIUS.control },
    todayLabel: { color: "#000", ...TYPE.micro, fontWeight: "800", letterSpacing: 0.5 },

    weekRow: { gap: SPACING.sm, paddingBottom: SPACING.sm },
    dayCard: {
      width: DAY_CARD,
      gap: 4,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    dayName: { color: palette.mutedForeground, ...TYPE.label, fontWeight: "700" },
    dayDate: { color: palette.subtleForeground, ...TYPE.micro, marginBottom: 2 },
    dayEntry: { gap: 1, marginTop: 4 },
    dayEntryHead: { flexDirection: "row", alignItems: "center", gap: 4 },
    dayFocus: { flex: 1, ...TYPE.micro, fontWeight: "700", textTransform: "uppercase" },
    dayItem: { color: palette.mutedForeground, ...TYPE.caption, lineHeight: 15 },
  });
}
