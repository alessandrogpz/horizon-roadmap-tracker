// The week, as dates you can walk through — and the month, when you want less
// detail over more time.
//
// What this replaced was a rhythm and not a calendar: seven chips reading
// Mon..Sun, describing what a weekday is *for* in general, with no way to ask
// "what does the week after next look like?". That is a real question here,
// because rotations answer it differently every week — a rotation's topic is
// computed from the week number, never stored, so next week's is knowable but
// was not viewable.
//
// Two scopes, borrowed from every calendar anyone already uses: a week in
// detail, a month in outline. Week is the default because a week is the unit
// this app plans in; the month exists to find the week you want.
//
// Everything shown is derived, never stored twice: the day's kind comes from
// the track's rhythm, its rotation topics from `computeRotationItemsForDay`,
// its gym work from the plan for that kind of day, and what was actually done
// from the completion history.

import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeIn } from "react-native-reanimated";
import type { TrackState } from "@shared/types";
import type { GymLog } from "@shared/gym";
import { focusOfDay, plannedFor } from "@shared/gym";
import { computeRotationItemsForDay, isRotationItem } from "@shared/rotation";
import { DAYS_SHORT, formatDateYMD, getWeekNum, parseYMD, todayYMD } from "@shared/dates";
import { getSettings } from "@shared/settings";
import { tap } from "../feedback/haptics";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { Segmented } from "./Segmented";

type Scope = "week" | "month";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** How much of the calendar to show at once. */
const SCOPES = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const;

/** What a given date asks for, worked out rather than looked up. */
interface DayPlan {
  date: string;
  dayKey: string;
  focus: { key: string; label: string } | null;
  colour?: string;
  /** Everything the day contains, whatever it came from. */
  items: string[];
  /** How many things were recorded against it. */
  done: number;
}

function planFor(track: TrackState, gym: GymLog, date: string): DayPlan {
  const dayKey = DAYS_SHORT[parseYMD(date).getDay()];
  const focus = focusOfDay(track.weekSchedule, dayKey);

  const rotations = track.rotations ?? [];
  const weekNum = track.startDate ? getWeekNum(track.startDate, parseYMD(date)) : 1;
  const computed = rotations.length
    ? computeRotationItemsForDay(rotations, weekNum, dayKey)
    : { focus: [], revisions: [] };

  // Stored rotation items are last week's answer, so they are dropped in
  // favour of the computed ones — the same rule Today follows.
  const stored = [
    ...(track.dailyTasks?.[dayKey] ?? []),
    ...(track.dailyRevisionItems?.[dayKey] ?? []),
  ].filter((item) => !isRotationItem(item));

  const items = [
    ...computed.focus.map((item) => item.title),
    ...computed.revisions.map((item) => item.title),
    ...stored.map((item) => item.title),
    ...plannedFor(gym, focus?.key).map((item) => item.name),
  ];

  return {
    date,
    dayKey,
    focus,
    colour: focus ? track.focusTypes?.[focus.key]?.color : undefined,
    items,
    done: track.completedItemsHistory?.[date]?.length ?? 0,
  };
}

