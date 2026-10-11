"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BookMarked,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  GitBranch,
  ListTodo,
  Milestone,
  Moon,
} from "lucide-react";
import type { TrackState } from "@/lib/types";
import { formatDayMonthYear, parseYMD, todayYMD } from "@/lib/dates";
import { marksRestDay } from "@/lib/restDays";
import { yearsWithHistory } from "@/lib/stats";
import {
  masterCalendar,
  masterDeliverables,
  masterMaterials,
  masterMonths,
  masterPhases,
  masterRestOn,
  masterRestWeekdays,
  masterStart,
  masterStreak,
  masterWeek,
} from "@/lib/masterTrack";
import { useAppSettings } from "@/lib/useAppSettings";
import { parseTodos, todoNoteId, type TodoItem } from "@/lib/quickNotes";
import { readNote } from "@/lib/notes";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import AllTracksYear from "@/components/AllTracksYear";
import MasterGrid from "./MasterGrid";

/**
 * The master view's panels: the same shapes the dashboard draws for one track,
 * built from several and carrying each one's colour back with them.
 *
 * None of them takes a change handler, and that is the point. The master view
 * is read-only by construction rather than by a flag somebody can forget to
 * check — there is no master track to write to, so there is nothing for an
 * editor to edit. Everything here goes through the aggregation in
 * `lib/masterTrack.ts`, which only ever reads.
 */

/** The chip that says which track a row belongs to. Everywhere, on every row:
 *  an aggregate whose rows all look alike is a list you cannot read. */
export function TrackChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-px text-[0.62rem] font-semibold"
      style={{ color, background: "var(--surface-hover)" }}
      title={name}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="max-w-[9rem] truncate">{name}</span>
    </span>
  );
}

function PanelShell({
  icon,
  title,
  trailing,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title !mb-0">
          {icon}
          {title}
        </h2>
        {trailing}
      </div>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[0.85rem] italic text-muted-foreground">{children}</p>;
}

// --- The week ----------------------------------------------------------

/**
 * Seven days, each holding what every track asks of it.
 *
 * A single track's week card has room for its checklists; this one has seven
 * columns and up to six tracks in each, so it carries the one thing that is
 * genuinely per-track-per-day — what the track calls the day, and what its
 * rotations put on it — and nothing else.
 */
export function MasterWeekPanel({
  tracks,
  weekOffset,
  setWeekOffset,
}: {
  tracks: TrackState[];
  weekOffset: number;
  setWeekOffset: (offset: number) => void;
}) {
  const today = todayYMD();
  const days = useMemo(() => masterWeek(tracks, weekOffset), [tracks, weekOffset]);

  return (
    <PanelShell
      icon={<CalendarDays size={14} strokeWidth={2.5} className="section-icon" />}
      title="Weekly Overview"
      trailing={
        <div className="flex items-center gap-1 pr-16">
          <WeekStep direction={-1} onClick={() => setWeekOffset(weekOffset - 1)} />
          <span className="min-w-[5.5rem] text-center font-mono text-[0.78rem] font-semibold text-foreground">
            {weekOffset === 0 ? "This week" : weekOffset > 0 ? `+${weekOffset} week${weekOffset === 1 ? "" : "s"}` : `${weekOffset} week${weekOffset === -1 ? "" : "s"}`}
          </span>
          <WeekStep direction={1} onClick={() => setWeekOffset(weekOffset + 1)} />
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="ml-1 cursor-pointer rounded border-none bg-accent px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.03em] text-black"
            >
              Today
            </button>
          )}
        </div>
      }
    >
      <div className="week-grid-scroll">
        <div className="week-grid">
          {days.map((day) => {
            const isToday = day.date === today;
            return (
              <div
                key={day.name}
                className={`day-card flex min-h-[150px] flex-col gap-2 overflow-hidden rounded-lg px-2 py-2.5 ${
                  isToday ? "border border-accent bg-accent/[0.06]" : "border border-card-border bg-input-bg"
                }`}
              >
                <div className="day-card-head day-card-when border-b border-card-border pb-1 text-center">
                  <span className={`text-[0.7rem] uppercase tracking-[0.05em] ${isToday ? "font-bold text-foreground" : "font-semibold text-muted-foreground"}`}>
                    {day.name}
                  </span>
                  <span className="day-card-date block font-mono text-[0.58rem] text-subtle-foreground">{day.date.slice(5)}</span>
                </div>

                {/* No colour dot beside the label: the label is already in
                    the track's colour, and at seven columns a dot is two
                    points of width that the words need more. The name of the
                    track is in the tooltip, where a reader who cannot tell
                    two colours apart can get at it. */}
                {day.entries.map((entry) => (
                  <div key={entry.track.id} className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-start gap-1">
                      <span
                        className="min-w-0 flex-1 break-words text-[0.6rem] font-semibold uppercase leading-[1.25] tracking-[0.02em]"
                        style={{ color: entry.track.color }}
                        title={`${entry.track.name}: ${entry.label}`}
                      >
                        {entry.label}
                      </span>
                      {entry.rest && (
                        <Moon
                          size={9}
                          strokeWidth={2.5}
                          className="mt-px shrink-0 text-subtle-foreground"
                          aria-label="a day off"
                        />
                      )}
                    </span>
                    {entry.rotations.map((rotation) => (
                      <span
                        key={`${rotation.label}-${rotation.title}`}
                        className="day-item-title break-words text-[0.66rem] leading-[1.3] text-muted-foreground"
                        title={`${entry.track.name} · ${rotation.label}: ${rotation.title}`}
                      >
                        {rotation.title}
                      </span>
                    ))}
                  </div>
                ))}
                {day.entries.length === 0 && <Empty>No tracks selected.</Empty>}
              </div>
            );
          })}
        </div>
      </div>
    </PanelShell>
  );
}

