"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  BookMarked,
  CalendarDays,
  Check,
  ChevronDown,
  Flame,
  GitBranch,
  ListTodo,
  Milestone,
  MoreHorizontal,
  NotebookPen,
  Sun,
  TrendingUp,
} from "lucide-react";
import HorizonMark from "@/components/HorizonMark";
import StreakGrid, { type StreakCell } from "@/components/StreakGrid";
import { shadeOf, withAlpha } from "@/lib/colors";
import { formatDayMonthYear, parseYMD } from "@/lib/dates";
import type { PreviewTrack } from "./phoneData";
import {
  PREVIEW_TODAY,
  PREVIEW_TODAY_INDEX,
  PREVIEW_TRACKS,
  PREVIEW_WEEK,
  PREVIEW_WEEK_DATES,
} from "./phoneData";

/**
 * The dashboard, small and working.
 *
 * Not a drawing of the app: the same `StreakGrid`, the same colour maths, the
 * same three demo tracks the app will put in your workspace from Settings —
 * and the same behaviour where it matters. Switch tracks and the whole thing
 * takes that track's colour, exactly as the real one does, because both write
 * the same handful of CSS variables; here they are set on this card rather
 * than on the document, so the page around it is untouched.
 *
 * Enough of it responds to make the point that it is a tool rather than a
 * picture. It is deliberately not the whole app — there is nothing to type
 * into, and no state survives a reload.
 */
/**
 * The four numbers across the top, and what each one opens into.
 *
 * In the app every one of these is a button with a detail panel behind it, so
 * here they are too — four figures you cannot press is the clearest way to
 * tell someone they are looking at a picture.
 */
const METRICS: {
  label: string;
  icon?: React.ReactNode;
  of: (track: PreviewTrack) => { value: string; unit: string; ring?: number };
  detail: (track: PreviewTrack) => string;
}[] = [
  {
    label: "Streak",
    icon: <Flame size={11} strokeWidth={2.5} className="text-warning" />,
    of: (track) => ({ value: `${track.streak}`, unit: "days" }),
    detail: (track) =>
      `${track.streak} days in a row, and the longest run on this track is ${track.stats.longest}. A day counts once anything is ticked on it.`,
  },
  {
    label: "Timeline",
    of: (track) => ({
      value: `${track.dayOfTrack}`,
      unit: `/ ${track.timeline.totalDays}`,
      ring: track.pct,
    }),
    detail: (track) =>
      `Day ${track.dayOfTrack} of ${track.timeline.totalDays}, which is ${Math.round(track.pct)}% of the way to the date you set. ${track.timeline.daysRemaining} left.`,
  },
  {
    label: "Active",
    icon: <Check size={11} strokeWidth={2.5} className="text-accent" />,
    of: (track) => ({ value: `${track.stats.activeDays}`, unit: "days" }),
    detail: (track) => `${track.stats.activeDays} days with something on them since this track began.`,
  },
  {
    label: "Last 30",
    icon: <TrendingUp size={11} strokeWidth={2.5} className="text-accent" />,
    of: (track) => ({ value: `${track.stats.activeLast30}`, unit: "of 30" }),
    detail: (track) =>
      `${track.stats.activeLast30} of the last 30 days. The number that moves first when a habit slips, and the one worth watching.`,
  },
];

/** What a track's four phases are called before anyone renames them — which
 *  is what a new track actually arrives with. */
const PHASE_NAMES = ["Getting started", "Building the habit", "Going deeper", "Finishing it"];

