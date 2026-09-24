// What each panel actually draws.
//
// Every one is a *summary*, not a copy of its screen: the point of a column of
// panels is to answer "where does this track stand?" in one scroll, and a
// panel that needs scrolling of its own has failed at that. Anything that
// wants more room links to the screen that has it.
//
// Visual before textual, deliberately. A bar, a ring, a row of dots and a big
// number all read at a glance; three sentences do not, and three sentences in
// eight stacked panels is the wall of words this replaced.

import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { TrackState } from "@shared/types";
import { isItemCompleted } from "@shared/completions";
import { computeRotationItemsForDay, isRotationItem } from "@shared/rotation";
import { DAYS_SHORT, getWeekNum, parseYMD } from "@shared/dates";
import { currentStreakLength } from "@shared/streak";
import { phaseStats, progressStats, streakCalendar, timelineStats } from "@shared/stats";
import { PanelCard, Meter } from "./PanelCard";
import { STEPS_PANEL } from "./layout";
import { usePedometer } from "../steps/usePedometer";
import { SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export interface PanelProps {
  track: TrackState;
  today: string;
}

/** Colour per panel, so the column is scannable before it is readable. */
const TINTS: Record<string, string> = {
  weeklyPlan: "#0ea5e9",
  phaseTracker: "#a855f7",
  streakGraph: "#22c55e",
  pomodoroTimer: "#f59e0b",
  portfolioTracker: "#ef4444",
  materialsTracker: "#14b8a6",
  notepad: "#64748b",
  todoList: "#6366f1",
  [STEPS_PANEL]: "#22c55e",
};

export function tintFor(id: string): string | undefined {
  return TINTS[id];
}

export function PanelBody({ id, track, today }: { id: string } & PanelProps) {
  switch (id) {
    case "weeklyPlan":
      return <WeekPanel track={track} today={today} />;
    case "phaseTracker":
      return <PhasePanel track={track} today={today} />;
    case "streakGraph":
      return <StreakPanel track={track} today={today} />;
    case "portfolioTracker":
      return <PortfolioPanel track={track} today={today} />;
    case "materialsTracker":
      return <MaterialsPanel track={track} today={today} />;
    case "pomodoroTimer":
      return <TimerPanel />;
    case "notepad":
      return <LinkPanel label="Open the notepad" />;
    case "todoList":
      return <LinkPanel label="Open the to-do list" />;
    case STEPS_PANEL:
      return <StepsPanel today={today} />;
    default:
      return null;
  }
}

/** The week, as seven dots coloured by what each day is for, with today ringed.
 *  The shape of the week in one line. */
function WeekPanel({ track, today }: PanelProps) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const week = DAYS_SHORT.slice(1).concat(DAYS_SHORT[0]);
  const todayKey = DAYS_SHORT[parseYMD(today).getDay()];

  return (
    <View style={styles.week}>
      {week.map((name) => {
        const day = (track.weekSchedule ?? []).find((d) => d.name === name);
        const colour = day ? track.focusTypes?.[day.type]?.color : undefined;
        const isToday = name === todayKey;
        return (
          <View key={name} style={styles.weekDay}>
            <View
              style={[
                styles.weekDot,
                { backgroundColor: colour || palette.surfaceMuted },
                isToday && { borderWidth: 2, borderColor: palette.foreground },
              ]}
            />
            <Text style={[styles.weekName, isToday && { color: palette.foreground, fontWeight: "700" }]}>
              {name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Where the roadmap stands: the current phase, and time spent against work
 *  done — the one comparison that says whether a track is on course. */
function PhasePanel({ track, today }: PanelProps) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const timeline = useMemo(() => timelineStats(track), [track]);
  const phase = useMemo(() => phaseStats(track, today), [track, today]);
  const progress = useMemo(() => progressStats(track), [track]);

  return (
    <>
      <View style={styles.headlineRow}>
        <Text style={styles.big}>{Math.round(progress.workPct)}%</Text>
        <View style={styles.headlineText}>
          <Text style={styles.strong} numberOfLines={1}>
            {phase.phase?.title ?? "No phase"}
          </Text>
          <Text style={styles.muted}>
            Day {timeline.daysPassed} of {timeline.totalDays}
          </Text>
        </View>
      </View>
      <Meter label="Time spent" value={Math.round(timeline.progressPct)} total={100} tint={palette.subtleForeground} />
      <Meter label="Work done" value={Math.round(progress.workPct)} total={100} tint={TINTS.phaseTracker} />
    </>
  );
}

/** The last five weeks, as the grid — enough to see a rhythm without becoming
 *  the whole panel. */
function StreakPanel({ track, today }: PanelProps) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const streak = currentStreakLength(track.streakHistory ?? [], today);
  const days = useMemo(() => streakCalendar(track, today).slice(-35), [track, today]);

  return (
    <>
      <View style={styles.headlineRow}>
        <Text style={[styles.big, { color: TINTS.streakGraph }]}>{streak}</Text>
        <Text style={styles.muted}>day{streak === 1 ? "" : "s"} in a row</Text>
      </View>
      <View style={styles.dots}>
        {/* Keyed by position, not date: the calendar pads each week out to
            seven with cells whose date is the empty string, so several of them
            share a "date" and React sees duplicate keys. */}
        {days.map((day, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { backgroundColor: day.count > 0 ? TINTS.streakGraph : palette.surfaceMuted },
              day.count > 0 && { opacity: Math.min(1, 0.4 + day.count * 0.2) },
            ]}
          />
        ))}
      </View>
    </>
  );
}

function PortfolioPanel({ track }: PanelProps) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const items = track.portfolio ?? [];
  const done = items.filter((p) => p.completed).length;

  if (items.length === 0) return <Text style={styles.muted}>Nothing to deliver on this track yet.</Text>;

  return (
    <>
      <Meter label="Delivered" value={done} total={items.length} tint={TINTS.portfolioTracker} />
      {items.slice(0, 3).map((project) => (
        <View key={project.id} style={styles.line}>
          <Ionicons
            name={project.completed ? "checkmark-circle" : "ellipse-outline"}
            size={15}
            color={project.completed ? palette.success : palette.subtleForeground}
          />
          <Text style={[styles.lineText, project.completed && styles.struck]} numberOfLines={1}>
            {project.title}
          </Text>
        </View>
      ))}
    </>
  );
}

function MaterialsPanel({ track }: PanelProps) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const materials = (track.materials ?? []).filter((m) => !m.archived);
  const reading = materials.filter((m) => m.status === "In Progress").slice(0, 3);

  if (materials.length === 0) return <Text style={styles.muted}>No materials on this track yet.</Text>;

  return (
    <>
      <Meter
        label="Finished"
        value={materials.filter((m) => (m.status || "").toLowerCase() === "completed").length}
        total={materials.length}
        tint={TINTS.materialsTracker}
      />
      {reading.map((material) => (
        <Meter
          key={material.id}
          label={material.title}
          value={material.currentPage ?? 0}
          total={material.totalPages || 1}
          tint={palette.subtleForeground}
        />
      ))}
      {reading.length === 0 && <Text style={styles.muted}>Nothing in progress right now.</Text>}
    </>
  );
}

function TimerPanel() {
  return <LinkPanel label="Start a session" />;
}

function StepsPanel({ today }: { today: string }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const steps = usePedometer(today, true);

  if (steps.status === "denied") {
    return (
      <Pressable accessibilityRole="button" onPress={steps.request}>
        <Text style={styles.muted}>
          Tap to let Horizon read this phone&apos;s step counter. Say no and nothing else changes.
        </Text>
      </Pressable>
    );
  }
  if (steps.status === "unavailable") {
    return <Text style={styles.muted}>This phone has no step counter.</Text>;
  }

  return (
    <View style={styles.headlineRow}>
      <Text style={[styles.big, { color: TINTS[STEPS_PANEL] }]}>{steps.today.toLocaleString()}</Text>
      <Text style={styles.muted}>steps today · counted while Horizon is open</Text>
    </View>
  );
}

/** For panels whose whole content is an action: a timer, a notepad. Drawing a
 *  fake preview of a text editor would be decoration pretending to be data. */
function LinkPanel({ label }: { label: string }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return <Text style={[styles.muted, { color: palette.mutedForeground }]}>{label} →</Text>;
}

/** The screen behind each panel, if it has one. */
export const PANEL_HREF: Record<string, string> = {
  weeklyPlan: "/rhythm",
  phaseTracker: "/plan",
  streakGraph: "/progress",
  pomodoroTimer: "/timer",
  portfolioTracker: "/portfolio",
  materialsTracker: "/materials",
  notepad: "/notes",
  todoList: "/notes",
  [STEPS_PANEL]: "/steps",
};

export const PANEL_ICON: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  weeklyPlan: "calendar-outline",
  phaseTracker: "map-outline",
  streakGraph: "flame-outline",
  pomodoroTimer: "timer-outline",
  portfolioTracker: "cube-outline",
  materialsTracker: "book-outline",
  notepad: "create-outline",
  todoList: "checkbox-outline",
  [STEPS_PANEL]: "walk-outline",
};

export { PanelCard };

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    muted: { color: palette.mutedForeground, fontSize: 12, lineHeight: 17 },
    strong: { color: palette.foreground, fontSize: 14, fontWeight: "600" },
    big: { color: palette.accent, fontSize: 30, fontWeight: "700", lineHeight: 34 },
    headlineRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
    headlineText: { flex: 1, gap: 1 },
    week: { flexDirection: "row", justifyContent: "space-between" },
    weekDay: { alignItems: "center", gap: 4 },
    weekDot: { width: 16, height: 16, borderRadius: 8 },
    weekName: { color: palette.subtleForeground, fontSize: 10 },
    dots: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
    dot: { width: 12, height: 12, borderRadius: 3 },
    line: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    lineText: { flex: 1, color: palette.foreground, fontSize: 13 },
    struck: { color: palette.mutedForeground, textDecorationLine: "line-through" },
  });
}
