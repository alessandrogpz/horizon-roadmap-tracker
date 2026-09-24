// Progress: the run of days, laid out down the screen rather than across it.
//
// The website draws the consistency grid as the familiar wide chart — weeks as
// columns, weekdays as rows — which works on a desk and not at all in a hand.
// At phone width it either shrinks to cells too small to hit or scrolls
// sideways, which is the one direction a phone is bad at.
//
// So the phone turns it ninety degrees: one row per week, running down the
// page the way everything else scrolls. Seven cells fit across 375 points at a
// size a thumb can actually land on, which is what makes each day tappable —
// and a day worth tapping, because it can then say what was done on it.

import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { StreakDay } from "@shared/stats";
import { streakCalendar, streakStats } from "@shared/stats";
import { completedItemTitle, currentStreakLength } from "@shared/streak";
import { formatDayMonthYear, parseYMD } from "@shared/dates";
import { getSettings } from "@shared/settings";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { Refreshable } from "../../components/Refreshable";
import { SubNav } from "../../components/SubNav";
import { RADIUS, SPACING, type Palette } from "../../theme";
import { usePalette } from "../../theme/ThemeProvider";

const WEEKDAYS_SUN = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS_MON = ["M", "T", "W", "T", "F", "S", "S"];

export default function ProgressScreen() {
  const { track, today } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const weekStartsOn = getSettings().weekStartsOn;
  const days = useMemo(
    () => (track ? streakCalendar(track, today, weekStartsOn) : []),
    [track, today, weekStartsOn]
  );
  const stats = useMemo(() => (track ? streakStats(track, today) : null), [track, today]);
  const streak = currentStreakLength(track?.streakHistory ?? [], today);

  /** The calendar arrives as a flat run of padded cells; a week is seven of
   *  them, which is what makes this a plain chunk rather than a date
   *  calculation. Newest first — the recent weeks are the ones anyone looks at. */
  const weeks = useMemo(() => {
    const out: StreakDay[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out.reverse();
  }, [days]);

  const titlesFor = useCallback(
    (date: string) => track?.completedItemsHistory?.[date] ?? [],
    [track]
  );

  if (!track) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>No track open.</Text>
      </View>
    );
  }

  const labels = weekStartsOn === "mon" ? WEEKDAYS_MON : WEEKDAYS_SUN;

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
      <SubNav links={[{ href: "/insights", label: "History" }, { href: "/timer", label: "Focus timer" }]} />

      {/* Three numbers across the top, not a paragraph. */}
      <View style={styles.stats}>
        <Stat value={streak} label="in a row" tint={palette.accent} styles={styles} />
        <Stat value={stats?.longest ?? 0} label="longest run" styles={styles} />
        <Stat value={stats?.activeLast30 ?? 0} label="of last 30" styles={styles} />
      </View>

      <View style={styles.weekdayRow}>
        {labels.map((label, index) => (
          <Text key={index} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, index) => (
        <View key={index} style={styles.week}>
          {week.map((day, cell) => {
            if (!day.date) return <View key={cell} style={[styles.cell, styles.blank]} />;
            const isToday = day.date === today;
            const open = openDay === day.date;
            return (
              <Pressable
                key={cell}
                accessibilityRole="button"
                accessibilityLabel={`${formatDayMonthYear(parseYMD(day.date))}, ${day.count} logged`}
                onPress={() => setOpenDay(open ? null : day.date)}
                style={[
                  styles.cell,
                  { backgroundColor: shade(day.count, palette) },
                  isToday && { borderWidth: 2, borderColor: palette.foreground },
                  open && { borderWidth: 2, borderColor: palette.accent },
                ]}
              >
                {day.count > 0 && <Text style={styles.cellCount}>{day.count}</Text>}
              </Pressable>
            );
          })}
        </View>
      ))}

      {weeks.length === 0 && <Text style={styles.muted}>Nothing recorded on this track yet.</Text>}

      {/* The detail sits under the grid rather than in a popup: a sheet over a
          grid hides the very thing you are reading across. */}
      {openDay && (
        <View style={styles.detail}>
          <View style={styles.detailHead}>
            <Ionicons name="calendar-outline" size={15} color={palette.accent} />
            <Text style={styles.detailTitle}>{formatDayMonthYear(parseYMD(openDay))}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setOpenDay(null)} hitSlop={8}>
              <Ionicons name="close" size={17} color={palette.subtleForeground} />
            </Pressable>
          </View>
          {titlesFor(openDay).length > 0 ? (
            titlesFor(openDay).map((item, index) => {
              // Older records stored a bare string here; `completedItemTitle`
              // is the shared core's answer to both shapes.
              const description = typeof item === "string" ? undefined : item.description;
              return (
                <View key={`${index}-${completedItemTitle(item)}`} style={styles.detailLine}>
                  <Ionicons name="checkmark-circle" size={14} color={palette.success} />
                  <View style={styles.detailTextWrap}>
                    <Text style={styles.detailText}>{completedItemTitle(item)}</Text>
                    {description ? <Text style={styles.detailSub}>{description}</Text> : null}
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.muted}>Nothing logged on this day.</Text>
          )}
        </View>
      )}

      <View style={styles.legend}>
        <Text style={styles.legendLabel}>Less</Text>
        {[0, 1, 2, 3, 4].map((count) => (
          <View key={count} style={[styles.legendCell, { backgroundColor: shade(count, palette) }]} />
        ))}
        <Text style={styles.legendLabel}>More</Text>
      </View>

      <Text style={styles.footnote}>
        A day counts when something was logged against it — a task ticked, a material finished. The same
        rule the website uses, because it is the same code. Tap any day to see what.
      </Text>
    </Refreshable>
  );
}

