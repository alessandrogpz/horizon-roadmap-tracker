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
import { withAlpha } from "@/lib/colors";
import {
  PREVIEW_TODAY,
  PREVIEW_TODAY_INDEX,
  PREVIEW_TRACK,
  PREVIEW_WEEK,
  PREVIEW_WEEK_DATES,
} from "./phoneData";

/**
 * The dashboard, small and still.
 *
 * Built from the app's own parts and the app's own demo data — the same
 * `StreakGrid`, the same colour maths, one of the three tracks Settings will
 * put in your workspace — so it cannot drift into looking like a different
 * product. What it is not is a working copy of the app.
 *
 * It was one, briefly: the tiles opened, the boxes ticked, the track menu
 * switched colours. It read as a promise the page could not keep. A visitor
 * who ticks a box here and finds it does not save has been misled about
 * something, and the thing they have been misled about is the only thing this
 * page is for. So nothing in here responds, and nothing in here looks as
 * though it would: no hover states, no cursors, no controls — just the shape
 * of the thing, which is what a screenshot is.
 *
 * `aria-hidden`, for the same reason. It is a picture of an interface, and a
 * screen reader walking a picture of an interface finds nothing to do in it.
 */

const ACCENT = PREVIEW_TRACK.color;

/** The four numbers across the top, as the real header shows them. */
const METRICS = [
  {
    label: "Streak",
    icon: <Flame size={11} strokeWidth={2.5} className="text-warning" />,
    value: `${PREVIEW_TRACK.streak}`,
    unit: "days",
  },
  {
    label: "Timeline",
    value: `${PREVIEW_TRACK.dayOfTrack}`,
    unit: `/ ${PREVIEW_TRACK.timeline.totalDays}`,
    ring: PREVIEW_TRACK.pct,
  },
  {
    label: "Active",
    icon: <Check size={11} strokeWidth={2.5} className="text-accent" />,
    value: `${PREVIEW_TRACK.stats.activeDays}`,
    unit: "days",
  },
  {
    label: "Last 30",
    icon: <TrendingUp size={11} strokeWidth={2.5} className="text-accent" />,
    value: `${PREVIEW_TRACK.stats.activeLast30}`,
    unit: "of 30",
  },
];

/** The last four months of the year, which is as much as fits beside the rest
 *  of the dashboard at this size. */
const MONTHS = PREVIEW_TRACK.months.slice(-4);

export default function AppPreview() {
  return (
    <div
      aria-hidden="true"
      style={{ "--accent": ACCENT } as React.CSSProperties}
      className="glass-panel landing-preview select-none text-[0.68rem] leading-snug sm:text-[0.72rem]"
    >
      {/* ── The bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-card-border pb-2.5">
        <HorizonMark className="h-3 w-auto shrink-0 text-accent" />
        <span className="font-semibold tracking-tight">Horizon</span>
        <span className="text-card-border">|</span>
        <span className="flex items-center gap-1.5 font-semibold text-accent">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />
          {PREVIEW_TRACK.name}
          <ChevronDown size={10} strokeWidth={2.5} className="text-subtle-foreground" />
        </span>
        <span className="ml-auto hidden items-center gap-1.5 text-subtle-foreground sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          On this device
        </span>
        <Sun size={11} strokeWidth={2} className="hidden text-subtle-foreground sm:block" />
        <MoreHorizontal size={11} strokeWidth={2} className="text-subtle-foreground" />
      </div>

      {/* ── The four numbers ──────────────────────────────────────────── */}
      {/* `minmax(0, …)`, not a bare `fr`, here and below: an `fr` track has an
          automatic minimum of `auto`, so a column whose content does not fit
          widens the grid past the card instead of shrinking itself. */}
      <div className="grid grid-cols-2 gap-1.5 pt-3 lg:grid-cols-4">
        {METRICS.map((metric) => (
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
                  stroke={ACCENT}
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
              <span className="text-[0.55rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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

      {/* ── The panels ────────────────────────────────────────────────── */}
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
                      today ? "border-accent-muted bg-accent/[0.10]" : "border-transparent"
                    }`}
                  >
                    <span className={`text-[0.58rem] font-semibold ${today ? "text-foreground" : "text-subtle-foreground"}`}>
                      {name}
                    </span>
                    <span className="font-mono text-[0.5rem] text-subtle-foreground">{PREVIEW_WEEK_DATES[index]}</span>
                    <span
                      className="w-full truncate rounded-[3px] px-1 py-px text-center text-[0.5rem] font-semibold"
                      style={{
                        background: index > 4 ? "var(--surface-hover)" : withAlpha(ACCENT, 0.16),
                        color: index > 4 ? "var(--subtle-foreground)" : ACCENT,
                      }}
                    >
                      {PREVIEW_TRACK.focus[index]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* What today asks of you, which is the second half of the real
                panel: the day, and its checklist under it. */}
            <div className="mt-1 flex flex-col gap-1 border-t border-card-border pt-1.5">
              <span className="text-[0.5rem] font-bold uppercase tracking-[0.08em] text-accent">
                {PREVIEW_WEEK[PREVIEW_TODAY_INDEX]} · {PREVIEW_TRACK.focus[PREVIEW_TODAY_INDEX]}
              </span>
              {[...PREVIEW_TRACK.deliverables, PREVIEW_TRACK.materials[0]].slice(0, 3).map((item, index) => (
                <Row key={item} label={item} done={index === 0} />
              ))}
            </div>
          </Panel>

          <Panel icon={<Flame size={10} strokeWidth={2.5} />} title="Consistency" trailing={`${PREVIEW_TRACK.streak} days`}>
            {/* Faded at the right rather than cut, so a month ending at the
                card's edge is obviously deliberate. */}
            <div
              className="flex gap-3 overflow-hidden"
              style={{
                maskImage: "linear-gradient(to right, #000 92%, transparent)",
                WebkitMaskImage: "linear-gradient(to right, #000 92%, transparent)",
              }}
            >
              {MONTHS.map((month) => (
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
                          day.date === PREVIEW_TRACK.startDate
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
                {Math.round(PREVIEW_TRACK.pct)}%
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{PREVIEW_TRACK.phase}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-hover">
              <div className="h-full rounded-full bg-accent" style={{ width: `${PREVIEW_TRACK.pct}%` }} />
            </div>
          </Panel>

          <Panel icon={<GitBranch size={10} strokeWidth={2.5} />} title="Deliverables">
            {PREVIEW_TRACK.deliverables.map((item, index) => (
              <Row key={item} label={item} done={index === 0} />
            ))}
          </Panel>

          <Panel icon={<BookMarked size={10} strokeWidth={2.5} />} title="Materials">
            {PREVIEW_TRACK.materials.map((item) => (
              <Row key={item} label={item} done={false} />
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
            {PREVIEW_TRACK.todo.map((item) => (
              <Row key={item} label={item} done={false} />
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
  );
}

/** A line with a drawn box beside it. Drawn, not a control: the panel is a
 *  picture and a real checkbox would take tab focus and read as broken. */
function Row({ label, done }: { label: string; done: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border"
        style={{ borderColor: done ? ACCENT : "var(--card-border-hover)", background: done ? ACCENT : "transparent" }}
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
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</span>
        {trailing && <span className="ml-auto font-mono text-[0.58rem] text-accent">{trailing}</span>}
      </div>
      {children}
    </div>
  );
}
