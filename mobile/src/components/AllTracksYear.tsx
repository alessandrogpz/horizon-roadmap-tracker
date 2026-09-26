// Every track's year at once: one strip per track, stacked, read sideways.
//
// A single track's grid runs *down* the page — seven columns wide, a week per
// row — because that is the only way a day stays big enough to tap on a phone.
// Several tracks cannot be laid out that way: three columns of weeks side by
// side is three narrow ribbons, and nothing about them can be compared.
//
// So the many-track view turns back to the shape everyone knows from a year
// of contributions — weeks across, weekdays down — zoomed out, and scrolled
// sideways instead of down. The names and their progress rings stay pinned at
// the left while the years slide underneath, which is what makes the stack
// readable: the whole point is that Tuesday the 3rd is the same column on
// every row.
//
// Two ways to scroll, because there are two questions:
//
//   swipe — every row moves together, which keeps the columns lined up and
//           answers "what were these three months like across all of them".
//   hold,
//   then
//   drag  — one row moves alone, for holding a track's summer against
//           another's winter. The row lifts and the rest fade, so it is never
//           in doubt which one the finger has hold of.
//
// Hold-then-drag is the odd one out, which is why it is the one that has to be
// asked for: the common case should be the one you get without knowing there
// is a choice. It is also the gesture My Space already uses for "pick this one
// up", so it is not a new thing to learn.
//
// This is why the strips are not in a ScrollView. Rows that can drift apart
// need an offset each, and a ScrollView has exactly one.

