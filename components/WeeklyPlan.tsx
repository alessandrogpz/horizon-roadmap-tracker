"use client";

import React from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import type { TrackState, WeekDay } from "@/lib/types";
import { getDateForDayName, getWeekNum } from "@/lib/dates";
import { DEFAULT_WEEK_SCHEDULE, DEFAULT_FOCUS_TYPES } from "@/lib/constants";
import { runsInPhase } from "@/lib/rotation";
import { withAlpha } from "@/lib/colors";
import { dayItems } from "@/lib/dayItems";
import { isItemCompleted, setItemCompletion, type ItemKind } from "@/lib/completions";

/**
 * Whether the week is in its stacked, one-day-per-row shape.
 *
 * The layout is decided by a container query — the panel's width, not the
 * window's — so the only honest way to ask is to measure the same element the
 * query measures. The threshold itself comes from `--stacked-max` in
 * globals.css, so the shape and the behaviour that depends on it read one
 * number instead of two that can drift.
 *
 * Starts false, which is the shape a server render and a wide panel share; a
 * phone corrects it on the first observation, before paint.
 */
function useStackedWeek(ref: React.RefObject<HTMLDivElement | null>): boolean {
  const [stacked, setStacked] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const max = parseFloat(getComputedStyle(element).getPropertyValue("--stacked-max"));
      setStacked(Number.isFinite(max) && element.clientWidth <= max);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return stacked;
}

interface WeeklyPlanProps {
  data: TrackState;
  dayOfWeek: number;
  weekOffset: number;
  setWeekOffset: (offset: number) => void;
  onDayClick: (day: WeekDay) => void;
  /** null opens the "create a new rotation" flow; a string opens that rotation for viewing/editing. */
  onRotationClick: (rotationId: string | null) => void;
  /** Applies an optimistic state update and schedules a debounced save. */
  applyChange: (updater: (previous: TrackState) => TrackState) => void;
}