function WeekStep({ direction, onClick }: { direction: -1 | 1; onClick: () => void }) {
  const Icon = direction === -1 ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={direction === -1 ? "Previous week" : "Next week"}
      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-card-border bg-surface-muted text-muted-foreground transition-colors hover:text-foreground"
    >
      <Icon size={13} strokeWidth={2.5} />
    </button>
  );
}

// --- Consistency -------------------------------------------------------

const SHAPES = [
  { value: "months", label: "By month" },
  { value: "continuous", label: "Continuous" },
] as const;

/**
 * The two ways of looking at several tracks' days at once.
 *
 * `rows` keeps them apart — one strip per track, the same calendar columns on
 * every row, so the same Tuesday is the same column everywhere and one
 * track's summer can be read against another's. It is the default because it
 * is the one that answers "how is each of them going".
 *
 * `one` puts them in the same squares, each day divided into a band per track
 * that did something on it. That answers the other question — "did I do
 * anything at all that day" — which rows make you scan a column for.
 *
 * These used to be in two different places: rows lived behind a toggle inside
 * a single track's panel, which is a strange home for a view about every
 * track, and the divided grid only existed here. A track's own panel now
 * shows that track and nothing else, and both ways of seeing all of them live
 * together where the question belongs.
 */
const LAYOUTS = [
  { value: "rows", label: "One per track" },
  { value: "one", label: "All in one" },
] as const;

