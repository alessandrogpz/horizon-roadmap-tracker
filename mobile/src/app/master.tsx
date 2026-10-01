// All tracks: every track at once, read-only.
//
// The seventh question a per-track app cannot answer — what am I doing, across
// all of it. The website puts this in the shape of its two-column dashboard;
// a phone has one column, so the same material runs down the page instead, in
// the order it would be read: the numbers, what today and this week ask of
// every track, their phases on one timeline, and then the lists.
//
// Everything here is read-only, and structurally rather than by a flag. The
// aggregation in `@shared/masterTrack` only ever reads, nothing on this screen
// takes a change handler, and there is no master track stored anywhere for an
// edit to land in. The way to change any of it is to open the track it belongs
// to, which is one tap away in the row at the top.

import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { orderedTracks } from "@shared/selectors";
import { formatDayMonthYear, parseYMD, todayYMD } from "@shared/dates";
import { getSettings, updateSettings } from "@shared/settings";
import {
  masterDeliverables,
  masterMaterials,
  masterPhases,
  masterProgress,
  masterRoadmaps,
  masterSources,
  masterStreak,
  masterWeek,
} from "@shared/masterTrack";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { Refreshable } from "../components/Refreshable";
import { Ring } from "../components/Ring";
import { RADIUS, SPACING, TYPE, withAlpha, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

/** How many days of a week fit before it has to scroll. Seven cards at a
 *  readable width is wider than any phone, so the week scrolls sideways — the
 *  same compromise the single-track week makes. */
const DAY_CARD = 132;

export default function MasterScreen() {
  const { workspace, today, switchTrack } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const tracks = useMemo(() => (workspace ? orderedTracks(workspace) : []), [workspace]);
  // Held in state as well as in settings so a tap repaints immediately: the
  // settings blob is read synchronously but nothing subscribes to it here.
  const [excluded, setExcluded] = useState<string[]>(() => getSettings().masterExcluded);
  const sources = useMemo(() => masterSources(tracks, excluded), [excluded, tracks]);

  const toggle = useCallback((trackId: string) => {
    setExcluded((current) => {
      const next = current.includes(trackId)
        ? current.filter((id) => id !== trackId)
        : [...current, trackId];
      updateSettings({ masterExcluded: next });
      return next;
    });
  }, []);

  const streak = useMemo(() => masterStreak(sources, today), [sources, today]);
  const progress = useMemo(() => masterProgress(sources), [sources]);
  const week = useMemo(() => masterWeek(sources, 0), [sources]);
  const phases = useMemo(() => masterPhases(sources).filter((p) => p.state !== "done"), [sources]);
  const deliverables = useMemo(() => masterDeliverables(sources), [sources]);
  const materials = useMemo(() => masterMaterials(sources), [sources]);
  const roadmaps = useMemo(() => masterRoadmaps(sources), [sources]);

  const open = useCallback(
    (trackId: string) => {
      switchTrack(trackId);
      router.navigate("/");
    },
    [switchTrack]
  );

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <Ionicons name="lock-closed-outline" size={13} color={palette.subtleForeground} />
        <Text style={styles.bannerText}>
          Read only. Everything here comes from your tracks — open one to change it.
        </Text>
      </View>

      {/* Which tracks are in the view. Switching one off leaves it out of this
          screen and does nothing else; said plainly below, because a switch
          beside a track's name in an app that can delete tracks deserves to be
          unambiguous. */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>In this view</Text>
        <View style={styles.chips}>
          {tracks.map((track) => {
            const on = !excluded.includes(track.meta.id);
            const colour = track.meta.color || palette.accent;
            return (
              <Pressable
                key={track.meta.id}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${track.meta.name}, ${on ? "shown" : "hidden"}`}
                onPress={() => toggle(track.meta.id)}
                style={[
                  styles.chip,
                  on
                    ? { borderColor: colour, backgroundColor: withAlpha(colour, 0.12) }
                    : { borderColor: palette.cardBorder },
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
        <Text style={styles.footnote}>
          Leaving a track out changes this screen only. The track itself is untouched.
        </Text>
      </View>

      {sources.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>Every track is switched off. Turn one back on above.</Text>
        </View>
      ) : (
        <>
          {/* The numbers */}
          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Streak</Text>
              <Text style={styles.tileValue}>{streak.current}</Text>
              <Text style={styles.muted}>day{streak.current === 1 ? "" : "s"} running</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Across all of it</Text>
              <View style={styles.tileRing}>
                <Ring pct={progress.timePct} size={34} stroke={4} tint={palette.accent} />
                <View style={styles.tileRingText}>
                  <Text style={styles.tileValue}>{progress.count}</Text>
                  <Text style={styles.muted}>
                    track{progress.count === 1 ? "" : "s"} · {progress.totalDays} days
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Active days</Text>
              <Text style={styles.tileValue}>{streak.activeDays}</Text>
              <Text style={styles.muted}>{streak.activeLast30} in the last 30</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Work done</Text>
              <Text style={styles.tileValue}>{Math.round(progress.workPct)}%</Text>
              <Text style={styles.muted}>
                {/* Weighted by how long each goal is: a ninety-day track at
                    half way and a three-year one at half way are not the same
                    amount of work. */}
                {progress.paceDelta >= 1
                  ? `${Math.round(progress.paceDelta)}% ahead`
                  : progress.paceDelta <= -1
                    ? `${Math.round(-progress.paceDelta)}% behind`
                    : "level with the plan"}
              </Text>
            </View>
          </View>

          {/* The week */}
          <Text style={styles.sectionTitle}>This week</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.weekRow}>
            {week.map((day) => {
              const isToday = day.date === todayYMD();
              return (
                <View
                  key={day.name}
                  style={[styles.dayCard, isToday && { borderColor: palette.accent }]}
                >
                  <Text style={[styles.dayName, isToday && { color: palette.foreground }]}>{day.name}</Text>
                  <Text style={styles.dayDate}>{day.date.slice(5)}</Text>
                  {day.entries.map((entry) => (
                    <View key={entry.track.id} style={styles.dayEntry}>
                      <View style={styles.dayEntryHead}>
                        <Text
                          style={[styles.dayFocus, { color: entry.track.color }]}
                          numberOfLines={2}
                        >
                          {entry.label}
                        </Text>
                        {entry.rest && (
                          <Ionicons name="moon-outline" size={10} color={palette.subtleForeground} />
                        )}
                      </View>
                      {entry.rotations.map((rotation) => (
                        <Text key={`${rotation.label}-${rotation.title}`} style={styles.dayItem} numberOfLines={2}>
                          {rotation.title}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              );
            })}
          </ScrollView>

          {/* The phases, chronologically */}
          <Text style={styles.sectionTitle}>What is running, and what is next</Text>
          {phases.length === 0 && <Text style={styles.muted}>No phases ahead on the selected tracks.</Text>}
          {phases.map((window) => (
            <Pressable
              key={`${window.track.id}-${window.phase.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${window.track.name}: ${window.phase.title}. Opens the track.`}
              onPress={() => open(window.track.id)}
              style={[styles.row, { borderLeftColor: window.track.color, borderLeftWidth: 3 }]}
            >
              <View style={styles.rowText}>
                <View style={styles.rowHead}>
                  <Chip name={window.track.name} colour={window.track.color} styles={styles} />
                  {window.state === "current" && <Text style={[styles.now, { color: palette.accent }]}>NOW</Text>}
                </View>
                <Text style={styles.rowTitle}>{window.phase.title}</Text>
                <Text style={styles.footnote}>
                  {formatDayMonthYear(window.startDate)}
                  {window.endDate ? ` → ${formatDayMonthYear(window.endDate)}` : " → no deadline"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={palette.subtleForeground} />
            </Pressable>
          ))}

          {/* The lists */}
          <Text style={styles.sectionTitle}>
            Deliverables{deliverables.length > 0 ? ` · ${deliverables.filter((d) => d.item.completed).length}/${deliverables.length}` : ""}
          </Text>
          {deliverables.length === 0 && <Text style={styles.muted}>Nothing to deliver on the selected tracks.</Text>}
          {deliverables.map(({ track, item }) => (
            <View key={`${track.id}-${item.id}`} style={styles.row}>
              <View
                style={[
                  styles.box,
                  item.completed
                    ? { backgroundColor: track.color, borderColor: track.color }
                    : { borderColor: palette.cardBorder },
                ]}
              />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, item.completed && styles.struck]} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
              <Chip name={track.name} colour={track.color} styles={styles} />
            </View>
          ))}

          <Text style={styles.sectionTitle}>
            Materials{materials.length > 0 ? ` · ${materials.length}` : ""}
          </Text>
          {materials.length === 0 && <Text style={styles.muted}>No materials on the selected tracks.</Text>}
          {materials.map(({ track, item }) => (
            <View key={`${track.id}-${item.id}`} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {Boolean(item.status) && <Text style={styles.footnote}>{item.status}</Text>}
              </View>
              <Chip name={track.name} colour={track.color} styles={styles} />
            </View>
          ))}

          {/* The roadmaps, as a way in rather than six documents end to end */}
          {roadmaps.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Roadmaps · {roadmaps.length}</Text>
              {roadmaps.map(({ track }) => (
                <Pressable
                  key={track.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${track.name}'s roadmap. Opens the track.`}
                  onPress={() => open(track.id)}
                  style={[styles.row, { borderLeftColor: track.color, borderLeftWidth: 3 }]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{track.name}</Text>
                    <Text style={styles.footnote}>Opens the track, where it can be read and edited</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={palette.subtleForeground} />
                </Pressable>
              ))}
            </>
          )}

          {/* The grid lives on Progress, which already draws every track at
              once — there is no second version of it to keep in step. */}
          <Pressable
            accessibilityRole="link"
            onPress={() => router.navigate("/progress")}
            style={styles.linkRow}
          >
            <Ionicons name="grid-outline" size={15} color={palette.accent} />
            <Text style={[styles.linkLabel, { color: palette.accent }]}>
              Every track&apos;s days, on Progress
            </Text>
          </Pressable>
        </>
      )}
    </Refreshable>
  );
}