import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { timelineStats, yearCalendar, type StreakDay } from "@shared/stats";
import { currentStreakLength } from "@shared/streak";
import { parseYMD } from "@shared/dates";
import type { TrackState } from "@shared/types";
import { Ring } from "./Ring";
import { RADIUS, SPACING, TYPE, shadeOf, withAlpha, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

/** Zoomed out from the single-track grid's 26, which is a size built for a
 *  thumb. Nothing here is tappable — it is the shape of a year, and the year
 *  it belongs to is one tap away on the track itself. */
const CELL = 11;
const GAP = 3;
const COLUMN = CELL + GAP;
/** Seven days and the gaps between them. */
const ROW = 7 * CELL + 6 * GAP;
/** Air between one track and the next. Without it the stack is one block of
 *  squares and a row is something you have to count out. */
const ROW_GAP = SPACING.md;
const PITCH = ROW + ROW_GAP;
/** The strip of month names above the grid. */
const LABELS = 16;
/** The pinned column: a ring, a name, a streak. */
const HEAD = 108;
/** How far a row lifts out of the stack while it is being held, and how far
 *  the rest fade back.
 *
 *  The lift is vertical only. Scaling a strip in both directions scales it
 *  about its own centre, and the centre of a year is several hundred points
 *  off the side of the screen — so five per cent of that distance is a dozen
 *  points of sideways jump the moment the row is picked up, in a view whose
 *  whole claim is that the columns line up. */
const LIFT = 0.07;
const FADE = 0.72;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Row {
  track: TrackState;
  colour: string;
  weeks: StreakDay[][];
  pct: number;
  streak: number;
}

export function AllTracksYear({
  tracks,
  year,
  today,
  weekStartsOn,
}: {
  tracks: TrackState[];
  year: number;
  today: string;
  weekStartsOn: "sun" | "mon";
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const rows = useMemo<Row[]>(
    () =>
      tracks.map((track) => {
        const days = yearCalendar(
          track.completedItemsHistory ?? {},
          track.startDate,
          year,
          today,
          weekStartsOn
        );
        const weeks: StreakDay[][] = [];
        for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
        return {
          track,
          colour: track.meta.color || palette.accent,
          weeks,
          pct: timelineStats(track).progressPct,
          streak: currentStreakLength(track.streakHistory ?? [], today),
        };
      }),
    [palette.accent, today, tracks, weekStartsOn, year]
  );

  // The ruler the rows are hung on: the same year with every day counted as
  // lived, so the columns and the month names come from the calendar rather
  // than from whichever track happens to be first. Read off a track, a row
  // that began yesterday would have named one month and placed it at the far
  // end, and every label above every other row would have been wrong.
  const ruler = useMemo(
    () => yearCalendar({}, `${year}-01-01`, year, today, weekStartsOn),
    [today, weekStartsOn, year]
  );
  const columns = Math.ceil(ruler.length / 7);
  const marks = useMemo(() => monthMarks(ruler), [ruler]);
  const width = columns * COLUMN;

  /** How much of the year is off the right edge, on the UI thread where the
   *  gestures need it. */
  const [viewport, setViewport] = useState(0);
  const limit = useSharedValue(0);
  const travel = Math.max(0, width - viewport);
  useEffect(() => {
    limit.value = travel;
  }, [limit, travel]);

  /** Where the stack is: one offset for the group, and one per row for
   *  however far it has been dragged out of step with it. */
  const base = useSharedValue(0);
  const own = useSharedValue<number[]>([]);
  /** Where each gesture found things when it took hold. One apiece: they
   *  briefly overlap, and sharing a single one had the group drag reading the
   *  row's starting offset and jumping the whole stack. */
  const groupFrom = useSharedValue(0);
  const rowFrom = useSharedValue(0);
  /** True once the press has lasted long enough to mean "this row", and true
   *  again while a drag is acting on one. */
  const armed = useSharedValue(false);
  const soloing = useSharedValue(false);
  /** Where the finger went down, which is what decides whose row this is. By
   *  the time the drag starts it has already moved. */
  const downY = useSharedValue(0);
  /** Which row the finger has hold of, and how far the lift has got. Kept
   *  apart so that letting go can fade back rather than snap: clearing the
   *  index on release would end the emphasis in the same frame. */
  const focused = useSharedValue(-1);
  const lift = useSharedValue(0);

  useEffect(() => {
    own.value = rows.map((_, index) => own.value[index] ?? 0);
  }, [own, rows]);

  // Opened at the recent end, the same as the vertical grid — which in a shape
  // that runs sideways is the right edge, not the bottom. Once per year: this
  // is where the graph starts, not somewhere it travels to while you watch.
  const landedOn = useRef<string | null>(null);
  const landing = `${year}-${travel}`;
  useEffect(() => {
    if (viewport === 0 || landedOn.current === landing) return;
    landedOn.current = landing;
    base.value = -travel;
    own.value = rows.map(() => 0);
  }, [base, landing, own, rows, travel, viewport]);

  const count = rows.length;
  const gesture = useMemo(() => {
    /** Which row a touch landed on. The strips are a fixed pitch, so this is
     *  arithmetic rather than a measurement. */
    const rowAt = (y: number) => {
      "worklet";
      const index = Math.floor((y - LABELS) / PITCH);
      return index < 0 || index >= count ? -1 : index;
    };

    /** Nothing may be scrolled past either end of its own year. */
    const inRange = (offset: number) => {
      "worklet";
      return Math.min(0, Math.max(-limit.value, offset));
    };

    // A clock, and nothing else. It does no moving and owns no offset: all it
    // does is say, by the time the drag starts, whether the finger had been
    // still long enough to mean one row rather than all of them.
    const arm = Gesture.LongPress()
      .minDuration(260)
      // Far enough that a drag which has already begun does not cancel it —
      // the distance limit belongs to the pan, which fails it the other way by
      // starting before this has fired.
      .maxDistance(10_000)
      .onStart(() => {
        armed.value = true;
      })
      .onFinalize(() => {
        armed.value = false;
      });

    // One pan does all the moving, and decides at the moment it starts which
    // kind of drag it is. Two pans in an `Exclusive` was the obvious shape and
    // the wrong one: both of them ran, so a held row moved *and* took the
    // stack with it. One gesture cannot disagree with itself.
    const drag = Gesture.Pan()
      // Constrained to the horizontal so that a vertical drag still belongs to
      // the page behind this.
      .activeOffsetX([-12, 12])
      .failOffsetY([-14, 14])
      .onBegin((event) => {
        downY.value = event.y;
        groupFrom.value = base.value;
      })
      .onStart(() => {
        const index = armed.value ? rowAt(downY.value) : -1;
        soloing.value = index >= 0;
        focused.value = index;
        lift.value = withTiming(index >= 0 ? 1 : 0, { duration: 160 });
        rowFrom.value = index >= 0 ? own.value[index] ?? 0 : 0;
      })
      .onUpdate((event) => {
        const index = focused.value;
        if (!soloing.value || index < 0) {
          base.value = inRange(groupFrom.value + event.translationX);
          return;
        }
        const next = [...own.value];
        // Clamped against the group's position, so a row can be dragged out of
        // step with the others but never off the end of its own year.
        next[index] = inRange(base.value + rowFrom.value + event.translationX) - base.value;
        own.value = next;
      })
      .onEnd((event) => {
        // Only the group coasts. A held drag is someone placing one row
        // against another, and a flick carrying on past where they let go
        // would undo the placing.
        if (soloing.value) return;
        base.value = withDecay({ velocity: event.velocityX, clamp: [-limit.value, 0] });
      })
      .onFinalize(() => {
        soloing.value = false;
        lift.value = withTiming(0, { duration: 220 });
      });

    return Gesture.Simultaneous(arm, drag);
  }, [armed, base, count, downY, focused, groupFrom, lift, limit, own, rowFrom, soloing]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (Math.abs(next - viewport) > 0.5) setViewport(next);
  };

  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.min(0, Math.max(-limit.value, base.value)) }],
  }));

  /** How far along the year the stack is sitting, drawn as a thumb under it.
   *  A ScrollView would have come with one of these; this does not. */
  const thumbStyle = useAnimatedStyle(() => {
    const span = limit.value > 0 ? limit.value : 1;
    const seen = viewport > 0 && width > 0 ? Math.min(1, viewport / width) : 1;
    const bar = Math.max(24, viewport * seen);
    const at = Math.min(1, Math.max(0, -base.value / span));
    return { width: bar, transform: [{ translateX: at * Math.max(0, viewport - bar) }] };
  });

  if (columns === 0 || rows.length === 0) return null;

  return (
    <View style={styles.frame}>
      {/* Pinned. The spacer keeps these level with the strips, which start one
          label-row lower. */}
      <View style={styles.heads}>
        <View style={{ height: LABELS }} />
        {rows.map((row, index) => (
          <Head key={row.track.meta.id} row={row} index={index} focused={focused} lift={lift} styles={styles} />
        ))}
      </View>

      <View style={styles.years} onLayout={onLayout}>
        <GestureDetector gesture={gesture}>
          <View>
            <Animated.View style={[{ height: LABELS, width }, labelStyle]}>
              {marks.map((mark) => (
                <Text
                  key={mark.month}
                  style={[styles.monthLabel, { left: mark.column * COLUMN }]}
                  allowFontScaling={false}
                >
                  {MONTHS[mark.month]}
                </Text>
              ))}
            </Animated.View>

            {rows.map((row, index) => (
              <Strip
                key={row.track.meta.id}
                row={row}
                index={index}
                today={today}
                width={width}
                base={base}
                own={own}
                limit={limit}
                focused={focused}
                lift={lift}
                palette={palette}
                styles={styles}
              />
            ))}
          </View>
        </GestureDetector>

        {travel > 0 && (
          <View style={styles.rail}>
            <Animated.View style={[styles.thumb, thumbStyle]} />
          </View>
        )}
      </View>
    </View>
  );
}

