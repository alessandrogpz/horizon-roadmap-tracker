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

import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Link } from "expo-router";
import type { StreakDay } from "@shared/stats";
import type { CompletedItem } from "@shared/types";
import { streakStats } from "@shared/stats";
import { completedItemTitle, currentStreakLength } from "@shared/streak";
import { formatDateYMD, formatDayMonthYear, parseYMD } from "@shared/dates";
import { getSettings } from "@shared/settings";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { Refreshable } from "../../components/Refreshable";
import { Segmented } from "../../components/Segmented";
import { StatTile } from "../../components/StatTile";
import { RADIUS, SPACING, TYPE, type Palette } from "../../theme";
import { usePalette } from "../../theme/ThemeProvider";

const CELL = 26;
const CELL_GAP = 4;
/** Width of the left column that holds a month name when one starts. */
const GUTTER = 30;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** The two ways of laying the same days out. */
const SHAPES = [
  { value: "months", label: "By month" },
  { value: "continuous", label: "Continuous" },
] as const;

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
  const [year, setYear] = useState(() => parseYMD(today).getFullYear());
  const gridRef = useRef<ScrollView>(null);
  /** Which year-and-shape the graph has already been dropped at the end of. */
  const landedOn = useRef<string | null>(null);

  /** The years worth offering: from whenever this track first has anything to
   *  show, to the one we are in. A track cannot have a 2019 and the arrows
   *  should not pretend otherwise. */
  const years = useMemo(() => {
    const now = parseYMD(today).getFullYear();
    const dates = Object.keys(track?.completedItemsHistory ?? {});
    if (track?.startDate) dates.push(track.startDate);
    const earliest = dates.reduce((low, date) => Math.min(low, Number(date.slice(0, 4))), now);
    return { first: earliest, last: now };
  }, [today, track]);

  /** A whole calendar year of cells, always — Jan 1 to Dec 31, padded out to
   *  whole weeks at both ends. The grid used to run from the track's start to
   *  today, so it grew as the track did and there was no fixed thing to
   *  navigate; a year is a shape you can hold in your head and step through.
   *
   *  Days outside the track's own life are left blank rather than drawn as
   *  zeroes, which is the same rule as before: the track did not exist to be
   *  missed, and neither does tomorrow. */
  const days = useMemo(() => {
    if (!track?.startDate) return [];
    const counts: Record<string, number> = {};
    Object.entries(track.completedItemsHistory ?? {}).forEach(([date, items]) => {
      counts[date] = items?.length ?? 0;
    });

    const cursor = new Date(year, 0, 1);
    const offset = weekStartsOn === "mon" ? (cursor.getDay() + 6) % 7 : cursor.getDay();
    cursor.setDate(cursor.getDate() - offset);
    // The year, but never past today. Reading newest-first, an uncapped year
    // opens the current one on three months of blank December and makes you
    // scroll down to reach the month you are in.
    const lastDay = new Date(year, 11, 31);
    const now = parseYMD(today);
    const end = lastDay < now ? lastDay : now;

    const out: StreakDay[] = [];
    while (cursor <= end) {
      const date = formatDateYMD(cursor);
      const lived = date >= track.startDate && date <= today;
      out.push({ date: lived ? date : "", count: lived ? counts[date] ?? 0 : 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    while (out.length % 7 !== 0) out.push({ date: "", count: 0 });
    return out;
  }, [today, track, weekStartsOn, year]);
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

    // Oldest at the top, so that going down the screen is going forward in
    // time — the same direction the days already run inside a row. Reversed,
    // the two disagreed: a row read left to right into the future while the
    // row under it jumped a week into the past, so the day after the last one
    // in a band was nowhere near it. The graph opens at the bottom instead,
    // which is where the recent end now lives.
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

    const blocks: { key: string; label: string; cells: (StreakDay | null)[] }[] = [];

    const cursor = new Date(year, 0, 1);
    const now = parseYMD(today);
    // Same rule as the continuous shape: months that have not happened yet are
    // not months of this track's year.
    const stop = year === now.getFullYear() ? now.getMonth() : 11;
    while (cursor.getFullYear() === year && cursor.getMonth() <= stop) {
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
    // Chronological, for the same reason the weeks are: the days inside a
    // month already run downward, so the months have to as well or the last
    // day of one block is followed by the first day of an *earlier* one.
    return blocks;
  }, [today, track, weekStartsOn, year]);

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
  const shapeKey = `${byMonth ? "months" : "continuous"}-${year}`;

  return (
    // The page itself does not scroll. Everything written — the three numbers,
    // the shape, the year, the key, the note — stays put, and the graph is the
    // only thing that moves. Scrolling the whole page meant the numbers you
    // were comparing a month against slid off the top the moment you went
    // looking for the month.
    <View style={styles.screen}>
      {/* Three numbers across the top, not a paragraph. */}
      {/* The run you are on, given the room it deserves — it is the number
          this screen exists to move — with the two that put it in context
          beside it. */}
      {/* Three to a row, stacked: the run you are on, the best one so far,
          and how much of the last month had anything in it. */}
      <View style={styles.stats}>
        <StatTile
          compact
          label="Streak"
          value={streak}
          unit={streak === 1 ? "day" : "days"}
          icon="flame"
          tint="#f59e0b"
        />
        <StatTile
          compact
          label="Longest"
          value={stats?.longest ?? 0}
          unit={stats?.longest === 1 ? "day" : "days"}
          icon="trophy-outline"
        />
        <StatTile
          compact
          label="Last 30"
          value={stats?.activeLast30 ?? 0}
          unit="active"
          icon="calendar-outline"
        />
      </View>

      <View style={styles.toggle}>
        <Segmented
          options={SHAPES}
          value={byMonth ? "months" : "continuous"}
          onChange={(shape) => setByMonth(shape === "months")}
        />
      </View>

      <View style={styles.yearRow}>
        <YearStep
          direction={-1}
          disabled={year <= years.first}
          onPress={() => setYear(year - 1)}
          styles={styles}
          palette={palette}
        />
        <Text style={styles.year}>{year}</Text>
        <YearStep
          direction={1}
          disabled={year >= years.last}
          onPress={() => setYear(year + 1)}
          styles={styles}
          palette={palette}
        />
      </View>

      {/* The weekday header belongs to the screen, not to each block: every
          month lines up with the same seven columns, which is what keeps a
          Tuesday under "T" wherever it falls. And it stays out of the scroller,
          so the column a cell is under is readable wherever the graph has been
          scrolled to. */}
      {openDay && (
        // Any tap that is not on the popover closes it. It covers the grid
        // rather than the screen so the tab bar and the header keep working —
        // dismissing a detail card should not trap the rest of the app.
        <Pressable
          accessibilityLabel="Close the day"
          onPress={() => setOpenDay(null)}
          style={styles.backdrop}
        />
      )}

      {/* One centred column holding the weekday header and the grid under it,
          rather than each part finding its own left edge. The grid is a fixed
          width — cells stretched to fill a phone are big enough to hold a
          number and leave a handful of weeks on screen, which is the opposite
          of what a consistency grid is for — and a fixed width left to sit at
          `flex-start` is a grid pushed into the left third of the screen with
          nothing beside it. */}
      <View style={[styles.chart, styles.weekdayHead]}>
        <View style={styles.weekdayRow}>
          {labels.map((label, index) => (
            <Text key={index} style={styles.weekdayLabel} allowFontScaling={false}>
              {label}
            </Text>
          ))}
        </View>
      </View>

      {/* The graph, and the only thing on this screen that scrolls. Pulling it
          down past the top still syncs, the same as every other screen. */}
      {/* Keyed, so changing the year or the shape starts at the top of it.
          Without this the scroll position carries over and a year opens
          part-way down, at whatever offset the last one happened to be left
          at — which for a different year means nowhere in particular. */}
      <Refreshable
        key={shapeKey}
        scrollRef={gridRef}
        // Jumped, not animated, and only once per year or shape: this is where
        // the graph *starts*, not somewhere it travels to while you watch.
        onContentSizeChange={() => {
          if (landedOn.current === shapeKey) return;
          landedOn.current = shapeKey;
          gridRef.current?.scrollToEnd({ animated: false });
        }}
        style={styles.grid}
        contentContainerStyle={styles.gridContent}
      >
        <View style={styles.chart}>
        {/* Keyed by shape and year, so changing either is a change you watch
            rather than one you find has happened. Only this one view animates:
            the grid below it is several hundred cells, and fading each of them
            would cost far more than the effect is worth. */}
        <Animated.View key={shapeKey} entering={FadeIn.duration(240)}>
      {byMonth
        ? months.map((month) => (
            // Raised above its neighbours only while it holds the open day, so
            // the popover inside it draws over the weeks below.
            <View
              key={month.key}
              style={[styles.month, month.cells.some((day) => day?.date === openDay) && styles.raised]}
            >
              <Text style={styles.monthLabel}>{month.label}</Text>
              <View style={styles.monthGrid}>
                {month.cells.map((day, index) =>
                  day ? (
                    <Cell
                      key={index}
                      day={day}
                      today={today}
                      start={track.startDate}
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
              {openDay && month.cells.some((day) => day?.date === openDay) && (
                <DayDetail
                  date={openDay}
                  items={titlesFor(openDay)}
                  onClose={() => setOpenDay(null)}
                  styles={styles}
                  palette={palette}
                />
              )}
            </View>
          ))
        : weeks.map((week, index) => (
            <View
              key={index}
              style={[
                styles.week,
                week.month % 2 === 0 && { backgroundColor: palette.surfaceMuted },
                week.days.some((day) => day.date === openDay) && styles.raised,
              ]}
            >
              <Text style={styles.gutterLabel} allowFontScaling={false}>
                {week.label ?? ""}
              </Text>
              {week.days.map((day, cell) =>
                day.date ? (
                  <Cell
                    key={cell}
                    day={day}
                    today={today}
                    start={track.startDate}
                    open={openDay === day.date}
                    onPress={() => setOpenDay(openDay === day.date ? null : day.date)}
                    styles={styles}
                    palette={palette}
                  />
                ) : (
                  <View key={cell} style={[styles.cell, styles.blank]} />
                )
              )}
              {openDay && week.days.some((day) => day.date === openDay) && (
                <DayDetail
                  date={openDay}
                  items={titlesFor(openDay)}
                  onClose={() => setOpenDay(null)}
                  styles={styles}
                  palette={palette}
                />
              )}
            </View>
          ))}
        </Animated.View>
        </View>

        {weeks.length === 0 && <Text style={styles.muted}>Nothing recorded on this track yet.</Text>}
      </Refreshable>

      {/* The key, and the way through to the long view, on one line at the
          foot of the screen. They used to be three stacked rows — a key, a
          heading, and a chip repeating the word under it — which put more
          furniture below the graph than the graph had room to spare. */}
      <View style={styles.footRow}>
        <View style={styles.legend}>
          <Text style={styles.legendLabel}>Less</Text>
          {[0, 1, 2, 3, 4].map((count) => (
            <View key={count} style={[styles.legendCell, { backgroundColor: shade(count, palette) }]} />
          ))}
          <Text style={styles.legendLabel}>More</Text>

          {track.startDate && (
            <>
              <View style={styles.legendGap} />
              <View style={[styles.legendCell, { backgroundColor: palette.accent }]} />
              <Text style={styles.legendLabel}>started</Text>
            </>
          )}
        </View>

        <Link href="/insights" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="History" style={styles.historyButton}>
            <Ionicons name="stats-chart-outline" size={16} color={palette.foreground} />
          </Pressable>
        </Link>
      </View>

    </View>
  );
}

/** One step through the years. Disabled rather than hidden at the ends, so the
 *  control keeps its shape and the year stays where the eye left it. */
function YearStep({
  direction,
  disabled,
  onPress,
  styles,
  palette,
}: {
  direction: 1 | -1;
  disabled: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction < 0 ? "The year before" : "The year after"}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={[styles.yearStep, disabled && styles.yearStepOff]}
    >
      <Ionicons
        name={direction < 0 ? "chevron-back" : "chevron-forward"}
        size={16}
        color={disabled ? palette.subtleForeground : palette.foreground}
      />
    </Pressable>
  );
}

/** One day. Shared by both shapes so a square means the same thing, and is
 *  the same size, whichever way the grid is arranged. */
function Cell({
  day,
  today,
  start,
  open,
  onPress,
  styles,
  palette,
}: {
  day: StreakDay;
  today: string;
  /** The track's first day, which gets a colour of its own. */
  start?: string;
  open: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  // The day the track began is drawn in the accent rather than on the green
  // scale. The scale answers "how much", and the first day is not a quantity —
  // it is the edge of the data, and worth being able to find. Everything
  // before it stays blank in both shapes, because the track did not exist to
  // be missed.
  const began = Boolean(start) && day.date === start;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        `${formatDayMonthYear(parseYMD(day.date))}, ${day.count} logged` +
        (began ? ", the day this track started" : "")
      }
      onPress={onPress}
      style={[
        styles.cell,
        { backgroundColor: began ? palette.accent : shade(day.count, palette) },
        day.date === today && { borderWidth: 2, borderColor: palette.foreground },
        open && { borderWidth: 2, borderColor: palette.accent },
      ]}
    />
  );
}

/**
 * What was done on one day, shown directly beneath the day you tapped.
 *
 * Absolutely positioned so it overlaps the weeks below rather than pushing
 * them down — the grid is the thing being read, and having it jump every time
 * a square is tapped loses the place. A backdrop behind it takes any tap
 * outside and closes it.
 */
function DayDetail({
  date,
  items,
  onClose,
  styles,
  palette,
}: {
  date: string;
  items: CompletedItem[];
  onClose: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailHead}>
        <Ionicons name="calendar-outline" size={15} color={palette.accent} />
        <Text style={styles.detailTitle}>{formatDayMonthYear(parseYMD(date))}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={17} color={palette.subtleForeground} />
        </Pressable>
      </View>
      {items.length > 0 ? (
        items.map((item, index) => {
          // Older records stored a bare string here; `completedItemTitle` is
          // the shared core's answer to both shapes.
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
    // The page is a fixed frame now, so it pads itself and the graph inside
    // it stretches to whatever height is left over.
    screen: { flex: 1, backgroundColor: palette.background, paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
    grid: { flex: 1 },
    gridContent: { paddingBottom: SPACING.lg },
    weekdayHead: { paddingBottom: 2 },
    yearRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.lg,
      marginBottom: SPACING.md,
    },
    year: { color: palette.foreground, ...TYPE.subhead, fontWeight: "700", minWidth: 56, textAlign: "center" },
    yearStep: {
      minWidth: 36,
      minHeight: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    yearStepOff: { opacity: 0.4 },
    centered: { alignItems: "center", justifyContent: "center" },
    stats: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm },
    // Fixed rather than stretched to the width. Stretching gave cells big
    // enough to hold a number and left only a handful of weeks on screen,
    // which is the opposite of what a consistency grid is for: the point is
    // seeing months of it at once.
    weekdayRow: {
      flexDirection: "row",
      gap: CELL_GAP,
      alignItems: "center",
      marginBottom: 2,
    },
    weekdayLabel: {
      width: CELL,
      textAlign: "center",
      color: palette.subtleForeground,
      ...TYPE.micro,
      fontWeight: "700",
    },
    // The whole chart, centred as one block. Its children keep their own
    // fixed widths so the columns still line up with each other.
    // Exactly the seven columns wide, and centred on that. The month
    // labels down the side hang into the margin rather than taking a
    // column of their own, because a gutter counted into the width is a
    // gutter that pushes the grid off-centre by half of itself — and in
    // the month layout, where nothing is written in it, it did that for
    // no reason at all.
    chart: { alignSelf: "center", width: 7 * CELL + 7 * CELL_GAP },
    toggle: { marginBottom: SPACING.md },
    month: { marginBottom: SPACING.lg },
    monthLabel: {
      color: palette.mutedForeground,
      ...TYPE.caption,
      fontWeight: "700",
      marginBottom: SPACING.xs,
    },
    monthGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: CELL_GAP,
      width: 7 * CELL + 7 * CELL_GAP,
    },
    gutterLabel: {
      position: "absolute",
      right: "100%",
      paddingRight: CELL_GAP,
      width: GUTTER,
      textAlign: "right",
      color: palette.subtleForeground,
      ...TYPE.micro,
      fontWeight: "700",
    },
    week: {
      flexDirection: "row",
      gap: CELL_GAP,
      alignItems: "center",
      paddingVertical: 2,
      borderRadius: 4,
      // The band is exactly as wide as the row it shades. It used to be left
      // to stretch, which ran it the full width of the screen while the cells
      // stopped a third of the way across.
    },
    cell: { width: CELL, height: CELL, borderRadius: 4 },
    blank: { opacity: 0 },
    // A row holding the open day sits above its neighbours so the popover
    // inside it draws over the weeks below rather than under them.
    // Sits over the grid, under anything raised. Transparent: its only job is
    // to catch the tap.
    backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 },
    raised: { zIndex: 10, elevation: 10 },
    detail: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      gap: SPACING.sm,
      padding: SPACING.lg,
      marginTop: SPACING.xs,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.card,
      // Android draws by elevation, not paint order.
      elevation: 12,
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    detailHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    detailTitle: { flex: 1, color: palette.foreground, ...TYPE.body, fontWeight: "700" },
    detailLine: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
    detailTextWrap: { flex: 1, gap: 1 },
    detailText: { color: palette.foreground, ...TYPE.label, lineHeight: 18 },
    detailSub: { color: palette.subtleForeground, ...TYPE.micro, lineHeight: 16 },
    // Sits hard against the bottom of the screen, above the tab bar.
    footRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.md,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    legend: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
    historyButton: {
      minWidth: 36,
      minHeight: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    legendCell: { width: 12, height: 12, borderRadius: 3 },
    legendGap: { width: SPACING.md },
    legendLabel: { color: palette.subtleForeground, ...TYPE.micro, marginHorizontal: SPACING.xs },
    muted: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
  });
}