export default function AppPreview() {
  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  /** Everything tickable, in one map keyed by track so switching and coming
   *  back does not forget what you ticked — which is what the app does. */
  const [done, setDone] = useState<Record<string, boolean>>({});
  /** Which day of the week is selected, as the Weekly Overview panel does. */
  const [day, setDay] = useState(PREVIEW_TODAY_INDEX);
  /** Which phase is current. Clicking one makes it current, as the app's
   *  phase timeline does. */
  const [phase, setPhase] = useState(1);
  const [phasesOpen, setPhasesOpen] = useState(false);
  /** Which of the four numbers has been opened, as the app's stat tiles do. */
  const [stat, setStat] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [todo, setTodo] = useState("");
  const [extraTodos, setExtraTodos] = useState<string[]>([]);
  const track = PREVIEW_TRACKS[index];
  const tick = (key: string) => setDone((current) => ({ ...current, [key]: !current[key] }));

  // The track's colour, scoped to this card. `--streak-0` is left alone: it is
  // the colour of a day with nothing on it, which belongs to the page.
  const palette = useMemo(
    () =>
      ({
        "--accent": track.color,
        "--accent-muted": withAlpha(track.color, 0.35),
        "--streak-1": shadeOf(track.color, 1, "transparent"),
        "--streak-2": shadeOf(track.color, 2, "transparent"),
        "--streak-3": shadeOf(track.color, 3, "transparent"),
        "--streak-4": shadeOf(track.color, 4, "transparent"),
      }) as CSSProperties,
    [track.color]
  );

  // The last four months of the year, which is as much as fits beside the
  // rest of the dashboard at this size.
  const months = track.months.slice(-4);
  const detail = openDay ? track.history[openDay] ?? [] : [];

  return (
    <div
      style={palette}
      className="glass-panel landing-preview select-none text-[0.68rem] leading-snug sm:text-[0.72rem]"
    >
      {/* ── The bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-card-border pb-2.5">
        <HorizonMark className="h-3 w-auto shrink-0 text-accent" />
        <span className="font-semibold tracking-tight">Horizon</span>
        <span className="text-card-border">|</span>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="flex cursor-pointer items-center gap-1.5 font-semibold text-accent"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: track.color }} />
            {track.name}
            <ChevronDown size={10} strokeWidth={2.5} className={`text-subtle-foreground transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>

          {menuOpen && (
            <div className="absolute left-0 top-[calc(100%+0.4rem)] z-20 w-[190px] overflow-hidden rounded-md border border-card-border bg-card shadow-[0_10px_25px_-5px_rgba(0,0,0,0.6)]">
              {PREVIEW_TRACKS.map((entry, entryIndex) => (
                <button
                  key={entry.id}
                  onClick={() => {
                    setIndex(entryIndex);
                    setMenuOpen(false);
                    setOpenDay(null);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: entry.color }} />
                  <span className="flex-1 truncate">{entry.name}</span>
                  <span className="font-mono text-[0.6rem] text-subtle-foreground">{entry.streak}d</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="ml-auto hidden items-center gap-1.5 text-subtle-foreground sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          On this device
        </span>
        <Sun size={11} strokeWidth={2} className="hidden text-subtle-foreground sm:block" />
        <MoreHorizontal size={11} strokeWidth={2} className="text-subtle-foreground" />
      </div>

      {/* ── The four numbers ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-1.5 pt-3 lg:grid-cols-4">
        {METRICS.map((metric) => {
          const shown = metric.of(track);
          return (
            <Metric
              key={metric.label}
              label={metric.label}
              value={shown.value}
              unit={shown.unit}
              icon={metric.icon}
              ring={shown.ring}
              open={stat === metric.label}
              onClick={() => setStat((current) => (current === metric.label ? null : metric.label))}
            />
          );
        })}
      </div>

      {/* What a number means, as the app's own stat tiles open into. */}
      {stat && (
        <div className="mt-1.5 flex items-start gap-2 rounded-[8px] border border-accent-muted bg-accent/[0.06] px-2.5 py-2">
          <span className="min-w-0 flex-1 text-[0.62rem] leading-snug text-muted-foreground">
            {METRICS.find((metric) => metric.label === stat)?.detail(track)}
          </span>
          <button onClick={() => setStat(null)} className="cursor-pointer text-subtle-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {/* ── The panels ────────────────────────────────────────────────── */}
      {/* `minmax(0, …)`, not a bare `fr`. An `fr` track has an automatic
          minimum of `auto`, so a column whose content does not fit pushes the
          grid wider than the card it is in — which is what broke this panel at
          every width between a phone and a desk. */}
      <div className="grid grid-cols-1 gap-2 pt-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <Panel icon={<CalendarDays size={10} strokeWidth={2.5} />} title="Weekly Overview">
            <div className="flex justify-between gap-0.5">
              {PREVIEW_WEEK.map((name, dayIndex) => {
                const today = dayIndex === PREVIEW_TODAY_INDEX;
                const picked = dayIndex === day;
                return (
                  <button
                    key={name}
                    onClick={() => setDay(dayIndex)}
                    className={`flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1 rounded-[5px] border px-0.5 py-1 transition-colors ${
                      picked ? "border-accent-muted bg-accent/[0.10]" : "border-transparent hover:bg-surface-hover"
                    }`}
                  >
                    <span className={`text-[0.58rem] font-semibold ${picked || today ? "text-foreground" : "text-subtle-foreground"}`}>
                      {name}
                    </span>
                    <span className="font-mono text-[0.5rem] text-subtle-foreground">{PREVIEW_WEEK_DATES[dayIndex]}</span>
                    <span
                      className="w-full truncate rounded-[3px] px-1 py-px text-center text-[0.5rem] font-semibold"
                      style={{
                        background: dayIndex > 4 ? "var(--surface-hover)" : withAlpha(track.color, 0.16),
                        color: dayIndex > 4 ? "var(--subtle-foreground)" : track.color,
                      }}
                    >
                      {track.focus[dayIndex]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* What that day asks of you, which is the second half of the
                real panel: pick a day and its checklist is right there. */}
            <div className="mt-1 flex flex-col gap-1 border-t border-card-border pt-1.5">
              <span className="text-[0.5rem] font-bold uppercase tracking-[0.08em] text-accent">
                {PREVIEW_WEEK[day]} · {track.focus[day]}
              </span>
              {track.deliverables.concat(track.materials[0]).slice(0, 3).map((item, itemIndex) => {
                const key = `${track.id}-${day}-${itemIndex}`;
                return <Tickable key={key} label={item} on={!!done[key]} onToggle={() => tick(key)} color={track.color} />;
              })}
            </div>
          </Panel>

          <Panel icon={<Flame size={10} strokeWidth={2.5} />} title="Consistency" trailing={`${track.streak} days`}>
            <div className="relative">
              {/* Scrolls rather than clips, as the real panel does: a month
                  cut in half at the card's edge looks like a mistake. */}
              <div
                className="flex gap-3 overflow-x-auto pb-0.5"
                style={{
                  maskImage: "linear-gradient(to right, #000 92%, transparent)",
                  WebkitMaskImage: "linear-gradient(to right, #000 92%, transparent)",
                }}
              >
                {months.map((month) => (
                  <div key={month.key} className="flex flex-col gap-1">
                    <span className="text-[0.55rem] font-semibold text-muted-foreground">{month.label.split(" ")[0]}</span>
                    <StreakGrid
                      cell={9}
                      onCellClick={(id) => setOpenDay((current) => (current === id ? null : id))}
                      cells={month.cells.map((day, cellIndex): StreakCell => {
                        if (!day) return { id: `${month.key}-pad-${cellIndex}`, level: 0, filled: false };
                        return {
                          id: day.date,
                          level: Math.min(4, day.count),
                          mark: day.date === track.startDate ? "start" : day.date === PREVIEW_TODAY ? "today" : undefined,
                          title: `${day.date}: ${day.count} update${day.count === 1 ? "" : "s"}`,
                        };
                      })}
                    />
                  </div>
                ))}
              </div>

              {openDay && (
                <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 rounded-md border border-accent-muted bg-card/95 p-2 shadow-[0_10px_25px_-8px_rgba(0,0,0,0.7)] backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{formatDayMonthYear(parseYMD(openDay))}</span>
                    <button onClick={() => setOpenDay(null)} className="cursor-pointer text-subtle-foreground hover:text-foreground">
                      ✕
                    </button>
                  </div>
                  {detail.length > 0 ? (
                    detail.slice(0, 3).map((item, itemIndex) => (
                      <span key={itemIndex} className="flex items-center gap-1.5 text-[0.62rem] text-muted-foreground">
                        <Check size={9} strokeWidth={3} className="shrink-0 text-accent" />
                        {typeof item === "string" ? item : item.title}
                      </span>
                    ))
                  ) : (
                    <span className="text-[0.62rem] italic text-subtle-foreground">Nothing logged on this day.</span>
                  )}
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Panel
            icon={<Milestone size={10} strokeWidth={2.5} />}
            title="Phases"
            action={{ label: phasesOpen ? "Hide" : "Phases", onClick: () => setPhasesOpen((open) => !open) }}
          >
            {/* The figure and the phase name open the list too — in the app
                this whole block is the way into the phase timeline, and a
                small link in the corner is a small target. */}
            <button
              onClick={() => setPhasesOpen((open) => !open)}
              className="flex w-full cursor-pointer items-baseline gap-2 text-left"
            >
              <span className="font-mono text-[1.15rem] font-bold leading-none text-accent">{Math.round(track.pct)}%</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{PHASE_NAMES[phase] ?? track.phase}</span>
            </button>
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-hover">
              <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${track.pct}%` }} />
            </div>

            {/* The four phases, and clicking one makes it current — which is
                what the timeline in the real panel does. */}
            {phasesOpen && (
              <div className="mt-1 flex flex-col gap-1 border-t border-card-border pt-1.5">
                {PHASE_NAMES.map((name, phaseIndex) => {
                  const state = phaseIndex < phase ? "done" : phaseIndex === phase ? "current" : "todo";
                  return (
                    <button
                      key={name}
                      onClick={() => setPhase(phaseIndex)}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-left transition-colors hover:bg-surface-hover"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          background: state === "todo" ? "var(--surface-hover)" : track.color,
                          boxShadow: state === "current" ? `0 0 0 3px ${withAlpha(track.color, 0.2)}` : undefined,
                        }}
                      />
                      <span className={`flex-1 truncate ${state === "todo" ? "text-subtle-foreground" : "text-muted-foreground"}`}>
                        {name}
                      </span>
                      <span className="font-mono text-[0.55rem] text-subtle-foreground">{(phaseIndex + 1) * 25}%</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel icon={<GitBranch size={10} strokeWidth={2.5} />} title="Deliverables">
            {track.deliverables.map((item) => {
              const key = `${track.id}-deliverable-${item}`;
              return <Tickable key={key} label={item} on={!!done[key]} onToggle={() => tick(key)} color={track.color} />;
            })}
          </Panel>

          <Panel icon={<BookMarked size={10} strokeWidth={2.5} />} title="Materials">
            {track.materials.map((item) => {
              const key = `${track.id}-material-${item}`;
              return <Tickable key={key} label={item} on={!!done[key]} onToggle={() => tick(key)} color={track.color} />;
            })}
          </Panel>

          <Panel icon={<ListTodo size={10} strokeWidth={2.5} />} title="To-do">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!todo.trim()) return;
                setExtraTodos((current) => [...current, todo.trim()]);
                setTodo("");
              }}
              className="flex gap-1"
            >
              <input
                value={todo}
                onChange={(event) => setTodo(event.target.value)}
                placeholder="Add a to-do…"
                className="min-w-0 flex-1 rounded border border-card-border bg-input-bg px-1.5 py-1 text-[0.62rem] text-foreground outline-none placeholder:text-subtle-foreground focus-visible:border-accent-muted"
              />
              <button
                type="submit"
                className="shrink-0 cursor-pointer rounded border border-card-border bg-surface-muted px-1.5 text-[0.6rem] font-semibold text-foreground transition-colors hover:border-accent-muted"
              >
                Add
              </button>
            </form>
            {track.todo.concat(extraTodos).map((item, itemIndex) => {
              const key = `${track.id}-todo-${itemIndex}-${item}`;
              return <Tickable key={key} label={item} on={!!done[key]} onToggle={() => tick(key)} color={track.color} />;
            })}
          </Panel>

          <Panel icon={<NotebookPen size={10} strokeWidth={2.5} />} title="Notepad">
            {/* A real field. Every other panel here does something when you
                touch it, and a notepad you cannot write in is the one that
                gives the game away. */}
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Jot it down here, sort it out later."
              className="w-full resize-none rounded border border-card-border bg-input-bg px-1.5 py-1 text-[0.62rem] leading-snug text-foreground outline-none placeholder:italic placeholder:text-subtle-foreground focus-visible:border-accent-muted"
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** A line with a box you can tick. The app has four of these panels and they
 *  all behave the same way, so this does too. */
function Tickable({
  label,
  on,
  onToggle,
  color,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full cursor-pointer items-center gap-1.5 text-left transition-colors hover:text-foreground"
    >
      <span
        className="flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border transition-colors"
        style={{ borderColor: on ? color : "var(--card-border-hover)", background: on ? color : "transparent" }}
      >
        {on && <Check size={8} strokeWidth={4} className="text-background" />}
      </span>
      <span className={`truncate ${on ? "text-subtle-foreground line-through" : "text-muted-foreground"}`}>{label}</span>
    </button>
  );
}

/** One of the four numbers across the top. */
function Metric({
  label,
  value,
  unit,
  icon,
  ring,
  open,
  onClick,
}: {
  label: string;
  value: string;
  unit: string;
  icon?: React.ReactNode;
  ring?: number;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={open}
      title={`${label} — click for detail`}
      className={`flex cursor-pointer items-center gap-2 rounded-[8px] border bg-card/60 px-2 py-1.5 text-left transition-colors hover:bg-surface-hover ${
        open ? "border-accent-muted bg-accent/[0.06]" : "border-card-border hover:border-card-border-hover"
      }`}
    >
      {ring !== undefined ? (
        <svg width={22} height={22} viewBox="0 0 22 22" className="shrink-0 -rotate-90" aria-hidden="true">
          <circle cx="11" cy="11" r="9" fill="none" stroke="var(--card-border)" strokeWidth="3" />
          <circle
            cx="11"
            cy="11"
            r="9"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 9}
            strokeDashoffset={2 * Math.PI * 9 * (1 - Math.min(100, ring) / 100)}
            style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>
      ) : (
        icon
      )}
      <span className="flex min-w-0 flex-col">
        <span className="text-[0.55rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        <span className="flex items-baseline gap-1">
          <span className="font-mono text-[0.9rem] font-bold leading-none">{value}</span>
          <span className="truncate text-[0.55rem] text-subtle-foreground">{unit}</span>
        </span>
      </span>
    </button>
  );
}

/** One panel of the dashboard, which lifts under the cursor the way the real
 *  ones do — the whole board is a set of cards on a glass shelf. */
function Panel({
  icon,
  title,
  trailing,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  trailing?: string;
  /** The small link some panels carry in their corner — "All four", "Hide". */
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div className="landing-mini-panel flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-accent">{icon}</span>
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</span>
        {trailing && <span className="ml-auto font-mono text-[0.58rem] text-accent">{trailing}</span>}
        {action && (
          <button
            onClick={action.onClick}
            className="ml-auto cursor-pointer text-[0.58rem] font-semibold text-accent transition-opacity hover:opacity-80"
          >
            {action.label}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
