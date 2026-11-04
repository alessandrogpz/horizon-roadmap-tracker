"use client";

import React, { useEffect } from "react";
import { CalendarRange, Flame, Milestone, TrendingUp, X } from "lucide-react";
import type { TrackState } from "@/lib/types";
import { formatDayMonthYear, parseYMD, todayYMD } from "@/lib/dates";
import {
  phaseStats,
  progressStats,
  streakCalendar,
  streakStats,
  timelineStats,
} from "@/lib/stats";
import StreakGrid, { type StreakCell } from "@/components/StreakGrid";

/** Which header tile was clicked. */
export type StatMetric = "streak" | "timeline" | "phase" | "progress";

const TITLES: Record<StatMetric, string> = {
  streak: "Current Streak",
  timeline: "Timeline",
  phase: "Phase Day",
  progress: "Progress",
};

const ICONS: Record<StatMetric, React.ReactNode> = {
  streak: <Flame size={18} strokeWidth={2} className="text-warning" />,
  timeline: <CalendarRange size={18} strokeWidth={2} className="text-accent" />,
  phase: <Milestone size={18} strokeWidth={2} className="text-accent" />,
  progress: <TrendingUp size={18} strokeWidth={2} className="text-accent" />,
};

// --- Shared bits -------------------------------------------------------

