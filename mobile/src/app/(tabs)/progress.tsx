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

const CELL = 26;
const CELL_GAP = 4;
/** Width of the left column that holds a month name when one starts. */
const GUTTER = 30;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const WEEKDAYS_SUN = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS_MON = ["M", "T", "W", "T", "F", "S", "S"];

export default function ProgressScreen() {
  const { track, today } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [openDay, setOpenDay] = useState<string | null>(null);
  // By month is the default: a calendar year as one unbroken ribbon of weeks
  // is hard to read a month out of, because nothing marks where one ends. The
  // continuous shape is still worth having for seeing a long run at a glance,
  // so it is a toggle rather than a replacement.
  const [byMonth, setByMonth] = useState(true);

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
    const rows: { days: StreakDay[]; month: number; label: string | null }[] = [];
    let previous = -1;

    for (let i = 0; i < days.length; i += 7) {
      const slice = days.slice(i, i + 7);
      // A week belongs to the month of its first real day. Weeks straddle
      // month ends, so something has to decide, and "where the week started"
      // keeps each month's band contiguous.
      const anchor = slice.find((day) => day.date);
      const date = anchor ? parseYMD(anchor.date) : null;
      const month = date ? date.getFullYear() * 12 + date.getMonth() : previous;
      previous = month;
      rows.push({ days: slice, month, label: null });
    }

    // Newest first, because the recent weeks are the ones anyone looks at —
    // and the labels are worked out *after* reversing, so each month's name
    // sits at the top of its band where the eye meets it on the way down.
    // Labelling before reversing put every name at the bottom of its own
    // block, reading as though it belonged to the month above.
    rows.reverse();
    let seen = -1;
    for (const row of rows) {
      if (row.month !== seen) {
        const anchor = row.days.find((day) => day.date);
        if (anchor) row.label = MONTHS[parseYMD(anchor.date).getMonth()];
        seen = row.month;
      }
    }
    return rows;
  }, [days]);

  /** Each calendar month as its own block: leading blanks so the 1st lands
   *  under the right weekday, then one cell per day. Months are separated, and
   *  every block lines up with the same seven columns at the top of the screen
   *  — which is the point of grouping them at all. */
  const months = useMemo(() => {
    if (!track?.startDate) return [];
    const counts: Record<string, number> = {};
    Object.entries(track.completedItemsHistory ?? {}).forEach(([date, items]) => {
      counts[date] = items?.length ?? 0;
    });

    const first = parseYMD(track.startDate);
    const last = parseYMD(today);
    const blocks: { key: string; label: string; cells: (StreakDay | null)[] }[] = [];

    const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
    while (cursor <= last) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const firstWeekday = new Date(year, month, 1).getDay();
      const offset = weekStartsOn === "mon" ? (firstWeekday + 6) % 7 : firstWeekday;
      const cells: (StreakDay | null)[] = Array.from({ length: offset }, () => null);

      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        // Days outside the track's own life are left blank rather than drawn
        // as zeroes: the track did not exist to be missed.
        const inRange = date >= track.startDate && date <= today;
        cells.push(inRange ? { date, count: counts[date] ?? 0 } : null);
      }

      blocks.push({ key: `${year}-${month}`, label: `${MONTHS[month]} ${year}`, cells });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return blocks.reverse();
  }, [today, track, weekStartsOn]);

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
      {/* Three numbers across the top, not a paragraph. */}
      <View style={styles.stats}>
        <Stat value={streak} label="in a row" tint={palette.accent} styles={styles} />
        <Stat value={stats?.longest ?? 0} label="longest run" styles={styles} />
        <Stat value={stats?.activeLast30 ?? 0} label="of last 30" styles={styles} />
      </View>

      <View style={styles.toggle}>
        {([
          ["months", "By month"],
          ["continuous", "Continuous"],
        ] as const).map(([value, label]) => {
          const on = (value === "months") === byMonth;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setByMonth(value === "months")}
              style={[styles.toggleButton, on && { borderColor: palette.accent }]}
            >
              <Text style={[styles.toggleLabel, on && { color: palette.foreground }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* The weekday header belongs to the screen, not to each block: every
          month lines up with the same seven columns, which is what keeps a
          Tuesday under "T" wherever it falls. */}
      <View style={styles.weekdayRow}>
        <View style={styles.gutter} />
        {labels.map((label, index) => (
          <Text key={index} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      {byMonth
        ? months.map((month) => (
            <View key={month.key} style={styles.month}>
              <Text style={styles.monthLabel}>{month.label}</Text>
              <View style={styles.monthGrid}>
                {month.cells.map((day, index) =>
                  day ? (
                    <Cell
                      key={index}
                      day={day}
                      today={today}
                      open={openDay === day.date}
                      onPress={() => setOpenDay(openDay === day.date ? null : day.date)}
                      styles={styles}
                      palette={palette}
                    />
                  ) : (
                    <View key={index} style={[styles.cell, styles.blank]} />
                  )
                )}
              </View>
            </View>
          ))
        : weeks.map((week, index) => (
            <View
              key={index}
              style={[styles.week, week.month % 2 === 0 && { backgroundColor: palette.surfaceMuted }]}
            >
              <Text style={styles.gutterLabel}>{week.label ?? ""}</Text>
              {week.days.map((day, cell) =>
                day.date ? (
                  <Cell
                    key={cell}
                    day={day}
                    today={today}
                    open={openDay === day.date}
                    onPress={() => setOpenDay(openDay === day.date ? null : day.date)}
                    styles={styles}
                    palette={palette}
                  />
                ) : (
                  <View key={cell} style={[styles.cell, styles.blank]} />
                )
              )}
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
      <View style={styles.moreRow}>
        <Text style={styles.moreTitle}>More on this track</Text>
      </View>
      <SubNav links={[{ href: "/insights", label: "History" }]} />

    </Refreshable>
  );
}

/** One day. Shared by both shapes so a square means the same thing, and is
 *  the same size, whichever way the grid is arranged. */
function Cell({
  day,
  today,
  open,
  onPress,
  styles,
  palette,
}: {
  day: StreakDay;
  today: string;
  open: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatDayMonthYear(parseYMD(day.date))}, ${day.count} logged`}
      onPress={onPress}
      style={[
        styles.cell,
        { backgroundColor: shade(day.count, palette) },
        day.date === today && { borderWidth: 2, borderColor: palette.foreground },
        open && { borderWidth: 2, borderColor: palette.accent },
      ]}
    />
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
    // Fixed rather than stretched to the width. Stretching gave cells big
    // enough to hold a number and left only a handful of weeks on screen,
    // which is the opposite of what a consistency grid is for: the point is
    // seeing months of it at once.
    weekdayRow: {
      flexDirection: "row",
      gap: CELL_GAP,
      alignItems: "center",
      marginBottom: 2,
      alignSelf: "flex-start",
      width: GUTTER + 7 * CELL + 7 * CELL_GAP,
    },
    weekdayLabel: {
      width: CELL,
      textAlign: "center",
      color: palette.subtleForeground,
      fontSize: 9,
      fontWeight: "700",
    },
    gutter: { width: GUTTER },
    toggle: { flexDirection: "row", gap: SPACING.xs, marginBottom: SPACING.sm },
    toggleButton: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    toggleLabel: { color: palette.mutedForeground, fontSize: 12, fontWeight: "600" },
    month: { marginBottom: SPACING.lg },
    monthLabel: {
      color: palette.mutedForeground,
      fontSize: 12,
      fontWeight: "700",
      marginBottom: SPACING.xs,
      marginLeft: GUTTER + CELL_GAP,
    },
    monthGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: CELL_GAP,
      marginLeft: GUTTER + CELL_GAP,
      alignSelf: "flex-start",
      width: 7 * CELL + 7 * CELL_GAP,
    },
    gutterLabel: {
      width: GUTTER,
      color: palette.subtleForeground,
      fontSize: 9,
      fontWeight: "700",
    },
    week: {
      flexDirection: "row",
      gap: CELL_GAP,
      alignItems: "center",
      paddingVertical: 2,
      borderRadius: 4,
      // Only as wide as the grid it sits behind. Left to stretch, the month
      // band ran the full width of the screen while the cells stopped a third
      // of the way across, so the shading looked like it belonged to nothing.
      alignSelf: "flex-start",
      width: GUTTER + 7 * CELL + 7 * CELL_GAP,
    },
    cell: { width: CELL, height: CELL, borderRadius: 4 },
    blank: { opacity: 0 },
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
    legendCell: { width: 12, height: 12, borderRadius: 3 },
    legendLabel: { color: palette.subtleForeground, fontSize: 11, marginHorizontal: SPACING.xs },
    muted: { color: palette.mutedForeground, fontSize: 13, lineHeight: 18 },
    moreRow: { marginTop: SPACING.xl },
    moreTitle: {
      color: palette.subtleForeground,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    footnote: { color: palette.subtleForeground, fontSize: 11, lineHeight: 16, marginTop: SPACING.sm },
  });
}
