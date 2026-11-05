/**
 * Three phone screens, drawn from the app's own parts and the app's own demo
 * data: the run of days, the home column, and a set being logged.
 *
 * Pictures, not copies. They responded briefly — the shape control switched,
 * a set ticked — and a phone on a marketing page that half-works is worse
 * than one that plainly does not: it tells the visitor something about the
 * product that is not true. The date is pinned; see `phoneData.ts`.
 */

import {
  BookOpen,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Map,
  MoreHorizontal,
  Moon,
  StickyNote,
  Timer,
  Trophy,
} from "lucide-react";
import { shadeOf } from "@/lib/colors";
import { parseYMD } from "@/lib/dates";
import { PREVIEW_TRACK, PREVIEW_TODAY, PREVIEW_WEEKS } from "./phoneData";
import { trackInkVariables } from "@/lib/trackAccent";

const ACCENT = PREVIEW_TRACK.color;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The bar across the top of every screen in the phone app: back, the track
 * with its colour and its chevron, whether it is syncing, the theme, the
 * menu. Drawn here because a screenshot without it is not a screenshot of
 * this app — it was the clearest thing missing from the first version.
 */
function AppBar({ title, back = true }: { title: string; back?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 pb-2">
      {back && <ChevronLeft size={13} strokeWidth={2.5} className="shrink-0 text-foreground" />}
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ACCENT }} />
      <span className="min-w-0 truncate text-[0.72rem] font-bold text-foreground">{title}</span>
      <ChevronDown size={10} strokeWidth={2.5} className="shrink-0 text-subtle-foreground" />
      <span className="ml-auto flex items-center gap-1 rounded-full border border-card-border px-1.5 py-px text-[0.48rem] text-muted-foreground">
        <span className="h-1 w-1 rounded-full bg-subtle-foreground" />
        Local
      </span>
      <span className="flex h-4 w-4 items-center justify-center rounded border border-card-border">
        <Moon size={8} strokeWidth={2} className="text-muted-foreground" />
      </span>
      <span className="flex h-4 w-4 items-center justify-center rounded border border-card-border">
        <MoreHorizontal size={8} strokeWidth={2} className="text-muted-foreground" />
      </span>
    </div>
  );
}

/** The phone's segmented control: the two ways of laying the same days out. */
function Segmented({ options, value }: { options: string[]; value: string }) {
  return (
    <div className="flex rounded-lg border border-card-border bg-surface-muted p-0.5">
      {options.map((option) => (
        <span
          key={option}
          className={`flex-1 rounded-[6px] py-1 text-center text-[0.55rem] font-semibold ${
            option === value ? "bg-card text-foreground" : "text-muted-foreground"
          }`}
        >
          {option}
        </span>
      ))}
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  unit,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  tint?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-lg border border-card-border bg-card px-2 py-2">
      <span className="flex items-center gap-1 text-[0.56rem] font-semibold text-muted-foreground">
        <span className="track-ink" style={trackInkVariables(tint ?? ACCENT) as React.CSSProperties}>
          {icon}
        </span>
        {label}
      </span>
      <span className="flex items-baseline gap-1">
        <span className="text-[1.15rem] font-bold leading-none text-foreground">{value}</span>
        <span className="text-[0.55rem] text-muted-foreground">{unit}</span>
      </span>
    </div>
  );
}