function Figure({ value, unit, hint }: { value: React.ReactNode; unit?: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="text-[2.4rem] font-bold font-mono leading-none text-foreground">{value}</span>
        {unit && <span className="text-[0.95rem] text-muted-foreground">{unit}</span>}
      </div>
      {hint && <span className="text-[0.8rem] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-inner)] border border-card-border bg-surface-muted px-3 py-2.5">
      <span className="text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground font-semibold">
        {label}
      </span>
      <span className={`text-[0.95rem] font-mono font-semibold ${tone || "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function Bar({ pct, tone = "bg-accent" }: { pct: number; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${tone}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="m-0 border-b border-card-border pb-1 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-accent">
        {title}
      </h4>
      {children}
    </div>
  );
}

const shade = (count: number) => (count === 0 ? 0 : count <= 1 ? 1 : count <= 2 ? 2 : count <= 3 ? 3 : 4);

// --- Per-metric bodies -------------------------------------------------

function StreakBody({ track }: { track: TrackState }) {
  const today = todayYMD();
  const stats = streakStats(track, today);
  const cells: StreakCell[] = streakCalendar(track, today).map((day, i) =>
    day.date
      ? {
          id: day.date,
          level: shade(day.count),
          title: `${day.date}: ${day.count} update${day.count === 1 ? "" : "s"}`,
        }
      : { id: `pad-${i}`, level: 0, filled: false }
  );

  return (
    <>
      <Figure
        value={stats.current}
        unit={stats.current === 1 ? "day running" : "days running"}
        hint={
          stats.current === 0
            ? "Nothing recorded yet today — tick anything off to start the count."
            : `Longest run so far: ${stats.longest} day${stats.longest === 1 ? "" : "s"}.`
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Longest" value={`${stats.longest}d`} />
        <Stat label="Active days" value={stats.activeDays} />
        <Stat label="Last 30 days" value={`${stats.activeLast30}/30`} />
        <Stat label="Consistency" value={`${Math.round(stats.consistencyPct)}%`} />
      </div>

      <Section title="Every day since you started">
        <StreakGrid cells={cells} />
        <span className="text-[0.8rem] text-subtle-foreground">
          {stats.totalAccomplishments} accomplishment
          {stats.totalAccomplishments === 1 ? "" : "s"} recorded across {stats.activeDays} day
          {stats.activeDays === 1 ? "" : "s"}.
        </span>
      </Section>

      {stats.recent.length > 0 && (
        <Section title="Most recent">
          <div className="flex flex-col gap-2">
            {stats.recent.map((day) => (
              <div
                key={day.date}
                className="flex flex-col gap-1 rounded-[var(--radius-inner)] border border-card-border bg-surface-muted px-3 py-2"
              >
                <span className="font-mono text-[0.7rem] text-accent">
                  {formatDayMonthYear(parseYMD(day.date))}
                </span>
                <span className="text-[0.8rem] leading-snug text-muted-foreground">
                  {day.titles.join(" · ")}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function TimelineBody({ track }: { track: TrackState }) {
  const stats = timelineStats(track);

  return (
    <>
      <Figure
        value={stats.daysPassed}
        unit={`of ${stats.totalDays} days`}
        hint={`${Math.round(stats.progressPct)}% of the horizon spent — ${stats.daysRemaining} day${
          stats.daysRemaining === 1 ? "" : "s"
        } left.`}
      />
      <Bar pct={stats.progressPct} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Started" value={formatDayMonthYear(stats.startDate)} />
        <Stat label="Horizon" value={formatDayMonthYear(stats.endDate)} />
        <Stat label="Remaining" value={`${stats.daysRemaining}d`} />
        <Stat label="Week" value={Math.ceil(stats.daysPassed / 7)} />
      </div>

      <Section title="Phases across the horizon">
        <div className="flex flex-col gap-2.5">
          {stats.windows.map((w) => (
            <div key={w.phase.id} className="flex items-center gap-3">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  w.state === "done"
                    ? "bg-success"
                    : w.state === "current"
                      ? "bg-accent ring-4 ring-accent/20"
                      : "border border-card-border-hover bg-surface-hover"
                }`}
              />
              <span
                className={`truncate text-[0.85rem] ${
                  w.state === "upcoming" ? "text-subtle-foreground" : "text-foreground"
                }`}
              >
                {w.phase.title}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[0.7rem] text-subtle-foreground">
                {w.endDay !== undefined ? `Days ${w.startDay}–${w.endDay}` : `From day ${w.startDay}`}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function PhaseBody({ track }: { track: TrackState }) {
  const stats = phaseStats(track, todayYMD());

  if (!stats.phase) {
    return <p className="m-0 text-[0.95rem] text-muted-foreground">This track has no phases yet.</p>;
  }

  return (
    <>
      <Figure
        value={stats.dayInPhase}
        unit={stats.dayInPhase === 1 ? "day in this phase" : "days in this phase"}
        hint={stats.phase.title}
      />

      {stats.phasePct !== undefined && <Bar pct={stats.phasePct} />}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Phase" value={`0${stats.phase.id}`} />
        <Stat
          label="Due by"
          value={stats.window?.endDate ? formatDayMonthYear(stats.window.endDate) : "Open-ended"}
        />
        <Stat
          label="Days left"
          value={stats.daysLeft !== undefined ? `${stats.daysLeft}d` : "—"}
          tone={stats.daysLeft === 0 ? "text-warning" : ""}
        />
        <Stat label="Tasks" value={`${stats.tasksDone}/${stats.tasksTotal}`} />
      </div>

      {stats.behindBy > 0 && stats.recommendedPhase && (
        <div className="rounded-[var(--radius-inner)] border border-warning/40 bg-warning/[0.07] px-3 py-2.5 text-[0.8rem] leading-snug text-foreground">
          By the schedule you&apos;d be on{" "}
          <strong className="font-semibold">
            phase 0{stats.recommendedPhase.id} — {stats.recommendedPhase.title}
          </strong>{" "}
          by now. Switch phases from the Roadmap Timeline when you&apos;re ready.
        </div>
      )}

      {stats.phase.description && (
        <Section title="What this phase is for">
          <p className="m-0 text-[0.85rem] leading-relaxed text-muted-foreground">
            {stats.phase.description}
          </p>
        </Section>
      )}

      {stats.tasksTotal > 0 && (
        <Section title={`Tasks — ${stats.tasksDone} of ${stats.tasksTotal} done`}>
          <div className="task-group">
            {stats.phase.tasks.map((task) => (
              <div key={task.id} className={`task-item ${task.completed ? "completed" : ""}`}>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    task.completed ? "bg-success" : "bg-surface-hover"
                  }`}
                />
                <span className="task-label">{task.title}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function ProgressBody({ track }: { track: TrackState }) {
  const stats = progressStats(track);
  const ahead = stats.paceDelta >= 0;

  return (
    <>
      <Figure
        value={`${Math.round(stats.workPct)}%`}
        unit="of the work done"
        hint={`${Math.round(stats.timePct)}% of the time is spent — you're ${Math.abs(
          Math.round(stats.paceDelta)
        )} point${Math.abs(Math.round(stats.paceDelta)) === 1 ? "" : "s"} ${
          ahead ? "ahead of" : "behind"
        } the calendar.`}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">
          <span className="font-semibold">Work completed</span>
          <span className="font-mono">{Math.round(stats.workPct)}%</span>
        </div>
        <Bar pct={stats.workPct} tone={ahead ? "bg-success" : "bg-accent"} />
        <div className="flex items-center justify-between text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">
          <span className="font-semibold">Time spent</span>
          <span className="font-mono">{Math.round(stats.timePct)}%</span>
        </div>
        <Bar pct={stats.timePct} tone="bg-muted-foreground" />
      </div>

      <Section title="Where that comes from">
        <div className="flex flex-col gap-3">
          {stats.breakdown.map((part) => (
            <div key={part.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[0.85rem] text-foreground">{part.label}</span>
                <span className="font-mono text-[0.8rem] text-muted-foreground">
                  {part.total > 0 ? `${part.done}/${part.total}` : "none yet"}
                </span>
              </div>
              <Bar pct={part.pct} tone={part.pct >= 100 ? "bg-success" : "bg-accent"} />
            </div>
          ))}
        </div>
        <span className="text-[0.8rem] leading-snug text-subtle-foreground">
          Only the rows that actually hold items count toward the total, so a track with no
          deliverables isn&apos;t capped below 100%.
        </span>
      </Section>
    </>
  );
}

// --- Shell -------------------------------------------------------------

export default function StatDetailModal({
  metric,
  track,
  onClose,
}: {
  metric: StatMetric;
  track: TrackState;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="modal-overlay fixed inset-0 z-[1000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={TITLES[metric]}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel relative flex max-h-[90vh] w-full max-w-[620px] flex-col gap-5 overflow-y-auto border-accent-muted"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <div className="flex items-center gap-2.5 pr-8">
          {ICONS[metric]}
          <h3 className="m-0 text-[1.1rem] font-semibold text-foreground">{TITLES[metric]}</h3>
          <span className="ml-auto truncate font-mono text-[0.7rem] text-subtle-foreground">
            {track.meta.name}
          </span>
        </div>

        {metric === "streak" && <StreakBody track={track} />}
        {metric === "timeline" && <TimelineBody track={track} />}
        {metric === "phase" && <PhaseBody track={track} />}
        {metric === "progress" && <ProgressBody track={track} />}
      </div>
    </div>
  );
}