export function MasterConsistencyPanel({ tracks }: { tracks: TrackState[] }) {
  const settings = useAppSettings();
  const today = todayYMD();
  const [byMonth, setByMonth] = useState(true);
  const [layout, setLayout] = useState<(typeof LAYOUTS)[number]["value"]>("rows");
  const [year, setYear] = useState(() => parseYMD(today).getFullYear());

  const rest = useMemo(() => masterRestOn(tracks), [tracks]);
  // Whether a key is worth drawing — a standing question, not a dated one.
  const everRests = useMemo(() => masterRestWeekdays(tracks).size > 0, [tracks]);
  // The earliest day any selected track existed for: before it, there was
  // nothing to take off.
  const earliest = useMemo(() => masterStart(tracks), [tracks]);
  const isRest = useMemo(
    () => (date: string) => marksRestDay(date, rest, today, earliest),
    [earliest, rest, today]
  );
  const days = useMemo(() => masterCalendar(tracks, year, today, settings.weekStartsOn), [settings.weekStartsOn, today, tracks, year]);
  const months = useMemo(() => masterMonths(tracks, year, today, settings.weekStartsOn), [settings.weekStartsOn, today, tracks, year]);
  const stats = useMemo(() => masterStreak(tracks, today), [today, tracks]);
  const years = useMemo(() => {
    const start = masterStart(tracks);
    const history = Object.fromEntries(
      tracks.flatMap((track) => Object.keys(track.completedItemsHistory ?? {})).map((date) => [date, []])
    );
    return yearsWithHistory(history, start, today);
  }, [today, tracks]);

  // Both shapes open at the recent end, and again whenever the panel changes
  // width — the same two effects the single-track graph needs, for the same
  // reasons: a year runs left to right and the question is about now.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, [byMonth, days.length, layout, months.length, year]);

  const lastWidth = useRef(0);
  useEffect(() => {
    const node = scroller.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (node.clientWidth === lastWidth.current) return;
      lastWidth.current = node.clientWidth;
      node.scrollLeft = node.scrollWidth;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [byMonth, layout]);

  return (
    <PanelShell
      icon={<Activity size={14} strokeWidth={2.5} className="section-icon" />}
      title="Consistency"
      trailing={
        <div className="flex items-center gap-3 pr-16 font-mono text-[0.75rem]">
          <span className="inline-flex items-center gap-1 font-semibold text-warning">
            <Flame size={13} strokeWidth={2} />
            {stats.current} day{stats.current === 1 ? "" : "s"}
          </span>
          <span className="text-muted-foreground">{stats.activeDays} active</span>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-[var(--radius-control)] border border-card-border bg-surface-muted p-0.5">
          {LAYOUTS.map((option) => {
            const on = option.value === layout;
            return (
              <button
                key={option.value}
                onClick={() => setLayout(option.value)}
                aria-pressed={on}
                className={`cursor-pointer rounded-[calc(var(--radius-control)-2px)] px-2.5 py-1 text-[0.72rem] font-semibold transition-colors ${
                  on ? "bg-card text-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {/* By month or continuous is a question about one grid, so it only
            applies to the combined one. A row per track is always a ribbon —
            that is what makes the rows comparable. */}
        {layout === "one" && (
        <div className="flex rounded-[var(--radius-control)] border border-card-border bg-surface-muted p-0.5">
          {SHAPES.map((shape) => {
            const on = (shape.value === "months") === byMonth;
            return (
              <button
                key={shape.value}
                onClick={() => setByMonth(shape.value === "months")}
                aria-pressed={on}
                className={`cursor-pointer rounded-[calc(var(--radius-control)-2px)] px-2.5 py-1 text-[0.72rem] font-semibold transition-colors ${
                  on ? "bg-card text-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {shape.label}
              </button>
            );
          })}
        </div>
        )}

        <div className="flex items-center gap-1">
          <YearStep direction={-1} disabled={year <= years.first} onClick={() => setYear(year - 1)} />
          <span className="min-w-[3.2rem] text-center font-mono text-[0.78rem] font-bold text-foreground">{year}</span>
          <YearStep direction={1} disabled={year >= years.last} onClick={() => setYear(year + 1)} />
        </div>
      </div>

      {layout === "rows" ? (
        // Its own scroller, with the track names pinned outside it. Nested in
        // the one below, the names would slide away with the years and the
        // rows would stop saying whose they are.
        <div className="py-1">
          <AllTracksYear tracks={tracks} year={year} today={today} weekStartsOn={settings.weekStartsOn} />
        </div>
      ) : (
        <div ref={scroller} className="-mx-1 overflow-x-auto px-1 py-1">
          {byMonth ? (
            <div className="flex w-max gap-5">
              {months.map((month) => (
                <div key={month.key} className="flex flex-col gap-1.5">
                  <span className="text-[0.68rem] font-semibold text-muted-foreground">{month.label}</span>
                  <MasterGrid days={month.cells} today={today} isRest={isRest} />
                </div>
              ))}
              {months.length === 0 && <Empty>Nothing recorded in {year}.</Empty>}
            </div>
          ) : (
            <MasterGrid days={days} today={today} isRest={isRest} />
          )}
        </div>
      )}

      {/* The key: which colour is whose. Only for the combined grid — the
          rows carry their own names down the side, and repeating them under
          the chart says nothing twice. */}
      {layout === "one" && (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.68rem] text-subtle-foreground">
        {tracks.map((track) => (
          <span key={track.meta.id} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: track.meta.color }} />
            {track.meta.name}
          </span>
        ))}
        {everRests && (
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-2.5 w-2.5 items-center justify-center rounded-[2px]" style={{ background: "var(--streak-0)" }}>
              <span className="block h-1 w-1 rounded-full" style={{ background: "var(--subtle-foreground)" }} />
            </span>
            day off everywhere
          </span>
        )}
      </div>
      )}
    </PanelShell>
  );
}

