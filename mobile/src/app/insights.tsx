// History: what the database can say about a year of ticking boxes that the
// phone could not work out for itself in any reasonable time.
//
// Every number here is computed by aggregation pipelines on the server — active
// days, weekday habits, months, per-track totals and longest streaks — because
// they read every day document the account owns. Sending all of that to a phone
// to count it locally would be the wrong shape twice over: slow, and duplicating
// work a database is built for.
//
// The bars are plain Views. A charting library for four bar charts would be a
// megabyte of dependency for something flexbox already does.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Stats } from "@shared/apiTypes";
import { authorized } from "../auth/session";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { Refreshable } from "../components/Refreshable";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function InsightsScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [stats, setStats] = useState<Stats | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signed-out" | "offline" | "failed">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await authorized("/api/stats");
      if (response.status === 401) return setState("signed-out");
      if (!response.ok) return setState("failed");
      setStats((await response.json()) as Stats);
      setState("ready");
    } catch {
      setState("offline");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (state !== "ready" || !stats) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>
          {state === "signed-out"
            ? "History is computed by the server, so it needs you signed in."
            : state === "offline"
              ? "No connection. Everything on this phone still works."
              : "That didn't work. Try again in a moment."}
        </Text>
      </View>
    );
  }

  const months = stats.byMonth.slice(-12);
  const monthPeak = Math.max(1, ...months.map((m) => m.activeDays));

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.totals}>
        <Total label="active days" value={stats.totals.activeDays} styles={styles} />
        <Total label="things done" value={stats.totals.accomplishments} styles={styles} />
        <Total label="boxes ticked" value={stats.totals.ticks} styles={styles} />
      </View>
      {stats.totals.firstDay && (
        <Text style={styles.muted}>
          From {stats.totals.firstDay} to {stats.totals.lastDay}.
        </Text>
      )}

      <Text style={styles.sectionTitle}>Which days you show up</Text>
      <View style={styles.card}>
        {stats.byWeekday.map((day) => (
          <View key={day.weekday} style={styles.barRow}>
            <Text style={styles.barLabel}>{WEEKDAYS[day.weekday - 1] ?? day.weekday}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.round(day.rate * 100)}%` }]} />
            </View>
            <Text style={styles.barValue}>{Math.round(day.rate * 100)}%</Text>
          </View>
        ))}
        <Text style={styles.footnote}>
          The share of each weekday, since your first recorded day, that had something logged.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>The last year, by month</Text>
      <View style={styles.card}>
        {months.map((month) => (
          <View key={month.month} style={styles.barRow}>
            <Text style={styles.barLabel}>{month.month}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${(month.activeDays / monthPeak) * 100}%` }]} />
            </View>
            <Text style={styles.barValue}>{month.activeDays}</Text>
          </View>
        ))}
        {months.length === 0 && <Text style={styles.muted}>Nothing recorded yet.</Text>}
      </View>

      <Text style={styles.sectionTitle}>By track</Text>
      {stats.byTrack.map((track) => (
        <View key={track.trackId} style={styles.card}>
          <Text style={styles.trackName}>
            {track.name}
            {track.archived ? " · archived" : ""}
          </Text>
          <Text style={styles.muted}>
            {track.activeDays} active day{track.activeDays === 1 ? "" : "s"} · {track.accomplishments} things done ·{" "}
            {track.ticks} ticks
          </Text>
          {track.longestStreak && (
            <Text style={styles.muted}>
              Longest run: {track.longestStreak.length} days, {track.longestStreak.from} to {track.longestStreak.to}
            </Text>
          )}
        </View>
      ))}
    </Refreshable>
  );
}

function Total({ label, value, styles }: { label: string; value: number; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.total}>
      <Text style={styles.totalValue}>{value.toLocaleString()}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md },
    centered: { alignItems: "center", justifyContent: "center", padding: SPACING.xl },
    totals: { flexDirection: "row", gap: SPACING.sm },
    total: {
      flex: 1,
      gap: 2,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    totalValue: { color: palette.accent, ...TYPE.figure, fontWeight: "700" },
    sectionTitle: {
      color: palette.subtleForeground,
      ...TYPE.eyebrow,
      fontWeight: "700",
      letterSpacing: 1.2,
      marginTop: SPACING.sm,
    },
    card: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    barRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    barLabel: { color: palette.mutedForeground, ...TYPE.caption, width: 58 },
    barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: palette.surfaceMuted, overflow: "hidden" },
    barFill: { height: 8, borderRadius: 4, backgroundColor: palette.accent },
    barValue: { color: palette.mutedForeground, ...TYPE.caption, width: 40, textAlign: "right" },
    trackName: { color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
    muted: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
    footnote: { color: palette.subtleForeground, ...TYPE.micro, lineHeight: 16 },
  });
}