function Stat({
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
    <View style={styles.stat}>
      <Text style={[styles.statValue, tint ? { color: tint } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Four steps of green, so a busy day reads as darker rather than needing its
 *  number read. */
function shade(count: number, palette: Palette): string {
  if (count <= 0) return palette.surfaceMuted;
  if (count === 1) return "#14532d";
  if (count === 2) return "#166534";
  if (count === 3) return "#16a34a";
  return "#22c55e";
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.xs, paddingBottom: SPACING.xl },
    centered: { alignItems: "center", justifyContent: "center" },
    stats: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md },
    stat: {
      flex: 1,
      alignItems: "center",
      gap: 2,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    statValue: { color: palette.foreground, fontSize: 24, fontWeight: "700" },
    statLabel: { color: palette.mutedForeground, fontSize: 11 },
    weekdayRow: { flexDirection: "row", gap: 4, marginBottom: 2 },
    weekdayLabel: { flex: 1, textAlign: "center", color: palette.subtleForeground, fontSize: 10, fontWeight: "700" },
    week: { flexDirection: "row", gap: 4, marginBottom: 4 },
    cell: { flex: 1, aspectRatio: 1, borderRadius: 6, alignItems: "center", justifyContent: "center" },
    blank: { opacity: 0 },
    cellCount: { color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "700" },
    detail: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      marginTop: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.card,
    },
    detailHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    detailTitle: { flex: 1, color: palette.foreground, fontSize: 14, fontWeight: "700" },
    detailLine: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
    detailTextWrap: { flex: 1, gap: 1 },
    detailText: { color: palette.foreground, fontSize: 13, lineHeight: 18 },
    detailSub: { color: palette.subtleForeground, fontSize: 11, lineHeight: 16 },
    legend: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: SPACING.lg },
    legendCell: { width: 13, height: 13, borderRadius: 3 },
    legendLabel: { color: palette.subtleForeground, fontSize: 11, marginHorizontal: SPACING.xs },
    muted: { color: palette.mutedForeground, fontSize: 13, lineHeight: 18 },
    footnote: { color: palette.subtleForeground, fontSize: 11, lineHeight: 16, marginTop: SPACING.sm },
  });
}
