"use client";

import { useEffect, useRef, useState } from "react";
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
import TrackYearStrip from "@/components/TrackYearStrip";
import { withAlpha } from "@/lib/colors";
import {
  PREVIEW_TODAY,
  PREVIEW_TODAY_INDEX,
  PREVIEW_TRACKS,
  PREVIEW_WEEK,
  PREVIEW_WEEK_DATES,
  type PreviewTrack,
} from "./phoneData";
import { trackAccentVariables, trackInkVariables } from "@/lib/trackAccent";

/**
 * The dashboard, small and still — with exactly one thing in it that works.
 *
 * Built from the app's own parts and the app's own demo data — the same
 * `StreakGrid`, the same `TrackYearStrip`, the same colour maths, the three
 * tracks Settings will put in your workspace — so it cannot drift into looking
 * like a different product.
 *
 * It was briefly a working copy of the whole thing: the tiles opened, the
 * boxes ticked, a rotation could be added. That was wrong, and it was taken
 * out. A visitor who ticks a box here and finds it does not save has been
 * misled about the one thing the page is for.
 *
 * Switching tracks is the exception, and it is the only one. It is the idea
 * the whole product rests on — one goal per track, and the app wearing that
 * track's colour while you are in it — and it is the one thing a still picture
 * genuinely cannot say: that the accent, the grid, the phase, the deliverables
 * and the week all change together. Nothing is saved, nothing is promised, and
 * every other control in here is still drawn rather than real.
 *
 * So `aria-hidden` moved off the card and onto the parts of it that are
 * pictures. The menu is a real control and reads as one; the panels are a
 * photograph, and a screen reader walking a photograph of an interface finds
 * nothing to do in it.
 */

