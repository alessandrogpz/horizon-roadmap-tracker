// Choosing a date, one decision at a time: year, then month, then day.
//
// This replaced a text box expecting `YYYY-MM-DD`. A text box asks the person
// to know the format, type it correctly on a touch keyboard, and get the month
// right — and then quietly does nothing when they do not, because the only
// thing the code could do with "24/09" was reject it. Every date in the app
// feeds arithmetic (a phase's deadline is a day count from the start), so an
// unparseable one is not a cosmetic problem.
//
// Offering choices instead means there is no invalid state to handle: every
// path through it produces a real date. Narrowing year → month → day also
// keeps each step to a screenful of large targets, rather than a calendar grid
// with a year selector hidden in a corner.
//
// A native date picker would do this too, and needs a native module, which
// means a new build in everyone's hands. This is three lists.

import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatDateYMD, isDateStr, parseYMD } from "@shared/dates";
import { tap } from "../feedback/haptics";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { Tappable } from "./Tappable";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Step = "year" | "month" | "day";

export function DatePicker({
  open,
  value,
  title,
  /** Nothing before this can be picked — an end date cannot precede a start. */
  earliest,
  onPick,
  onClose,
}: {
  open: boolean;
  /** `YYYY-MM-DD`, or empty to start from today. */
  value: string;
  title: string;
  earliest?: string;
  onPick: (date: string) => void;
  onClose: () => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const start = useMemo(() => (value ? parseYMD(value) : new Date()), [value]);
  const [step, setStep] = useState<Step>("year");
  const [year, setYear] = useState(start.getFullYear());
  const [month, setMonth] = useState(start.getMonth());

  // Reopening should not resume halfway through somebody else's decision.
  useEffect(() => {
    if (!open) return;
    setStep("year");
    setYear(start.getFullYear());
    setMonth(start.getMonth());
  }, [open, start]);

  const floor = earliest ? parseYMD(earliest) : null;
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => {
    const from = Math.min(floor?.getFullYear() ?? thisYear, thisYear) - 1;
    return Array.from({ length: 12 }, (_, i) => from + i);
  }, [floor, thisYear]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = new Date(year, month, 1).getDay();

  /** A day is pickable unless it falls before the floor. Deciding this here
   *  rather than after the fact is the whole point: an unpickable day is never
   *  offered, so there is no error to report. */
  const allowed = (day: number) => !floor || new Date(year, month, day) >= floor;
  const monthAllowed = (index: number) => !floor || new Date(year, index + 1, 0) >= floor;
  const yearAllowed = (candidate: number) => !floor || candidate >= floor.getFullYear();

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cancel" />

        <View style={styles.sheet}>
          <View style={styles.head}>
            {step !== "year" && (
              <Tappable
                accessibilityRole="button"
                accessibilityLabel="Back a step"
                hitSlop={10}
                onPress={() => setStep(step === "day" ? "month" : "year")}
              >
                <Ionicons name="chevron-back" size={20} color={palette.foreground} />
              </Tappable>
            )}
            <View style={styles.headText}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.crumb}>
                {step === "year"
                  ? "Pick a year"
                  : step === "month"
                    ? `${year} · pick a month`
                    : `${SHORT[month]} ${year} · pick a day`}
              </Text>
            </View>
            <Tappable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={20} color={palette.subtleForeground} />
            </Tappable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {step === "year" && (
              <View style={styles.grid}>
                {years.map((candidate) => (
                  <Tappable
                    key={candidate}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !yearAllowed(candidate), selected: candidate === year }}
                    disabled={!yearAllowed(candidate)}
                    onPress={() => {
                      tap();
                      setYear(candidate);
                      setStep("month");
                    }}
                    style={[
                      styles.cell,
                      candidate === year && { borderColor: palette.accent },
                      !yearAllowed(candidate) && styles.disabled,
                    ]}
                  >
                    <Text style={[styles.cellLabel, candidate === thisYear && { color: palette.accent }]}>
                      {candidate}
                    </Text>
                  </Tappable>
                ))}
              </View>
            )}

            {step === "month" && (
              <View style={styles.grid}>
                {MONTHS.map((name, index) => (
                  <Tappable
                    key={name}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !monthAllowed(index), selected: index === month }}
                    disabled={!monthAllowed(index)}
                    onPress={() => {
                      tap();
                      setMonth(index);
                      setStep("day");
                    }}
                    style={[
                      styles.cell,
                      index === month && { borderColor: palette.accent },
                      !monthAllowed(index) && styles.disabled,
                    ]}
                  >
                    <Text style={styles.cellLabel}>{SHORT[index]}</Text>
                  </Tappable>
                ))}
              </View>
            )}

            {step === "day" && (
              <View style={styles.days}>
                {/* Blanks so the 1st lands under the right weekday. */}
                {Array.from({ length: leading }, (_, i) => (
                  <View key={`pad-${i}`} style={[styles.day, styles.invisible]} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                  <Tappable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={`${day} ${MONTHS[month]} ${year}`}
                    accessibilityState={{ disabled: !allowed(day) }}
                    disabled={!allowed(day)}
                    onPress={() => {
                      tap();
                      onPick(formatDateYMD(new Date(year, month, day)));
                      onClose();
                    }}
                    style={[styles.day, !allowed(day) && styles.disabled]}
                  >
                    <Text style={styles.cellLabel}>{day}</Text>
                  </Tappable>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** "24 Sept 2026", or a prompt when nothing is set yet. */
export function describeDate(value: string, empty = "Choose a date"): string {
  if (!isDateStr(value)) return empty;
  const date = parseYMD(value);
  return `${date.getDate()} ${SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: "78%",
      backgroundColor: palette.card,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderTopWidth: 1,
      borderColor: palette.cardBorder,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.lg,
      borderBottomWidth: 1,
      borderBottomColor: palette.cardBorder,
    },
    headText: { flex: 1, gap: 2 },
    title: { color: palette.foreground, ...TYPE.heading, fontWeight: "700" },
    crumb: { color: palette.mutedForeground, ...TYPE.caption},
    body: { maxHeight: 340 },
    bodyContent: { padding: SPACING.lg, paddingBottom: SPACING.xl },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
    cell: {
      width: "30%",
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 52,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    days: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    day: {
      width: "12.4%",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    invisible: { opacity: 0, borderWidth: 0 },
    disabled: { opacity: 0.3 },
    cellLabel: { color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
  });
}