/** Which track a row belongs to. On every row: an aggregate whose rows all
 *  look alike is a list you cannot read. */
function Chip({ name, colour, styles }: { name: string; colour: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={[styles.trackChip, { backgroundColor: withAlpha(colour, 0.16) }]}>
      <Text style={[styles.trackChipLabel, { color: colour }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xl },
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: RADIUS.control,
      backgroundColor: palette.surfaceMuted,
    },
    bannerText: { flex: 1, color: palette.mutedForeground, ...TYPE.caption, lineHeight: 17 },

    card: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    cardTitle: { color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
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
    chipLabel: { color: palette.foreground, ...TYPE.label, fontWeight: "600", maxWidth: 140 },

    tiles: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
    tile: {
      flexGrow: 1,
      flexBasis: "45%",
      gap: 2,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    tileLabel: { color: palette.mutedForeground, ...TYPE.eyebrow, fontWeight: "700", letterSpacing: 1 },
    tileValue: { color: palette.foreground, ...TYPE.title, fontWeight: "700" },
    tileRing: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    tileRingText: { flex: 1 },

    sectionTitle: { color: palette.foreground, ...TYPE.subhead, fontWeight: "700", marginTop: SPACING.sm },

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

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    rowHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    rowText: { flex: 1, gap: 2 },
    rowTitle: { color: palette.foreground, ...TYPE.body, fontWeight: "600" },
    struck: { color: palette.subtleForeground, textDecorationLine: "line-through" },
    now: { ...TYPE.micro, fontWeight: "800", letterSpacing: 1 },
    box: { width: 16, height: 16, borderRadius: 4, borderWidth: 1 },

    trackChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.control, maxWidth: 110 },
    trackChipLabel: { ...TYPE.micro, fontWeight: "700" },

    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.sm,
      marginTop: SPACING.sm,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
    linkLabel: { ...TYPE.body, fontWeight: "600" },

    muted: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
    footnote: { color: palette.subtleForeground, ...TYPE.micro, lineHeight: 15 },
  });
}
