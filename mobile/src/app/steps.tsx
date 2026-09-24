// What the step counter has recorded, beyond today's number.
//
// The panel says how many steps today; this says whether that is a lot. A bare
// number has no shape — 4,000 means nothing without knowing that last week
// averaged 9,000 — so this is the week, the month and the year, and the last
// fortnight day by day.
//
// Two sources, and the screen prefers the better one. Health Connect holds
// whole days, written by whatever is actually counting — the phone's health
// app, a watch, a band — so when it is available and permitted, these are real
// totals. When it is not, the numbers fall back to Horizon's own table, which
// only holds what was counted while the app was open. The difference is large
// enough that the screen says which it is showing rather than letting a total
// imply more than it is.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { parseYMD } from "@shared/dates";
import { loadStepCount } from "../storage/db";
import { dailySteps, describeHealth, healthStatus, requestHealthPermission, type HealthStatus } from "../steps/healthConnect";
import { Refreshable } from "../components/Refreshable";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

const DAYS_BACK = 365;
const RECENT = 14;

export default function StepsScreen() {
  const { today } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [counts, setCounts] = useState<{ date: string; count: number }[] | null>(null);
  const [health, setHealth] = useState<HealthStatus>("unsupported");

  const load = useCallback(async () => {
    // A year is 365 tiny primary-key lookups, which SQLite does without
    // noticing. Reading the table wholesale would be fewer queries and would
    // also drag in every day the app has ever run for.
    const dates: string[] = [];
    const cursor = parseYMD(today);
    for (let i = 0; i < DAYS_BACK; i += 1) {
      dates.push(formatYMD(cursor));
      cursor.setDate(cursor.getDate() - 1);
    }
    const status = await healthStatus();
    setHealth(status);

    // Health Connect first, and in one call for the whole year rather than a
    // query per day.
    const fromHealth =
      status === "ready" ? await dailySteps(dates[dates.length - 1], dates[0]) : {};

    const rows = await Promise.all(
      dates.map(async (date) => ({
        date,
        // Whichever source knows more about the day. Health Connect covers the
        // whole of it; the local table covers the part spent in the app, so on
        // a day Health Connect has nothing for, the local figure is still the
        // best available answer rather than a zero.
        count: Math.max(fromHealth[date] ?? 0, await loadStepCount(date)),
      }))
    );
    setCounts(rows);
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!counts) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  const sum = (days: number) => counts.slice(0, days).reduce((total, row) => total + row.count, 0);
  const active = counts.filter((row) => row.count > 0);
  const week = sum(7);
  const month = sum(30);
  const year = sum(DAYS_BACK);
  const recent = counts.slice(0, RECENT).reverse();
  const peak = Math.max(1, ...recent.map((row) => row.count));

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.totals}>
        <Total value={counts[0]?.count ?? 0} label="today" tint={palette.accent} styles={styles} />
        <Total value={week} label="this week" styles={styles} />
      </View>
      <View style={styles.totals}>
        <Total value={month} label="30 days" styles={styles} />
        <Total value={year} label="this year" styles={styles} />
      </View>

      <Text style={styles.sectionTitle}>The last fortnight</Text>
      <View style={styles.card}>
        {recent.map((row) => (
          <View key={row.date} style={styles.barRow}>
            <Text style={styles.barLabel}>{row.date.slice(5)}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${(row.count / peak) * 100}%` }]} />
            </View>
            <Text style={styles.barValue}>{row.count.toLocaleString()}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Typical</Text>
      <View style={styles.card}>
        <Text style={styles.muted}>
          {active.length > 0
            ? `${Math.round(active.reduce((t, r) => t + r.count, 0) / active.length).toLocaleString()} steps on an average day with any recorded, across ${active.length} day${active.length === 1 ? "" : "s"}.`
            : "Nothing recorded yet."}
        </Text>
        {active.length > 0 && (
          <Text style={styles.muted}>
            Best day: {Math.max(...active.map((r) => r.count)).toLocaleString()} steps.
          </Text>
        )}
      </View>

      {health === "needs-permission" ? (
        <Pressable
          accessibilityRole="button"
          style={styles.permission}
          onPress={() => void requestHealthPermission().then(setHealth).then(load)}
        >
          <Text style={styles.permissionLabel}>Use Health Connect</Text>
          <Text style={styles.muted}>
            Whole-day totals, including steps taken with Horizon closed and any counted by a watch.
            Horizon only ever reads steps, and the decision is made in Android&apos;s own dialog.
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.footnote}>{describeHealth(health)}</Text>
    </Refreshable>
  );
}

function Total({
  value,
  label,
  tint,
  styles,
}: {
  value: number;
  label: string;
  tint?: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.total}>
      <Text style={[styles.totalValue, tint ? { color: tint } : null]}>{value.toLocaleString()}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

/** Local-time `YYYY-MM-DD`, matching the keys the steps table is written with.
 *  `toISOString` would be UTC, which is a day out for half the world. */
function formatYMD(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.xl },
    centered: { alignItems: "center", justifyContent: "center" },
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
    totalValue: { color: palette.foreground, fontSize: 22, fontWeight: "700" },
    sectionTitle: {
      color: palette.subtleForeground,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginTop: SPACING.md,
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
    barLabel: { color: palette.mutedForeground, fontSize: 11, width: 42 },
    barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: palette.surfaceMuted, overflow: "hidden" },
    barFill: { height: 8, borderRadius: 4, backgroundColor: palette.success },
    barValue: { color: palette.mutedForeground, fontSize: 11, width: 52, textAlign: "right" },
    muted: { color: palette.mutedForeground, fontSize: 13, lineHeight: 18 },
    footnote: { color: palette.subtleForeground, fontSize: 11, lineHeight: 16, marginTop: SPACING.md },
    permission: {
      gap: SPACING.xs,
      padding: SPACING.lg,
      marginTop: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.card,
    },
    permissionLabel: { color: palette.foreground, fontSize: 15, fontWeight: "600" },
  });
}