type Shared<T> = { value: T };

/** A track's name, its streak and how far round its own timeline it is. Fades
 *  with its row, so the stack says which one is being moved in two places. */
function Head({
  row,
  index,
  focused,
  lift,
  styles,
}: {
  row: Row;
  index: number;
  focused: Shared<number>;
  lift: Shared<number>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: focused.value === index || focused.value < 0 ? 1 : 1 - FADE * lift.value,
  }));

  return (
    <Animated.View style={[styles.head, style]}>
      <Ring pct={row.pct} size={26} stroke={3} tint={row.colour} />
      <View style={styles.headText}>
        <Text style={styles.name} numberOfLines={2}>
          {row.track.meta.name}
        </Text>
        {row.streak > 0 && (
          <View style={styles.streak}>
            <Ionicons name="flame" size={10} color={row.colour} />
            <Text style={[styles.streakCount, { color: row.colour }]}>{row.streak}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

/** One track's year. Its own offset is added to the group's and the sum is
 *  clamped, so a row dragged out of step is still a row that cannot be pushed
 *  off either end of its own year. */
function Strip({
  row,
  index,
  today,
  width,
  base,
  own,
  limit,
  focused,
  lift,
  palette,
  styles,
}: {
  row: Row;
  index: number;
  today: string;
  width: number;
  base: Shared<number>;
  own: Shared<number[]>;
  limit: Shared<number>;
  focused: Shared<number>;
  lift: Shared<number>;
  palette: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const style = useAnimatedStyle(() => {
    const here = focused.value === index;
    const idle = focused.value < 0;
    const offset = base.value + (own.value[index] ?? 0);
    return {
      opacity: here || idle ? 1 : 1 - FADE * lift.value,
      transform: [
        { translateX: Math.min(0, Math.max(-limit.value, offset)) },
        { scaleY: here ? 1 + LIFT * lift.value : 1 },
      ],
    };
  });

  // Lit from behind while held, which says which row has been picked up more
  // plainly than a size change can at this zoom. Inside the strip, so it
  // travels with the row it belongs to.
  const band = useAnimatedStyle(() => ({ opacity: focused.value === index ? lift.value : 0 }));

  return (
    <Animated.View style={[styles.strip, { width }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(row.colour, 0.14) }, styles.band, band]}
      />
      {row.weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.week}>
          {week.map((day, dayIndex) => (
            <View
              key={dayIndex}
              style={[
                styles.cell,
                {
                  backgroundColor: day.date
                    ? shadeOf(row.colour, day.count, palette.surfaceMuted)
                    : "transparent",
                },
                // The same two marks the single-track grid uses: the day it
                // began, in the page's opposite so it survives any track
                // colour, and today, ringed.
                day.date && day.date === row.track.startDate && { backgroundColor: palette.foreground },
                day.date === today && { borderWidth: 2, borderColor: palette.foreground },
              ]}
            />
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

/** Which column each month starts in. A week belongs to the month of its first
 *  real day, which is the same rule the single-track grid bands by. */
function monthMarks(days: StreakDay[]): { month: number; column: number }[] {
  const marks: { month: number; column: number }[] = [];
  let seen = -1;
  for (let column = 0; column * 7 < days.length; column += 1) {
    const anchor = days.slice(column * 7, column * 7 + 7).find((day) => day.date);
    if (!anchor) continue;
    const month = parseYMD(anchor.date).getMonth();
    if (month === seen) continue;
    seen = month;
    // Skipped when the name would land on top of the one before it — at this
    // zoom a month is four columns, and three characters is wider than that
    // only where a month is cut short by the start of the year or by today.
    if (marks.length > 0 && column - marks[marks.length - 1].column < 3) continue;
    marks.push({ month, column });
  }
  return marks;
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    frame: { flexDirection: "row" },
    heads: { width: HEAD, paddingRight: SPACING.sm },
    // Clipped, so a row dragged sideways slides under the names rather than
    // across them.
    years: { flex: 1, overflow: "hidden" },
    head: { height: ROW, marginBottom: ROW_GAP, flexDirection: "row", alignItems: "flex-start", gap: 6 },
    headText: { flex: 1, gap: 3 },
    name: { color: palette.foreground, ...TYPE.label, fontWeight: "600", lineHeight: 15 },
    streak: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 2,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: RADIUS.control,
      backgroundColor: withAlpha(palette.foreground, 0.06),
    },
    streakCount: { ...TYPE.micro, fontWeight: "700" },
    monthLabel: { position: "absolute", top: 0, color: palette.subtleForeground, ...TYPE.micro },
    strip: { height: ROW, marginBottom: ROW_GAP, flexDirection: "row", gap: GAP },
    band: { borderRadius: 4, marginHorizontal: -GAP, marginVertical: -GAP },
    week: { gap: GAP },
    cell: { width: CELL, height: CELL, borderRadius: 2 },
    rail: { height: 3, borderRadius: 2, backgroundColor: palette.surfaceMuted },
    thumb: { height: 3, borderRadius: 2, backgroundColor: palette.subtleForeground },
  });
}