export function RhythmCalendar({ track, gym }: { track: TrackState; gym: GymLog }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const today = todayYMD();
  const [scope, setScope] = useState<Scope>("week");
  /** The week or month being looked at, as its first visible day. */
  const [anchor, setAnchor] = useState(today);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const weekStartsOn = getSettings().weekStartsOn;

  /** The first day of the anchor's week, honouring the week-start setting. */
  const weekStart = useCallback(
    (from: string) => {
      const date = parseYMD(from);
      const offset = weekStartsOn === "mon" ? (date.getDay() + 6) % 7 : date.getDay();
      date.setDate(date.getDate() - offset);
      return date;
    },
    [weekStartsOn]
  );

  const step = useCallback(
    (direction: number) => {
      tap();
      setOpenDay(null);
      setAnchor((current) => {
        const date = parseYMD(current);
        if (scope === "week") date.setDate(date.getDate() + direction * 7);
        else date.setMonth(date.getMonth() + direction);
        return formatDateYMD(date);
      });
    },
    [scope]
  );

  const days = useMemo(() => {
    if (scope === "week") {
      const start = weekStart(anchor);
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        return planFor(track, gym, formatDateYMD(date));
      });
    }

    const at = parseYMD(anchor);
    const first = new Date(at.getFullYear(), at.getMonth(), 1);
    const count = new Date(at.getFullYear(), at.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) =>
      planFor(track, gym, formatDateYMD(new Date(at.getFullYear(), at.getMonth(), i + 1)))
    );
  }, [anchor, gym, scope, track, weekStart]);

  const onCurrent =
    scope === "week"
      ? formatDateYMD(weekStart(anchor)) === formatDateYMD(weekStart(today))
      : anchor.slice(0, 7) === today.slice(0, 7);

  const title = useMemo(() => {
    if (scope === "month") {
      const at = parseYMD(anchor);
      return `${MONTHS[at.getMonth()]} ${at.getFullYear()}`;
    }
    const start = weekStart(anchor);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth();
    return sameMonth
      ? `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]}`
      : `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
  }, [anchor, scope, weekStart]);

  const labels = weekStartsOn === "mon" ? ["M", "T", "W", "T", "F", "S", "S"] : ["S", "M", "T", "W", "T", "F", "S"];
  const leading = (() => {
    if (scope !== "month" || days.length === 0) return 0;
    const first = parseYMD(days[0].date).getDay();
    return weekStartsOn === "mon" ? (first + 6) % 7 : first;
  })();

  return (
    <View style={styles.block}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={scope === "week" ? "The week before" : "The month before"}
          onPress={() => step(-1)}
          style={styles.stepButton}
          hitSlop={6}
        >
          <Ionicons name="chevron-back" size={18} color={palette.foreground} />
        </Pressable>

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={scope === "week" ? "The week after" : "The month after"}
          onPress={() => step(1)}
          style={styles.stepButton}
          hitSlop={6}
        >
          <Ionicons name="chevron-forward" size={18} color={palette.foreground} />
        </Pressable>
      </View>

      <View style={styles.controls}>
        <View style={styles.scopes}>
          <Segmented
            options={SCOPES}
            value={scope}
            onChange={(next) => {
              setScope(next);
              setOpenDay(null);
            }}
          />
        </View>

        {/* Only offered when it would do something. A button that is already
            where you are is furniture. */}
        {!onCurrent && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              tap();
              setAnchor(today);
              setOpenDay(null);
            }}
            style={[styles.scope, styles.todayButton]}
          >
            <Text style={[styles.scopeLabel, { color: palette.accent }]}>Today</Text>
          </Pressable>
        )}
      </View>

      {/* Keyed by scope so the change is something you watch: the two views
          share a place on the screen, and without it one simply becomes the
          other between frames. */}
      <Animated.View key={scope} entering={FadeIn.duration(240)} style={styles.block}>
      {scope === "week" ? (
        days.map((day) => (
          <WeekRow
            key={day.date}
            day={day}
            today={today}
            open={openDay === day.date}
            onPress={() => setOpenDay(openDay === day.date ? null : day.date)}
            styles={styles}
            palette={palette}
          />
        ))
      ) : (
        <>
          <View style={styles.monthHead}>
            {labels.map((label, index) => (
              <Text key={index} style={styles.monthHeadLabel} allowFontScaling={false}>
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.monthGrid}>
            {Array.from({ length: leading }, (_, i) => (
              <View key={`pad-${i}`} style={[styles.monthCell, styles.invisible]} />
            ))}
            {days.map((day) => (
              <Pressable
                key={day.date}
                accessibilityRole="button"
                accessibilityLabel={`${parseYMD(day.date).getDate()} ${day.focus?.label ?? "nothing planned"}, ${day.items.length} planned`}
                onPress={() => setOpenDay(openDay === day.date ? null : day.date)}
                style={[
                  styles.monthCell,
                  day.date === today && { borderColor: palette.foreground },
                  openDay === day.date && { borderColor: palette.accent },
                ]}
              >
                <Text
                  style={[styles.monthDay, day.done > 0 && { color: palette.success, fontWeight: "700" }]}
                  allowFontScaling={false}
                >
                  {parseYMD(day.date).getDate()}
                </Text>
                {/* The month's entire vocabulary, and deliberately small: the
                    dot's colour is what kind of day it is, its strength is
                    whether anything is actually on it, and a green number
                    means something was done. Three things at a glance is the
                    most a 45px cell can carry without becoming a week view. */}
                {day.focus && (
                  <View
                    style={[
                      styles.monthDot,
                      { backgroundColor: day.colour ?? palette.subtleForeground },
                      day.items.length === 0 && styles.monthDotIdle,
                    ]}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </>
      )}

      </Animated.View>

      {openDay && scope === "month" && (
        <DayCard
          day={days.find((day) => day.date === openDay)!}
          onClose={() => setOpenDay(null)}
          styles={styles}
          palette={palette}
        />
      )}
    </View>
  );
}

/** One dated day in the week view: what it is for, and what it holds. */
function WeekRow({
  day,
  today,
  open,
  onPress,
  styles,
  palette,
}: {
  day: DayPlan;
  today: string;
  open: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const isToday = day.date === today;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={[styles.row, isToday && { borderColor: palette.accent }]}
    >
      <View style={styles.rowHead}>
        <View style={styles.rowDate}>
          <Text style={[styles.rowDay, isToday && { color: palette.accent }]}>{day.dayKey}</Text>
          <Text style={styles.rowNumber}>{parseYMD(day.date).getDate()}</Text>
        </View>

        <View style={[styles.dot, { backgroundColor: day.colour ?? palette.surfaceMuted }]} />

        <View style={styles.rowText}>
          <Text style={styles.rowFocus}>{day.focus?.label ?? "Nothing set"}</Text>
          <Text style={styles.rowSummary} numberOfLines={open ? undefined : 1}>
            {day.items.length > 0 ? day.items.join(" · ") : "nothing planned"}
          </Text>
        </View>

        {day.done > 0 && (
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark" size={11} color={palette.success} />
            <Text style={styles.doneCount}>{day.done}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/** The month's detail, for the day that was tapped. */
function DayCard({
  day,
  onClose,
  styles,
  palette,
}: {
  day: DayPlan;
  onClose: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>
          {day.dayKey} {parseYMD(day.date).getDate()} {MONTHS[parseYMD(day.date).getMonth()]} ·{" "}
          {day.focus?.label ?? "nothing set"}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={16} color={palette.subtleForeground} />
        </Pressable>
      </View>
      {day.items.length > 0 ? (
        <ScrollView style={styles.cardList}>
          {day.items.map((item, index) => (
            <Text key={`${index}-${item}`} style={styles.cardItem}>
              · {item}
            </Text>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.rowSummary}>Nothing planned.</Text>
      )}
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    block: { gap: SPACING.sm },
    bar: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    stepButton: {
      minWidth: 40,
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    title: { flex: 1, textAlign: "center", color: palette.foreground, fontSize: 15, fontWeight: "700" },
    controls: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    // Wide enough to read, not so wide it takes the row from the Today chip.
    scopes: { width: 150 },
    scope: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    todayButton: { marginLeft: "auto", borderColor: palette.accent },
    scopeLabel: { color: palette.mutedForeground, fontSize: 12, fontWeight: "600" },
    row: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    rowHead: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
    rowDate: { alignItems: "center", minWidth: 30 },
    rowDay: { color: palette.subtleForeground, fontSize: 10, fontWeight: "700" },
    rowNumber: { color: palette.foreground, fontSize: 16, fontWeight: "700" },
    dot: { width: 8, height: 8, borderRadius: 4 },
    rowText: { flex: 1, gap: 1 },
    rowFocus: { color: palette.foreground, fontSize: 14, fontWeight: "600" },
    rowSummary: { color: palette.mutedForeground, fontSize: 12, lineHeight: 17 },
    doneBadge: { flexDirection: "row", alignItems: "center", gap: 2 },
    doneCount: { color: palette.success, fontSize: 12, fontWeight: "700" },
    monthHead: { flexDirection: "row", marginTop: SPACING.xs },
    monthHeadLabel: {
      flex: 1,
      textAlign: "center",
      color: palette.subtleForeground,
      fontSize: 10,
      fontWeight: "700",
    },
    monthGrid: { flexDirection: "row", flexWrap: "wrap" },
    monthCell: {
      width: "14.28%",
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      borderWidth: 1,
      borderColor: "transparent",
      borderRadius: RADIUS.control,
    },
    invisible: { opacity: 0 },
    monthDay: { color: palette.foreground, fontSize: 13 },
    monthDot: { width: 7, height: 7, borderRadius: 4 },
    monthDotIdle: { opacity: 0.3 },
    card: {
      gap: SPACING.xs,
      padding: SPACING.md,
      marginTop: SPACING.sm,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.card,
    },
    cardHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    cardTitle: { flex: 1, color: palette.foreground, fontSize: 13, fontWeight: "700" },
    cardList: { maxHeight: 160 },
    cardItem: { color: palette.mutedForeground, fontSize: 13, lineHeight: 19 },
  });
}
