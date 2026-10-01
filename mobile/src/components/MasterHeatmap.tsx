// The consistency grid with several tracks in one square, in the phone's
// shape: weeks as rows running down the page, seven columns across.
//
// A day on which three tracks did something has to say so, and the obvious
// answer — mix the three colours — is the wrong one: blue and amber average to
// a muddy grey that is neither, and the more tracks a day has the less it
// says. Blending loses exactly the information the square exists to carry.
//
// So a day is *divided*. One band per contributing track, in that track's own
// colour at the strength its own grid would have used, left to right in the
// order the tracks are listed. A day one track worked is a solid square
// exactly as it is on that track's own panel; a day three tracks worked is
// three bands, and you can see which three.
//
// Deliberately a recent window rather than a whole year. This sits inside a
// screen that already scrolls a long way, and the year belongs on Progress —
// which draws it as one row per track, a different question about the same
// days, and is one tap away.

import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { MasterDay } from "@shared/masterTrack";
import { TYPE, shadeOf, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

const CELL = 26;
const GAP = 4;

const WEEKDAYS_SUN = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS_MON = ["M", "T", "W", "T", "F", "S", "S"];

export function MasterHeatmap({
  days,
  today,
  weeks: weekCount,
  weekStartsOn,
  isRest,
}: {
  /** Week-major and padded to sevens — what `masterCalendar` returns. */
  days: MasterDay[];
  today: string;
  /** How many recent weeks to draw. */
  weeks: number;
  weekStartsOn: "sun" | "mon";
  /** Whether a date is one every selected track has off, and has passed. */
  isRest: (date: string) => boolean;
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const rows = useMemo(() => {
    const recent = days.slice(-weekCount * 7);
    const out: MasterDay[][] = [];
    for (let i = 0; i < recent.length; i += 7) out.push(recent.slice(i, i + 7));
    return out;
  }, [days, weekCount]);

  if (rows.length === 0) return null;

  return (
    <View style={styles.frame}>
      <View style={styles.header}>
        {(weekStartsOn === "mon" ? WEEKDAYS_MON : WEEKDAYS_SUN).map((label, index) => (
          <Text key={index} style={styles.headerLabel} allowFontScaling={false}>
            {label}
          </Text>
        ))}
      </View>

      {rows.map((week, index) => (
        <View key={index} style={styles.week}>
          {week.map((day, dayIndex) => {
            if (!day.date) return <View key={dayIndex} style={[styles.cell, styles.blank]} />;
            const resting = day.count === 0 && isRest(day.date);
            return (
              <View
                key={dayIndex}
                accessibilityLabel={
                  day.count === 0
                    ? `${day.date}, nothing logged${resting ? ", a day off" : ""}`
                    : `${day.date}, ${day.parts.map((part) => `${part.name} ${part.count}`).join(", ")}`
                }
                style={[
                  styles.cell,
                  { backgroundColor: palette.surfaceMuted },
                  day.date === today && { borderWidth: 2, borderColor: palette.foreground },
                ]}
              >
                {/* The bands. Laid out rather than painted as a gradient:
                    React Native has no CSS gradient, and at this size a row of
                    flex children is the same picture for less machinery. */}
                {day.parts.length > 0 && (
                  <View style={styles.bands}>
                    {day.parts.map((part) => (
                      <View
                        key={part.trackId}
                        style={{
                          flex: 1,
                          backgroundColor: shadeOf(part.color, part.count, palette.surfaceMuted),
                        }}
                      />
                    ))}
                  </View>
                )}
                {resting && <View style={[styles.restDot, { backgroundColor: palette.subtleForeground }]} />}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    frame: { alignSelf: "center", gap: GAP },
    header: { flexDirection: "row", gap: GAP },
    headerLabel: {
      width: CELL,
      textAlign: "center",
      color: palette.subtleForeground,
      ...TYPE.micro,
      fontWeight: "700",
    },
    week: { flexDirection: "row", gap: GAP },
    cell: {
      width: CELL,
      height: CELL,
      borderRadius: 4,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    blank: { opacity: 0 },
    // Absolutely placed so the bands fill the square and the dot sits over
    // them — a dot in the flex row would be a band of its own.
    bands: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row" },
    restDot: { width: 7, height: 7, borderRadius: 4 },
  });
}
