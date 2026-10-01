// Today, across every track: what each one is asking of this day.
//
// The single-track version is a checklist. This one cannot be — ticking here
// would be editing, and there is nothing to tick into. So it answers the
// question a checklist answers *before* you start ticking: what is today for,
// on each of them, and what has each already had.

import { useCallback, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { completedItemTitle } from "@shared/streak";
import { masterWeek } from "@shared/masterTrack";
import { formatDayMonthYear, parseYMD } from "@shared/dates";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { Refreshable } from "../components/Refreshable";
import { usePalette } from "../theme/ThemeProvider";
import { NothingSelected, ReadOnlyBand, TrackChip, TrackPicker } from "./MasterChrome";
import { makeMasterStyles } from "./styles";
import { useMasterSources } from "./useMasterSources";

export function MasterToday() {
  const palette = usePalette();
  const styles = useMemo(() => makeMasterStyles(palette), [palette]);
  const { tracks, sources, today } = useMasterSources();
  const { switchTrack } = useWorkspace();

  const open = useCallback(
    (trackId: string) => {
      switchTrack(trackId);
      router.navigate("/");
    },
    [switchTrack]
  );

  /** Today's entry from the week, which already knows what each track calls
   *  this day and which of its rotations land on it. */
  const entries = useMemo(() => {
    const day = masterWeek(sources, 0).find((entry) => entry.date === today);
    return day?.entries ?? [];
  }, [sources, today]);

  /** And what each has actually put down today. */
  const done = useMemo(
    () =>
      sources.map((track) => ({
        meta: track.meta,
        items: (track.completedItemsHistory?.[today] ?? []).map(completedItemTitle),
      })),
    [sources, today]
  );

  const total = done.reduce((sum, entry) => sum + entry.items.length, 0);

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
      <ReadOnlyBand>
        Read only — nothing here ticks. Open a track to work on it.
      </ReadOnlyBand>
      <TrackPicker tracks={tracks} />

      {sources.length === 0 ? (
        <NothingSelected />
      ) : (
        <>
          <Text style={styles.sectionTitle}>{formatDayMonthYear(parseYMD(today))}</Text>

          <Text style={styles.footnote}>What each track is asking of today.</Text>
          {entries.map((entry) => (
            <Pressable
              key={entry.track.id}
              accessibilityRole="button"
              accessibilityLabel={`${entry.track.name}, ${entry.label}. Opens the track.`}
              onPress={() => open(entry.track.id)}
              style={[styles.row, { borderLeftColor: entry.track.color, borderLeftWidth: 3 }]}
            >
              <View style={styles.rowText}>
                <View style={styles.rowHead}>
                  <TrackChip name={entry.track.name} colour={entry.track.color} />
                  {entry.rest && (
                    <Ionicons name="moon-outline" size={12} color={palette.subtleForeground} />
                  )}
                </View>
                <Text style={styles.rowTitle}>{entry.label}</Text>
                {entry.rotations.map((rotation) => (
                  <Text key={`${rotation.label}-${rotation.title}`} style={styles.footnote}>
                    {rotation.label}: {rotation.title}
                  </Text>
                ))}
              </View>
              <Ionicons name="chevron-forward" size={15} color={palette.subtleForeground} />
            </Pressable>
          ))}

          <Text style={styles.sectionTitle}>Already logged{total > 0 ? ` · ${total}` : ""}</Text>
          {total === 0 && <Text style={styles.muted}>Nothing recorded on any track yet today.</Text>}
          {done.flatMap((entry) =>
            entry.items.map((title, index) => (
              <View key={`${entry.meta.id}-${index}`} style={styles.row}>
                <View
                  style={[styles.box, { backgroundColor: entry.meta.color, borderColor: entry.meta.color }]}
                />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {title}
                  </Text>
                </View>
                <TrackChip name={entry.meta.name} colour={entry.meta.color} />
              </View>
            ))
          )}
        </>
      )}
    </Refreshable>
  );
}