export default function WeeklyPlan({
  data,
  dayOfWeek,
  weekOffset,
  setWeekOffset,
  onDayClick,
  onRotationClick,
  applyChange,
}: WeeklyPlanProps) {
  const viewedWeekNum = (() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + weekOffset * 7);
    return getWeekNum(data.startDate, targetDate);
  })();

  const weekLabel = data.isSynced ? `Week ${viewedWeekNum}` : "Week --";

  const rotations = data.rotations || [];
  const schedule = data.weekSchedule || DEFAULT_WEEK_SCHEDULE;
  const todayName = schedule[dayOfWeek === 0 ? 6 : dayOfWeek - 1]?.name;

  // Which days are open, when a day is something you open. Today starts open
  // and the rest stay shut: in the stacked shape the week is read down, and
  // the day you came to look at should not be the fourth screen of it. The
  // set survives changing weeks on purpose — a day you opened stays open.
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const stacked = useStackedWeek(scrollRef);
  const [openDays, setOpenDays] = React.useState<string[]>(() => (todayName ? [todayName] : []));
  const toggleDay = React.useCallback((name: string) => {
    setOpenDays((previous) => (previous.includes(name) ? previous.filter((d) => d !== name) : [...previous, name]));
  }, []);

  return (
    <div className="glass-panel px-6 py-5">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex flex-col gap-3 pb-3 border-b border-card-border">
          {/* Top Row: Title and Navigation */}
          <div className="flex items-center gap-4">
            {/* h2, like every other panel heading: this sits directly under the
                page's h1, and an h3 there skips a level for a screen reader
                walking the outline. The size comes from the class, so nothing
                about it looks different. */}
            <h2 className="text-[1.1rem] font-semibold text-foreground m-0 whitespace-nowrap inline-flex items-center gap-2">
              <CalendarDays size={16} strokeWidth={2.5} className="text-muted-foreground" />
              Weekly Overview
            </h2>

            {/* Week Navigation Pill */}
            <div className="flex items-center gap-1.5 bg-surface-muted px-2 py-1 rounded-md border border-card-border shrink-0">
              <WeekNavButton label="‹" onClick={() => setWeekOffset(weekOffset - 1)} />
              <span className="text-foreground font-medium text-[0.85rem] min-w-[60px] text-center font-mono whitespace-nowrap">
                {weekLabel}
                {weekOffset !== 0 && (
                  <span className="text-[0.7rem] text-muted-foreground ml-1">
                    ({weekOffset > 0 ? `+${weekOffset}` : weekOffset})
                  </span>
                )}
              </span>
              <WeekNavButton label="›" onClick={() => setWeekOffset(weekOffset + 1)} />

              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="ml-2 bg-accent text-black border-none rounded px-2.5 py-0.5 text-[0.7rem] font-semibold cursor-pointer uppercase tracking-[0.03em] transition-opacity duration-200 whitespace-nowrap hover:opacity-80"
                >
                  Back to Today
                </button>
              )}
            </div>
          </div>

          {/* Bottom row: one pill per rotation, plus a button to add another.

              A rotation belonging to a later phase is drawn quietly and names
              the phase it is waiting for instead of a topic. It does have a
              "current" item in the arithmetic sense — the cycle turns with the
              week whether or not anything reads it — but nothing is putting
              that item on a day, and a pill that reads like this week's topic
              when it is not is worse than no pill at all. It stays clickable,
              because the only way into a rotation is through its pill. */}
          <div className="flex flex-wrap items-center gap-2">
            {rotations.map((rotation) => {
              const running = runsInPhase(rotation, data.currentPhase);
              const len = rotation.items.length;
              const idx = len > 0 ? (((viewedWeekNum - rotation.startWeek) % len) + len) % len : 0;
              const current = data.isSynced ? (rotation.items[idx]?.title || "") : "(Placeholder)";
              const phaseTitle = (data.phases || []).find((p) => p.id === rotation.phase)?.title;
              return (
                <div
                  key={rotation.id}
                  onClick={() => { if (data.isSynced) onRotationClick(rotation.id); }}
                  className={`inline-flex items-center gap-2 border border-dashed px-3 py-1.5 rounded-md transition-all duration-200 whitespace-nowrap ${
                    running ? "bg-accent/[0.08] border-accent/30" : "bg-surface-muted border-card-border opacity-70"
                  } ${data.isSynced ? "cursor-pointer hover:bg-accent/15 hover:border-accent/50" : "cursor-default"}`}
                  title={
                    !data.isSynced
                      ? "Connect Google Drive to unlock"
                      : running
                        ? "View full rotation cycle"
                        : `Runs during ${phaseTitle ? `phase ${rotation.phase} — ${phaseTitle}` : `phase ${rotation.phase}`}`
                  }
                >
                  <span className="text-[0.7rem] text-muted-foreground uppercase tracking-[0.05em] font-semibold">
                    {rotation.label}:
                  </span>
                  <span
                    className={`text-[0.85rem] font-bold font-mono ${running ? "text-accent" : "text-subtle-foreground"}`}
                  >
                    {running ? current : `Phase ${rotation.phase}`}
                  </span>
                </div>
              );
            })}

            {data.isSynced && (
              <button
                onClick={() => onRotationClick(null)}
                className="inline-flex items-center gap-1 border border-dashed border-card-border-hover px-3 py-1.5 rounded-md text-[0.7rem] text-muted-foreground uppercase tracking-[0.05em] font-semibold cursor-pointer transition-all duration-200 hover:text-foreground hover:border-card-border-hover"
              >
                + New Rotation
              </button>
            )}
          </div>
        </div>

        {/* Seven days in whichever shape the panel has room for: all seven
            across, four-and-three, or one per row. See `.week-grid`. */}
        <div className="week-grid-scroll" ref={scrollRef}>
          <div className="week-grid">
            {schedule.map((dayItem, idx) => (
              <DayCard
                key={dayItem.name}
                dayItem={dayItem}
                idx={idx}
                data={data}
                dayOfWeek={dayOfWeek}
                weekOffset={weekOffset}
                viewedWeekNum={viewedWeekNum}
                onDayClick={onDayClick}
                applyChange={applyChange}
                stacked={stacked}
                open={!stacked || openDays.includes(dayItem.name)}
                onToggle={() => toggleDay(dayItem.name)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekNavButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-transparent border border-card-border rounded text-muted-foreground cursor-pointer px-1.5 py-0.5 text-[0.8rem] font-mono leading-none transition-all duration-150 hover:border-accent hover:text-foreground"
    >
      {label}
    </button>
  );
}

interface DayCardProps {
  dayItem: WeekDay;
  idx: number;
  data: TrackState;
  dayOfWeek: number;
  weekOffset: number;
  viewedWeekNum: number;
  onDayClick: (day: WeekDay) => void;
  applyChange: (updater: (previous: TrackState) => TrackState) => void;
  /** Whether the week is one day per row, where a day can be opened and shut. */
  stacked: boolean;
  /** Always true in the grid shapes: a column has nothing to hide behind. */
  open: boolean;
  onToggle: () => void;
}

/**
 * One tickable line in a day card: the whole row, not just the box.
 *
 * The box was an 18-point checkbox scaled to 0.8, and a transform shrinks the
 * hit area along with the drawing — so the target was about fourteen points,
 * under half what a thumb needs and fiddly even with a mouse. It is drawn at
 * its full size again, and the label around it makes the title part of the
 * target, which is where the eye goes anyway. The padding takes the row past
 * twenty-four points tall without widening the column, and the negative
 * margin keeps the text aligned with the headings above it.
 *
 * The row swallows its click. The card behind it opens the day's editor, and
 * ticking something off is not a request to open anything.
 */
const ITEM_ROW =
  "day-item-row -mx-1 flex cursor-pointer items-start gap-[0.4rem] rounded px-1 py-[0.25rem] transition-colors hover:bg-surface-hover";

function DayCard({ dayItem, idx, data, dayOfWeek, weekOffset, viewedWeekNum, onDayClick, applyChange, stacked, open, onToggle }: DayCardProps) {
  const isCurrentWeek = weekOffset === 0;
  const isToday = isCurrentWeek && idx === (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  const dayKey = dayItem.name;
  const dayDateStr = getDateForDayName(dayKey, weekOffset);

  // One list, computed for the week being *viewed* so navigating weeks
  // previews the right content rather than repeating this week's.
  const items = dayItems(data, dayKey, viewedWeekNum);

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const dayDate = new Date(dayDateStr + "T00:00:00");
  const isFuture = dayDate > todayDate;

  const getItemCompleted = (itemId: string, kind: ItemKind) => isItemCompleted(data, dayDateStr, kind, itemId);

  const itemCount = items.length;
  const doneCount = items.filter((item) => getItemCompleted(item.id, item.kind)).length;

  /** Completion is always recorded against this card's calendar date, so
   *  ticking a box on a past day lands on that day rather than today. The
   *  stored item's own flag is only synced for the live (today) card — on any
   *  other day the flag belongs to a different date's checklist. */
  const handleToggleItem = (
    kind: ItemKind,
    item: { id: string; title: string; description?: string },
    completed: boolean
  ) => {
    applyChange((previous) =>
      setItemCompletion(previous, { dateStr: dayDateStr, dayKey: isToday ? dayKey : undefined, kind, ...item }, completed)
    );
  };

  // This day's own colour, rather than a map of every type's built seven times
  // over. `withAlpha` also leaves a colour it cannot read alone, where hand-
  // rolled hex slicing produced `rgba(NaN, NaN, NaN, 0.2)`.
  const focusTypes = data.focusTypes || DEFAULT_FOCUS_TYPES;
  const tagColor = focusTypes[dayItem.type]?.color || "#a1a1aa";
  const tag = { text: tagColor, bg: withAlpha(tagColor, 0.2) };

  return (
    <div
      onClick={() => onDayClick(dayItem)}
      className={`day-card flex flex-col gap-[0.35rem] px-2 py-[0.6rem] rounded-lg cursor-pointer transition-all duration-200 min-h-[160px] overflow-hidden ${
        open ? "" : "is-collapsed"
      } ${
        isToday
          ? "bg-accent/[0.06] border border-accent shadow-[0_0_12px_rgba(14,165,233,0.15)]"
          : "bg-input-bg border border-card-border"
      } ${isFuture ? "opacity-50" : ""}`}
    >
      {/* Which day this is, and what it is for.
          Stacked and centred while a day is a column; one line across the top
          of the row once a day is full-width, which is how a phone reads the
          week. */}
      <div
        className="day-card-head flex flex-col gap-[0.3rem] pb-1 border-b border-card-border"
        {...(stacked
          ? {
              role: "button" as const,
              tabIndex: 0,
              "aria-expanded": open,
              "aria-label": `${dayItem.name}, ${open ? "collapse" : "expand"}`,
              onClick: (event: React.MouseEvent) => {
                event.stopPropagation();
                onToggle();
              },
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                onToggle();
              },
            }
          : {})}
      >
        <div className="day-card-when text-center">
          {stacked && (
            <ChevronDown
              size={13}
              strokeWidth={2.5}
              aria-hidden="true"
              className="day-card-chevron shrink-0 text-subtle-foreground"
            />
          )}
          <span className={`text-[0.7rem] uppercase tracking-[0.05em] ${isToday ? "font-bold text-foreground" : "font-semibold text-muted-foreground"}`}>
            {dayItem.name}
          </span>
          <div className="day-card-date text-[0.65rem] text-subtle-foreground mt-px">
            {data.isSynced ? dayDateStr.slice(5) : "MM-DD"}
          </div>
        </div>

        <div className="day-card-tag flex min-w-0 items-center justify-center gap-1.5">
          {/* How much of a shut day is done, so the line is worth reading on
              its own. Hidden while it is open, where the boxes say it better. */}
          {stacked && !open && itemCount > 0 && (
            <span className="shrink-0 font-mono text-[0.65rem] text-subtle-foreground">
              {doneCount}/{itemCount}
            </span>
          )}
          {/* Truncates rather than overflowing. Centred and wider than its
              card, it was clipped at both ends — "Pattern Study" arrived as
              "ATTERN STUD", which reads as a glitch rather than a long word. */}
          <span
            title={data.isSynced ? dayItem.label : undefined}
            className="day-card-label max-w-full truncate text-[0.65rem] font-semibold px-1.5 py-px rounded-[3px] uppercase tracking-[0.03em]"
            style={data.isSynced ? { color: tag.text, background: tag.bg } : { color: "#71717a", background: "rgba(113, 113, 122, 0.12)" }}
          >
            {data.isSynced ? dayItem.label : "UN-ASSIGNED"}
          </span>
        </div>
      </div>

      {/* Everything a shut day hides. It grows, so "No tasks" still sits
          in the middle of a column in the grid shapes. */}
      <div className="day-card-body flex min-h-0 flex-1 flex-col gap-[0.35rem]">
        {items.length > 0 && (
          <div className="flex flex-col gap-[0.15rem]">
            {items.map((item) => {
              const completed = getItemCompleted(item.id, item.kind);
              return (
                <label key={`${item.kind}:${item.id}`} className={ITEM_ROW} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="checkbox-custom mt-px shrink-0"
                    checked={completed}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    onChange={(e) =>
                      handleToggleItem(item.kind, { id: item.id, title: item.title, description: item.description }, e.target.checked)
                    }
                  />
                  <span
                    title={item.title}
                    className={`day-item-title min-w-0 line-clamp-2 text-[0.7rem] leading-[1.3] ${completed ? "text-subtle-foreground line-through" : isToday ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {item.title}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {items.length === 0 && (
          <div className="day-card-empty flex flex-1 items-center justify-center">
            <span className="text-[0.7rem] text-subtle-foreground italic">No tasks</span>
          </div>
        )}
      </div>
    </div>
  );
}
