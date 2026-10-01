// Progress, across every track: the run of days, two ways.
//
// `rows` keeps the tracks apart — one strip each, on the same calendar
// columns, so the same Tuesday is the same column on every row and one
// track's summer reads against another's. It is the default because it
// answers "how is each of them going".
//
// `one` puts them in the same squares, each day divided into a band per track
// that did something on it. That answers the other question — "did I do
// anything at all that day" — which rows make you scan a column for.
//
// Both of these used to be in different places: rows behind a toggle inside a
// single track's Progress, which is a strange home for a view about every
// track, and the divided grid on a screen of its own. A track's own Progress
// shows that track now, and both ways of seeing all of them live here.

import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { masterCalendar, masterRestWeekdays, masterStart, masterStreak } from "@shared/masterTrack";
import { marksRestDay } from "@shared/restDays";
import { parseYMD } from "@shared/dates";
import { getSettings } from "@shared/settings";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { Refreshable } from "../components/Refreshable";
import { AllTracksYear } from "../components/AllTracksYear";
import { MasterHeatmap } from "../components/MasterHeatmap";
import { usePalette } from "../theme/ThemeProvider";
import { NothingSelected, ReadOnlyBand, TrackPicker } from "./MasterChrome";
import { makeMasterStyles } from "./styles";
import { useMasterSources } from "./useMasterSources";

const LAYOUTS = [
  { value: "rows", label: "One per track" },
  { value: "one", label: "All in one" },
] as const;

type Layout = (typeof LAYOUTS)[number]["value"];

export function MasterProgress() {
  const palette = usePalette();
  const styles = useMemo(() => makeMasterStyles(palette), [palette]);
  const own = useMemo(() => makeStyles(palette), [palette]);
  const { tracks, sources, today } = useMasterSources();
  const [layout, setLayout] = useState<Layout>("rows");

  const weekStartsOn = getSettings().weekStartsOn;
  const year = useMemo(() => parseYMD(today).getFullYear(), [today]);
  const streak = useMemo(() => masterStreak(sources, today), [sources, today]);
  const days = useMemo(
    () => masterCalendar(sources, year, today, weekStartsOn),
    [sources, today, weekStartsOn, year]
  );
  const restDays = useMemo(() => masterRestWeekdays(sources), [sources]);
  const earliest = useMemo(() => masterStart(sources), [sources]);
  const isRest = useMemo(
    () => (date: string) => marksRestDay(date, restDays, today, earliest),
    [earliest, restDays, today]
  );

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
      <ReadOnlyBand>Read only. Every track&apos;s days — open one to add to it.</ReadOnlyBand>
      <TrackPicker tracks={tracks} />

      {sources.length === 0 ? (
        <NothingSelected />
      ) : (
        <>
          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Streak</Text>
              <Text style={styles.tileValue}>{streak.current}</Text>
              <Text style={styles.muted}>day{streak.current === 1 ? "" : "s"} running</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Longest</Text>
              <Text style={styles.tileValue}>{streak.longest}</Text>
              <Text style={styles.muted}>days</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Active days</Text>
              <Text style={styles.tileValue}>{streak.activeDays}</Text>
              <Text style={styles.muted}>{streak.activeLast30} in the last 30</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Logged</Text>
              <Text style={styles.tileValue}>{streak.totalAccomplishments}</Text>
              <Text style={styles.muted}>things, all told</Text>
            </View>
          </View>

          <View style={own.segmented}>
            {LAYOUTS.map((option) => {
              const on = option.value === layout;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setLayout(option.value)}
                  style={[own.segment, on && { backgroundColor: palette.card }]}
                >
                  <Text style={[own.segmentLabel, on && { color: palette.foreground }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {layout === "rows" ? (
            <View style={styles.card}>
              <AllTracksYear tracks={sources} year={year} today={today} weekStartsOn={weekStartsOn} />
            </View>
          ) : (
            <View style={styles.card}>
              <MasterHeatmap
                days={days}
                today={today}
                weeks={12}
                weekStartsOn={weekStartsOn}
                isRest={isRest}
              />
              {/* The key: which colour is whose. Only for this layout — the
                  rows carry their names down the side, and repeating them
                  under the chart says nothing twice. */}
              <View style={own.legend}>
                {sources.map((track) => (
                  <View key={track.meta.id} style={own.legendItem}>
                    <View style={[own.legendSwatch, { backgroundColor: track.meta.color }]} />
                    <Text style={styles.footnote} numberOfLines={1}>
                      {track.meta.name}
                    </Text>
                  </View>
                ))}
                {restDays.size > 0 && (
                  <View style={own.legendItem}>
                    <View style={[own.legendSwatch, own.legendRest]}>
                      <View style={[own.legendDot, { backgroundColor: palette.subtleForeground }]} />
                    </View>
                    <Text style={styles.footnote}>day off everywhere</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <Text style={styles.footnote}>
            {layout === "rows"
              ? "A strip each, on the same calendar columns — so the same day is the same place on every row."
              : "One square a day, split between the tracks that did something on it. The last twelve weeks."}
          </Text>
        </>
      )}
    </Refreshable>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    segmented: {
      flexDirection: "row",
      alignSelf: "center",
      padding: 3,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    segment: { paddingHorizontal: SPACING.lg, paddingVertical: 6, borderRadius: RADIUS.control - 2 },
    segmentLabel: { color: palette.mutedForeground, ...TYPE.label, fontWeight: "600" },

    legend: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md, marginTop: SPACING.md },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: 150 },
    legendSwatch: { width: 11, height: 11, borderRadius: 3 },
    legendRest: { backgroundColor: palette.surfaceMuted, alignItems: "center", justifyContent: "center" },
    legendDot: { width: 4, height: 4, borderRadius: 2 },
  });
}