function YearStep({ direction, disabled, onClick }: { direction: -1 | 1; disabled: boolean; onClick: () => void }) {
  const Icon = direction === -1 ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === -1 ? "Previous year" : "Next year"}
      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-card-border bg-surface-muted text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon size={13} strokeWidth={2.5} />
    </button>
  );
}

// --- Phases ------------------------------------------------------------

/**
 * Every track's phases on one timeline, in the order they happen.
 *
 * Ordered by date rather than grouped by track, because the question is "what
 * is running now and what is next" — which is a question about the calendar.
 * The rule on the left edge is the track's colour, so a run of one track's
 * phases still reads as a run.
 */
export function MasterPhasesPanel({ tracks }: { tracks: TrackState[] }) {
  const windows = useMemo(() => masterPhases(tracks), [tracks]);
  const [showPast, setShowPast] = useState(false);
  const past = windows.filter((w) => w.state === "done").length;
  const shown = showPast ? windows : windows.filter((w) => w.state !== "done");

  return (
    <PanelShell
      icon={<Milestone size={14} strokeWidth={2.5} className="section-icon" />}
      title="Phases"
      trailing={
        past > 0 ? (
          <button
            onClick={() => setShowPast((v) => !v)}
            className="cursor-pointer rounded-[var(--radius-control)] border border-card-border bg-surface-muted px-2.5 py-1 text-[0.72rem] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPast ? "Hide finished" : `Show ${past} finished`}
          </button>
        ) : undefined
      }
    >
      {shown.length === 0 && <Empty>No phases on the selected tracks.</Empty>}
      <div className="flex flex-col gap-2">
        {shown.map((window) => (
          <div
            key={`${window.track.id}-${window.phase.id}`}
            className="flex flex-col gap-1 rounded-md border border-card-border bg-input-bg px-3 py-2"
            style={{ borderLeft: `3px solid ${window.track.color}` }}
          >
            <span className="flex flex-wrap items-center gap-2">
              <TrackChip name={window.track.name} color={window.track.color} />
              <span className="min-w-0 flex-1 truncate text-[0.88rem] font-semibold text-foreground">
                {window.phase.title}
              </span>
              {window.state === "current" && (
                <span className="shrink-0 rounded px-1.5 py-px text-[0.6rem] font-bold uppercase tracking-[0.05em] text-accent" style={{ background: "var(--surface-hover)" }}>
                  Now
                </span>
              )}
            </span>
            <span className="font-mono text-[0.68rem] text-subtle-foreground">
              {formatDayMonthYear(window.startDate)}
              {window.endDate ? ` → ${formatDayMonthYear(window.endDate)}` : " → no deadline"}
            </span>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

// --- The two lists -----------------------------------------------------

export function MasterDeliverablesPanel({ tracks }: { tracks: TrackState[] }) {
  const rows = useMemo(() => masterDeliverables(tracks), [tracks]);
  const done = rows.filter((row) => row.item.completed).length;

  return (
    <PanelShell
      icon={<GitBranch size={14} strokeWidth={2.5} className="section-icon" />}
      title="Deliverables"
      trailing={
        rows.length > 0 ? (
          <span className="pr-16 font-mono text-[0.75rem] text-muted-foreground">
            {done} / {rows.length}
          </span>
        ) : undefined
      }
    >
      {rows.length === 0 && <Empty>Nothing to deliver on the selected tracks.</Empty>}
      <div className="flex flex-col gap-1.5">
        {rows.map(({ track, item }) => (
          <span key={`${track.id}-${item.id}`} className="flex items-center gap-2">
            <span
              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border"
              style={{
                borderColor: item.completed ? track.color : "var(--card-border-hover)",
                background: item.completed ? track.color : "transparent",
              }}
            />
            <span className={`min-w-0 flex-1 truncate text-[0.85rem] ${item.completed ? "text-subtle-foreground line-through" : "text-foreground"}`}>
              {item.title}
            </span>
            <TrackChip name={track.name} color={track.color} />
          </span>
        ))}
      </div>
    </PanelShell>
  );
}

export function MasterMaterialsPanel({ tracks }: { tracks: TrackState[] }) {
  const rows = useMemo(() => masterMaterials(tracks), [tracks]);

  return (
    <PanelShell
      icon={<BookMarked size={14} strokeWidth={2.5} className="section-icon" />}
      title="Materials"
      trailing={
        rows.length > 0 ? <span className="pr-16 font-mono text-[0.75rem] text-muted-foreground">{rows.length}</span> : undefined
      }
    >
      {rows.length === 0 && <Empty>No materials on the selected tracks.</Empty>}
      <div className="flex flex-col gap-1.5">
        {rows.map(({ track, item }) => (
          <span key={`${track.id}-${item.id}`} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[0.85rem] text-foreground" title={item.title}>
              {item.title}
              {item.author && <span className="text-subtle-foreground"> · {item.author}</span>}
            </span>
            {item.status && (
              <span className="shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.04em] text-subtle-foreground">
                {item.status}
              </span>
            )}
            <TrackChip name={track.name} color={track.color} />
          </span>
        ))}
      </div>
    </PanelShell>
  );
}

// --- The to-do lists ---------------------------------------------------

/**
 * Everything still on your plate, from every track.
 *
 * The one panel here that has to go and fetch something: a track's to-do list
 * is a note rather than a field on the track, so it is read from the notes
 * table instead of coming out of the aggregation with everything else. Re-read
 * when a sync lands, the same trigger the editable panel uses — these lists
 * are exactly the kind of thing changed on another device.
 *
 * Done items are left out rather than struck through. A combined list is long
 * enough already, and the question it answers is what is left.
 */
export function MasterTodoPanel({ tracks }: { tracks: TrackState[] }) {
  const { workspace } = useWorkspace();
  const syncStamp = workspace?.lastSyncTime ?? 0;
  const [lists, setLists] = useState<{ track: TrackState["meta"]; items: TodoItem[] }[]>([]);

  const ids = tracks.map((track) => track.meta.id).join("|");
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      tracks.map(async (track) => ({
        track: track.meta,
        items: parseTodos(await readNote(todoNoteId(track.meta.id))).filter((item) => !item.done),
      }))
    ).then((read) => {
      if (!cancelled) setLists(read.filter((entry) => entry.items.length > 0));
    });
    return () => {
      cancelled = true;
    };
    // `tracks` is rebuilt every render by the filter above it; its ids are
    // what actually decides what to read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, syncStamp]);

  const total = lists.reduce((sum, entry) => sum + entry.items.length, 0);

  return (
    <PanelShell
      icon={<ListTodo size={14} strokeWidth={2.5} className="section-icon" />}
      title="To-do"
      trailing={total > 0 ? <span className="pr-16 font-mono text-[0.75rem] text-muted-foreground">{total}</span> : undefined}
    >
      {total === 0 && <Empty>Nothing left on the selected tracks.</Empty>}
      <div className="flex flex-col gap-1.5">
        {lists.flatMap((entry) =>
          entry.items.map((item, index) => (
            <span key={`${entry.track.id}-${index}`} className="flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-[3px] border"
                style={{ borderColor: "var(--card-border-hover)" }}
              />
              <span className="min-w-0 flex-1 truncate text-[0.85rem] text-foreground">{item.text}</span>
              <TrackChip name={entry.track.name} color={entry.track.color} />
            </span>
          ))
        )}
      </div>
    </PanelShell>
  );
}