/** Progress: the run of days, laid out down the screen rather than across it. */
export function ProgressScreen() {
  return (
    <div className="flex h-full flex-col gap-2 pt-1">
      <AppBar title={PREVIEW_TRACK.name} />

      <div className="flex gap-1.5">
        <Tile icon={<Flame size={8} strokeWidth={3} />} label="Streak" value={PREVIEW_TRACK.streak} unit="days" tint="#f59e0b" />
        <Tile icon={<Trophy size={8} strokeWidth={3} />} label="Longest" value={PREVIEW_TRACK.stats.longest} unit="days" />
        <Tile icon={<Calendar size={8} strokeWidth={3} />} label="Last 30" value={PREVIEW_TRACK.stats.activeLast30} unit="active" />
      </div>

      <Segmented options={["By month", "Continuous"]} value="Continuous" />

      <div className="flex items-center justify-center gap-2">
        <span className="flex h-4 w-4 items-center justify-center rounded border border-card-border">
          <ChevronLeft size={9} strokeWidth={2.5} className="text-muted-foreground" />
        </span>
        <span className="font-mono text-[0.62rem] font-bold text-foreground">2026</span>
        <span className="flex h-4 w-4 items-center justify-center rounded border border-card-border opacity-40">
          <ChevronRight size={9} strokeWidth={2.5} className="text-muted-foreground" />
        </span>
      </div>

      <div className="flex gap-1 self-center text-[0.5rem] font-bold text-subtle-foreground">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
          <span key={index} className="w-[26px] text-center">
            {day}
          </span>
        ))}
      </div>

      <div className="relative flex flex-col items-center gap-1">
        {PREVIEW_WEEKS.map((week, index) => (
          <div key={index} className="relative flex gap-1">
            {/* The month hangs in the margin rather than taking a column of
                its own, so the seven stay centred. */}
            {index === 0 || parseYMD(week[0].date).getDate() <= 7 ? (
              <span className="absolute right-full top-1 pr-1.5 text-[0.48rem] font-semibold text-subtle-foreground">
                {MONTHS[parseYMD(week[0].date).getMonth()]}
              </span>
            ) : null}
            {week.map((day) => (
              <span
                key={day.date}
                className="h-[26px] w-[26px] rounded"
                style={{
                  background: shadeOf(ACCENT, day.count, "var(--streak-0)"),
                  boxShadow: day.date === PREVIEW_TODAY ? "inset 0 0 0 2px var(--foreground)" : undefined,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-1 pt-1 text-[0.48rem] text-subtle-foreground">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className="h-2 w-2 rounded-[2px]"
            style={{ background: shadeOf(ACCENT, level, "var(--streak-0)") }}
          />
        ))}
        <span>More</span>
        <span className="ml-1.5 h-2 w-2 rounded-[2px] bg-foreground" />
        <span>started</span>
        <span className="ml-auto flex h-4 w-4 items-center justify-center rounded border border-card-border">
          <BarChart3 size={8} strokeWidth={2} className="text-muted-foreground" />
        </span>
      </div>
    </div>
  );
}

/** The panels below the two open ones, collapsed to their headers — which is
 *  what the column actually looks like once a few are folded away. */
const PANELS = [
  { icon: Flame, title: "Consistency", tint: "#22c55e" },
  { icon: Dumbbell, title: "Workout", tint: "#f59e0b" },
  { icon: Timer, title: "Timer", tint: "#ef4444" },
  { icon: BookOpen, title: "Materials", tint: "#0ea5e9" },
  { icon: StickyNote, title: "Notepad", tint: "#a855f7" },
];

/** My Space: the whole track as one column of panels you drag into order. */
export function MySpaceScreen() {
  return (
    <div className="flex h-full flex-col gap-2 pt-1">
      <AppBar title={PREVIEW_TRACK.name} back={false} />
      <span className="px-0.5 text-[0.9rem] font-bold text-foreground">My space</span>

      {/* Weekly overview, open */}
      <div className="flex flex-col gap-2 rounded-xl border border-card-border bg-card p-2.5">
        <span className="flex items-center gap-1.5 text-[0.62rem] font-bold text-foreground">
          <span
            className="track-ink flex h-4 w-4 items-center justify-center rounded"
            style={{ ...trackInkVariables("#0ea5e9"), background: "rgba(14,165,233,0.16)" } as React.CSSProperties}
          >
            <Calendar size={9} strokeWidth={2.5} />
          </span>
          Weekly Overview
        </span>
        <div className="flex justify-between">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name, index) => (
            <span key={name} className="flex flex-col items-center gap-1">
              <span
                className="h-[13px] w-[13px] rounded-full"
                style={{
                  background: index === 5 ? "#22c55e" : index === 6 ? "var(--surface-hover)" : ACCENT,
                  boxShadow: index === 5 ? "0 0 0 2px var(--foreground)" : undefined,
                }}
              />
              <span className={`text-[0.45rem] ${index === 5 ? "font-bold text-foreground" : "text-subtle-foreground"}`}>
                {name}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Phases, open */}
      <div className="flex flex-col gap-2 rounded-xl border border-card-border bg-card p-2.5">
        <span className="flex items-center gap-1.5 text-[0.62rem] font-bold text-foreground">
          <span className="flex h-4 w-4 items-center justify-center rounded" style={{ background: "rgba(168,85,247,0.16)", color: "#a855f7" }}>
            <Map size={9} strokeWidth={2.5} />
          </span>
          Phases
        </span>
        <div className="flex items-baseline gap-2">
          <span className="track-ink text-[1.5rem] font-bold leading-none" style={trackInkVariables(ACCENT) as React.CSSProperties}>
            {Math.round(PREVIEW_TRACK.pct)}%
          </span>
          <span className="flex flex-col">
            <span className="text-[0.65rem] font-semibold text-foreground">Rasterizer &amp; pipeline</span>
            <span className="text-[0.52rem] text-muted-foreground">Day 64 of 112</span>
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-hover">
          <div className="h-full rounded-full" style={{ width: `${PREVIEW_TRACK.pct}%`, background: ACCENT }} />
        </div>
      </div>

      {/* The rest, collapsed */}
      {PANELS.map((panel) => (
        <div
          key={panel.title}
          className="flex items-center gap-1.5 rounded-xl border border-card-border bg-card p-2.5 text-[0.62rem] font-bold text-foreground"
        >
          <span
            className="track-ink flex h-4 w-4 items-center justify-center rounded"
            style={{ ...trackInkVariables(panel.tint), background: `${panel.tint}28` } as React.CSSProperties}
          >
            <panel.icon size={9} strokeWidth={2.5} />
          </span>
          {panel.title}
          {panel.title === "Consistency" && (
            <span className="track-ink ml-auto text-[0.62rem] font-bold" style={trackInkVariables("#22c55e") as React.CSSProperties}>
              {PREVIEW_TRACK.streak} days
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

const SETS = [
  { set: 1, previous: "80 × 8", kg: 80, reps: 8, done: true },
  { set: 2, previous: "80 × 8", kg: 82.5, reps: 8, done: true },
  { set: 3, previous: "82.5 × 6", kg: 82.5, reps: 7, done: true },
  { set: 4, previous: "82.5 × 6", kg: 85, reps: 6, done: false },
];

/** Workout: a session logged set by set, on the phone only. */
export function WorkoutScreen() {
  return (
    <div className="flex h-full flex-col gap-2.5 pt-1">
      <AppBar title="Workout" />
      <div className="flex items-baseline justify-between px-0.5">
        <span className="text-[0.9rem] font-bold text-foreground">Push</span>
        <span className="font-mono text-[0.55rem] text-muted-foreground">Sat 26 Sep</span>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-card-border bg-card p-2.5">
        <span className="text-[0.68rem] font-bold text-foreground">Bench press</span>
        <div className="grid grid-cols-[22px_1fr_44px_38px_20px] gap-x-1.5 text-[0.52rem] font-semibold text-subtle-foreground">
          <span>Set</span>
          <span>Previous</span>
          <span className="text-center">kg</span>
          <span className="text-center">Reps</span>
          <span />
        </div>
        {SETS.map((row) => (
          <div
            key={row.set}
            className="grid grid-cols-[22px_1fr_44px_38px_20px] items-center gap-x-1.5 rounded-md px-0.5 py-1 text-[0.6rem]"
            style={{ background: row.done ? `${ACCENT}1f` : "transparent" }}
          >
            <span className="font-bold text-muted-foreground">{row.set}</span>
            {/* A tier up from subtle: these rows carry a 12% wash of the accent
                when the set is done, and the quietest tier does not survive it. */}
            <span className="font-mono text-muted-foreground">{row.previous}</span>
            <span className="rounded border border-card-border bg-input-bg py-0.5 text-center font-mono text-foreground">{row.kg}</span>
            <span className="rounded border border-card-border bg-input-bg py-0.5 text-center font-mono text-foreground">{row.reps}</span>
            <CheckCircle2
              size={13}
              strokeWidth={2.5}
              className={row.done ? "track-ink" : "text-subtle-foreground"}
              style={trackInkVariables(ACCENT) as React.CSSProperties}
            />
          </div>
        ))}
        <span className="track-ink text-[0.55rem] font-semibold" style={trackInkVariables(ACCENT) as React.CSSProperties}>
          + Add set
        </span>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-card-border bg-card p-2.5">
        <span className="text-[0.68rem] font-bold text-foreground">Overhead press</span>
        <div className="flex gap-1.5">
          {[1, 2, 3].map((set) => (
            <span key={set} className="flex-1 rounded border border-card-border bg-input-bg py-1 text-center font-mono text-[0.55rem] text-muted-foreground">
              40 × 10
            </span>
          ))}
        </div>
      </div>

      <span className="mt-auto rounded-lg border border-card-border bg-surface-muted py-2 text-center text-[0.62rem] font-semibold text-foreground">
        + Add exercise
      </span>
    </div>
  );
}