export default function AppPreview() {
  const [track, setTrack] = useState<PreviewTrack>(PREVIEW_TRACKS[0]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const accent = track.color;
  /** The last four months of the year, which is as much as fits beside the
   *  rest of the dashboard at this size. */
  const months = track.months.slice(-4);

  /** The four numbers across the top, as the real header shows them. */
  const metrics = [
    { label: "Streak", icon: <Flame size={11} strokeWidth={2.5} className="text-warning" />, value: `${track.streak}`, unit: "days" },
    { label: "Timeline", value: `${track.dayOfTrack}`, unit: `/ ${track.timeline.totalDays}`, ring: track.pct },
    { label: "Active", icon: <Check size={11} strokeWidth={2.5} className="text-accent" />, value: `${track.stats.activeDays}`, unit: "days" },
    { label: "Last 30", icon: <TrendingUp size={11} strokeWidth={2.5} className="text-accent" />, value: `${track.stats.activeLast30}`, unit: "of 30" },
  ];

  return (
    <div
      // A scaled picture of the real interface — see TrackStackPreview for why
      // `data-ui` is here.
      data-ui
      // The same variables `components/TrackAccent.tsx` writes onto `<html>`
      // when a track is opened, scoped to this card instead. Without the four
      // streak steps the miniature's grid stayed the theme's green while the
      // rest of the card wore the track's colour — which is the one claim this
      // section of the page is making. `--streak-0`, the colour of a day with
      // nothing on it, belongs to the page and is deliberately left alone.
      style={
        trackAccentVariables(accent) as React.CSSProperties
      }
      className="glass-panel landing-preview select-none text-[0.68rem] leading-snug sm:text-[0.72rem]"
    >
      {/* ── The bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-card-border pb-2.5">
        <HorizonMark className="h-3 w-auto shrink-0 text-accent" aria-hidden="true" />
        <span aria-hidden="true" className="font-semibold tracking-tight">Horizon</span>
        <span aria-hidden="true" className="text-card-border">|</span>

        {/* The one real control on this page. */}
        <div ref={rootRef} className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={`Previewing ${track.name}. Switch to another track.`}
            className="flex cursor-pointer items-center gap-1.5 rounded border-none bg-transparent p-0 font-semibold text-accent hover:underline"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} aria-hidden="true" />
            {track.name}
            <ChevronDown
              size={10}
              strokeWidth={2.5}
              className={`text-subtle-foreground transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {/* The real switcher's menu, at this card's scale: a dot, a name, a
              streak and a year of days per row. */}
          {open && (
            <div className="absolute left-0 top-[calc(100%+0.4rem)] z-30 w-[220px] overflow-hidden rounded-md border border-card-border bg-card shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)]">
              {PREVIEW_TRACKS.map((option) => {
                const current = option.id === track.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => {
                      setTrack(option);
                      setOpen(false);
                    }}
                    aria-current={current}
                    className="relative flex w-full cursor-pointer flex-col gap-1.5 border-none border-b border-card-border bg-transparent px-2.5 py-2 text-left transition-colors last:border-b-0 hover:bg-surface-hover"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0"
                      style={{ background: option.color, opacity: current ? 0.12 : 0.04 }}
                    />
                    <span className="relative flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: option.color }} />
                      <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{option.name}</span>
                      <span
                        className="track-ink inline-flex shrink-0 items-center gap-0.5 font-mono text-[0.58rem] font-bold"
                        style={trackInkVariables(option.color) as React.CSSProperties}
                      >
                        <Flame size={8} strokeWidth={3} />
                        {option.streak}
                      </span>
                    </span>
                    <TrackYearStrip
                      className="relative"
                      days={option.days}
                      color={option.color}
                      cell={3}
                      gap={1}
                      pad={false}
                      start={option.startDate}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <span aria-hidden="true" className="ml-auto hidden items-center gap-1.5 text-subtle-foreground sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          On this device
        </span>
        <Sun size={11} strokeWidth={2} className="hidden text-subtle-foreground sm:block" aria-hidden="true" />
        <MoreHorizontal size={11} strokeWidth={2} className="text-subtle-foreground" aria-hidden="true" />
      </div>

      {/* Everything below here is a picture of the dashboard. It changes with
          the track above it and responds to nothing else. */}
      <div aria-hidden="true">
        {/* ── The four numbers ────────────────────────────────────────── */}
        {/* `minmax(0, …)`, not a bare `fr`, here and below: an `fr` track has an
            automatic minimum of `auto`, so a column whose content does not fit
            widens the grid past the card instead of shrinking itself. */}
        <div className="grid grid-cols-2 gap-1.5 pt-3 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-center gap-2 rounded-[8px] border border-card-border bg-card/60 px-2 py-1.5"
            >
              {metric.ring !== undefined ? (
                <svg width={22} height={22} viewBox="0 0 22 22" className="shrink-0 -rotate-90">
                  <circle cx="11" cy="11" r="9" fill="none" stroke="var(--card-border)" strokeWidth="3" />
                  <circle
                    cx="11"
                    cy="11"
                    r="9"
                    fill="none"
                    stroke={accent}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 9}
                    strokeDashoffset={2 * Math.PI * 9 * (1 - Math.min(100, metric.ring) / 100)}
                  />
                </svg>
              ) : (
                metric.icon
              )}
              <span className="flex min-w-0 flex-col">
                <span className="text-[0.58rem] text-subtle-foreground">
                  {metric.label}
                </span>
                <span className="flex items-baseline gap-1">
                  <span className="font-mono text-[0.9rem] font-bold leading-none">{metric.value}</span>
                  <span className="truncate text-[0.55rem] text-subtle-foreground">{metric.unit}</span>
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* ── The panels ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-2 pt-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-2">
            <Panel icon={<CalendarDays size={10} strokeWidth={2.5} />} title="Weekly Overview">
              <div className="flex justify-between gap-0.5">
                {PREVIEW_WEEK.map((name, index) => {
                  const today = index === PREVIEW_TODAY_INDEX;
                  return (
                    <div
                      key={name}
                      className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[5px] border px-0.5 py-1 ${
                        today ? "border-accent-muted bg-accent/[0.06]" : "border-transparent"
                      }`}
                    >
                      <span className={`text-[0.58rem] font-semibold ${today ? "text-foreground" : "text-subtle-foreground"}`}>
                        {name}
                      </span>
                      <span className="font-mono text-[0.5rem] text-subtle-foreground">{PREVIEW_WEEK_DATES[index]}</span>
                      <span
                        className={`w-full truncate rounded-[3px] px-1 py-px text-center text-[0.5rem] font-semibold ${
                          index > 4 ? "text-muted-foreground" : "track-ink"
                        }`}
                        style={
                          {
                            ...trackInkVariables(accent),
                            background: index > 4 ? "var(--surface-hover)" : withAlpha(accent, 0.16),
                          } as React.CSSProperties
                        }
                      >
                        {track.focus[index]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* What today asks of you, which is the second half of the real
                  panel: the day, and its checklist under it. */}
              <div className="mt-1 flex flex-col gap-1 border-t border-card-border pt-1.5">
                <span className="text-[0.58rem] font-semibold text-accent">
                  {PREVIEW_WEEK[PREVIEW_TODAY_INDEX]} · {track.focus[PREVIEW_TODAY_INDEX]}
                </span>
                {[...track.deliverables, track.materials[0]].slice(0, 3).map((item, index) => (
                  <Row key={item} label={item} done={index === 0} accent={accent} />
                ))}
              </div>
            </Panel>

            <Panel icon={<Flame size={10} strokeWidth={2.5} />} title="Consistency" trailing={`${track.streak} days`}>
              {/* Faded at the right rather than cut, so a month ending at the
                  card's edge is obviously deliberate. */}
              <div
                className="flex gap-3 overflow-hidden"
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
                      cells={month.cells.map((day, index): StreakCell => {
                        if (!day) return { id: `${month.key}-pad-${index}`, level: 0, filled: false };
                        return {
                          id: day.date,
                          level: Math.min(4, day.count),
                          mark:
                            day.date === track.startDate
                              ? "start"
                              : day.date === PREVIEW_TODAY
                                ? "today"
                                : undefined,
                        };
                      })}
                    />
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <Panel icon={<Milestone size={10} strokeWidth={2.5} />} title="Phases">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[1.15rem] font-bold leading-none text-accent">
                  {Math.round(track.pct)}%
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{track.phase}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-hover">
                <div className="h-full rounded-full bg-accent" style={{ width: `${track.pct}%` }} />
              </div>
            </Panel>

            <Panel icon={<GitBranch size={10} strokeWidth={2.5} />} title="Deliverables">
              {track.deliverables.map((item, index) => (
                <Row key={item} label={item} done={index === 0} accent={accent} />
              ))}
            </Panel>

            <Panel icon={<BookMarked size={10} strokeWidth={2.5} />} title="Materials">
              {track.materials.map((item) => (
                <Row key={item} label={item} done={false} accent={accent} />
              ))}
            </Panel>

            <Panel icon={<ListTodo size={10} strokeWidth={2.5} />} title="To-do">
              <div className="flex gap-1">
                <span className="min-w-0 flex-1 truncate rounded border border-card-border bg-input-bg px-1.5 py-1 text-[0.62rem] text-subtle-foreground">
                  Add a to-do…
                </span>
                <span className="shrink-0 rounded border border-card-border bg-surface-muted px-1.5 py-1 text-[0.6rem] font-semibold text-foreground">
                  Add
                </span>
              </div>
              {track.todo.map((item) => (
                <Row key={item} label={item} done={false} accent={accent} />
              ))}
            </Panel>

            <Panel icon={<NotebookPen size={10} strokeWidth={2.5} />} title="Notepad">
              <span className="rounded border border-card-border bg-input-bg px-1.5 py-1 text-[0.62rem] italic leading-snug text-subtle-foreground">
                Jot it down here, sort it out later.
              </span>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A line with a drawn box beside it. Drawn, not a control: the panel is a
 *  picture and a real checkbox would take tab focus and read as broken. */
function Row({ label, done, accent }: { label: string; done: boolean; accent: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border"
        style={{ borderColor: done ? accent : "var(--card-border-hover)", background: done ? accent : "transparent" }}
      >
        {done && <Check size={8} strokeWidth={4} className="text-background" />}
      </span>
      <span className={`truncate ${done ? "text-subtle-foreground line-through" : "text-muted-foreground"}`}>{label}</span>
    </span>
  );
}

/** One panel of the dashboard. */
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
        <span className="text-[0.68rem] font-semibold text-foreground">{title}</span>
        {trailing && <span className="ml-auto font-mono text-[0.58rem] text-accent">{trailing}</span>}
      </div>
      {children}
    </div>
  );
}
