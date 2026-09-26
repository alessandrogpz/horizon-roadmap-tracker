"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  BookMarked,
  CalendarDays,
  Check,
  ChevronDown,
  Flame,
  GitBranch,
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
export default function AppPreview() {
  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const track = PREVIEW_TRACKS[index];

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
      <div className="grid grid-cols-2 gap-1.5 pt-3 sm:grid-cols-4">
        <Metric label="Streak" value={`${track.streak}`} unit="days" icon={<Flame size={11} strokeWidth={2.5} className="text-warning" />} />
        <Metric label="Timeline" value={`${track.dayOfTrack}`} unit={`/ ${track.timeline.totalDays}`} ring={track.pct} />
        <Metric label="Active" value={`${track.stats.activeDays}`} unit="days" icon={<Check size={11} strokeWidth={2.5} className="text-accent" />} />
        <Metric label="Last 30" value={`${track.stats.activeLast30}`} unit="of 30" icon={<TrendingUp size={11} strokeWidth={2.5} className="text-accent" />} />
      </div>

      {/* ── The panels ────────────────────────────────────────────────── */}
      <div className="grid gap-2 pt-3 sm:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-2">
          <Panel icon={<CalendarDays size={10} strokeWidth={2.5} />} title="Weekly Overview">
            <div className="flex justify-between gap-0.5">
              {PREVIEW_WEEK.map((day, dayIndex) => {
                const today = dayIndex === PREVIEW_TODAY_INDEX;
                return (
                  <div
                    key={day}
                    className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[5px] border px-0.5 py-1 transition-colors ${
                      today ? "border-accent-muted bg-accent/[0.08]" : "border-transparent"
                    }`}
                  >
                    <span className={`text-[0.58rem] font-semibold ${today ? "text-foreground" : "text-subtle-foreground"}`}>{day}</span>
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
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel icon={<Flame size={10} strokeWidth={2.5} />} title="Consistency" trailing={`${track.streak} days`}>
            <div className="relative">
              <div className="flex gap-3 overflow-hidden">
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

        <div className="flex flex-col gap-2">
          <Panel icon={<Milestone size={10} strokeWidth={2.5} />} title="Phases">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[1.15rem] font-bold leading-none text-accent">{Math.round(track.pct)}%</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{track.phase}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-hover">
              <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${track.pct}%` }} />
            </div>
          </Panel>

          <Panel icon={<GitBranch size={10} strokeWidth={2.5} />} title="Deliverables">
            {track.deliverables.map((item) => {
              const key = `${track.id}-${item}`;
              const ticked = done[key];
              return (
                <button
                  key={item}
                  onClick={() => setDone((current) => ({ ...current, [key]: !current[key] }))}
                  className="flex w-full cursor-pointer items-center gap-1.5 text-left transition-colors hover:text-foreground"
                >
                  <span
                    className="flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border transition-colors"
                    style={{
                      borderColor: ticked ? track.color : "var(--card-border-hover)",
                      background: ticked ? track.color : "transparent",
                    }}
                  >
                    {ticked && <Check size={8} strokeWidth={4} className="text-background" />}
                  </span>
                  <span className={`truncate ${ticked ? "text-subtle-foreground line-through" : "text-muted-foreground"}`}>{item}</span>
                </button>
              );
            })}
          </Panel>

          <Panel icon={<BookMarked size={10} strokeWidth={2.5} />} title="Materials">
            {track.materials.map((item) => (
              <span key={item} className="truncate text-muted-foreground">
                {item}
              </span>
            ))}
          </Panel>

          <Panel icon={<NotebookPen size={10} strokeWidth={2.5} />} title="Notepad">
            <span className="italic text-subtle-foreground">Jot it down here, sort it out later.</span>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** One of the four numbers across the top. */
function Metric({
  label,
  value,
  unit,
  icon,
  ring,
}: {
  label: string;
  value: string;
  unit: string;
  icon?: React.ReactNode;
  ring?: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] border border-card-border bg-card/60 px-2 py-1.5 transition-colors hover:border-card-border-hover hover:bg-surface-hover">
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
    </div>
  );
}

/** One panel of the dashboard, which lifts under the cursor the way the real
 *  ones do — the whole board is a set of cards on a glass shelf. */
function Panel({
  icon,
  title,
  trailing,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  trailing?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="landing-mini-panel flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-accent">{icon}</span>
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</span>
        {trailing && <span className="ml-auto font-mono text-[0.58rem] text-accent">{trailing}</span>}
      </div>
      {children}
    </div>
  );
}
