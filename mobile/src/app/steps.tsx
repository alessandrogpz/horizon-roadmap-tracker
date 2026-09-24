// What the step counter has recorded, beyond today's number.
//
// The panel says how many steps today; this says whether that is a lot. A bare
// number has no shape — 4,000 means nothing without knowing that last week
// averaged 9,000 — so this is the week, the month and the year, and the last
// fortnight day by day.
//
// Everything here is read back from the device's own `steps` table, which is
// written as the sensor reports. That is also its limit, and the screen says
// so rather than letting the totals imply more than they are: steps are only
// counted while Horizon is open, so these are "steps while using the app",
// not "steps taken". Making them the latter needs a reading the sensor keeps
// but Expo does not expose, and therefore a new build.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { parseYMD } from "@shared/dates";
import { loadStepCount } from "../storage/db";
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
    const rows = await Promise.all(
      dates.map(async (date) => ({ date, count: await loadStepCount(date) }))
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

      <Text style={styles.footnote}>
        Counted only while Horizon is open, so these are steps while using the app rather than steps
        taken. Counting a whole day needs a reading the Android sensor keeps but Expo does not hand
        out — which means a new build, not an update.
      </Text>
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
  });
}
