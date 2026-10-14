import { CalendarDays, Check } from "lucide-react";

/**
 * A replica of the Weekly Plan panel, showing a training week.
 *
 * It used to show a week of the graphics-and-engine track this app was built
 * for, with a DSA rotation on "Two Pointers" and a maths rotation on "Linear
 * Algebra" — which asks a visitor to understand two unfamiliar things before
 * they can judge the third. A training week explains itself: everybody knows
 * what a push day is, and what it means for the emphasis to move on next week.
 *
 * The day cards mirror `components/WeeklyPlan.tsx`'s DayCard — focus tag, the
 * day's list, today's highlight, dimmed future days — and it reuses the app's
 * own `.week-grid` classes, so it reshapes itself for the room it has exactly
 * like the real panel does: seven across, four-and-three, or one day per row
 * on a phone.
 *
 * A picture of the panel, not a copy of it. The boxes were briefly real, and
 * a week plan whose checkboxes tick and then forget is the clearest way on
 * this page to mislead somebody about the one thing they came to find out.
 * Nothing here responds, and nothing here looks as though it would.
 */

interface PreviewDay {
  name: string;
  /** Focus type label and colour, as configured on the track. */
  label: string;
  color: string;
  /** What is on the day. One list: what the day is *about* is the focus type
   *  above it, so nothing here has to be filed under a heading first. */
  items: { title: string; done: boolean }[];
  state: "past" | "today" | "future";
}

const PUSH = "#f59e0b";
const PULL = "#0ea5e9";
const LEGS = "#a855f7";
const CARDIO = "#22c55e";
const REST = "#a1a1aa";

const DAYS: PreviewDay[] = [
  {
    name: "Mon",
    label: "Push",
    color: PUSH,
    items: [
      { title: "Shoulder mobility", done: true },
      { title: "Bench press", done: true },
      { title: "Overhead press", done: true },
      { title: "Triceps", done: true },
    ],
    state: "past",
  },
  {
    name: "Tue",
    label: "Pull",
    color: PULL,
    items: [
      { title: "Band pull-aparts", done: true },
      { title: "Deadlift", done: true },
      { title: "Barbell row", done: true },
      { title: "Curls", done: false },
    ],
    state: "past",
  },
  {
    name: "Wed",
    label: "Legs",
    color: LEGS,
    items: [
      { title: "Hip mobility", done: true },
      { title: "Front squat", done: true },
      { title: "Walking lunges", done: true },
      { title: "Calves", done: true },
    ],
    state: "past",
  },
  {
    name: "Thu",
    label: "Push",
    color: PUSH,
    items: [
      { title: "Shoulder mobility", done: true },
      { title: "Incline press", done: true },
      { title: "Dips", done: false },
      { title: "Lateral raises", done: false },
    ],
    state: "today",
  },
  {
    name: "Fri",
    label: "Pull",
    color: PULL,
    items: [
      { title: "Band pull-aparts", done: false },
      { title: "Pull-ups", done: false },
      { title: "Cable row", done: false },
      { title: "Face pulls", done: false },
    ],
    state: "future",
  },
  {
    name: "Sat",
    label: "Conditioning",
    color: CARDIO,
    items: [
      { title: "Easy jog, 10 min", done: false },
      { title: "5km at tempo", done: false },
      { title: "Core circuit", done: false },
    ],
    state: "future",
  },
  {
    name: "Sun",
    label: "Rest",
    color: REST,
    items: [
      { title: "Long walk", done: false },
      { title: "Stretch, 15 min", done: false },
    ],
    state: "future",
  },
];

/** A drawn checkbox rather than a real `<input>`, but a real button: the row
 *  around it is what takes the click, the same as in the app. */
function Box({ done }: { done: boolean }) {
  return done ? (
    <span className="mt-px flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[4px] bg-success">
      <Check size={10} strokeWidth={3.5} className="text-[#00120c]" />
    </span>
  ) : (
    <span className="mt-px h-[14px] w-[14px] shrink-0 rounded-[4px] border border-card-border-hover bg-input-bg" />
  );
}

function ItemList({
  items,
  isToday,
}: {
  items: { title: string; done: boolean }[];
  isToday: boolean;
}) {
  return (
    <div>
      <div className="flex flex-col gap-[0.15rem]">
        {items.map((item) => (
          <div key={item.title} className="day-item-row flex items-start gap-[0.3rem]">
            <Box done={item.done} />
            <span
              className={`day-item-title text-[0.72rem] leading-[1.3] ${
                item.done
                  ? "text-subtle-foreground line-through"
                  : isToday
                    ? "text-foreground"
                    : "text-muted-foreground"
              }`}
            >
              {item.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WeeklyPlanPreview() {
  return (
    <div aria-hidden="true" className="glass-panel select-none border-l-4 border-accent-muted">
      <div className="flex flex-col gap-3">
        {/* Header — title, the week the plan is showing, and the rotation pill */}
        <div className="flex flex-col gap-3 border-b border-card-border pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="m-0 inline-flex items-center gap-2 whitespace-nowrap text-[1.1rem] font-semibold text-foreground">
              <CalendarDays size={16} strokeWidth={2.5} className="text-muted-foreground" />
              Weekly Training Plan
            </h3>
            <span className="shrink-0 rounded-md border border-card-border bg-surface-muted px-3 py-1 font-mono text-[0.85rem] font-medium">
              Week 12
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-dashed border-accent/30 bg-accent/[0.08] px-3 py-1.5">
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Upper rotation:
              </span>
              <span className="font-mono text-[0.85rem] font-bold text-accent">Incline press</span>
            </span>
            <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-dashed border-accent/30 bg-accent/[0.08] px-3 py-1.5">
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Lower rotation:
              </span>
              <span className="font-mono text-[0.85rem] font-bold text-accent">Front squat</span>
            </span>

            {/* The way a third rotation is added, drawn exactly as the app
                draws it — same dashed outline, same size, same words. It was
                missing from the picture, which made the two pills look like
                a fixed pair rather than a list you add to. A span, not a
                button: this is a photograph of the panel, and a dotted
                outline that does nothing when pressed is a worse lie than
                one that is plainly part of the picture. */}
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-dashed border-card-border-hover px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              + New Rotation
            </span>
          </div>
        </div>

        {/* The seven day cards — the app's own grid, so they stack on a phone */}
        <div className="week-grid-scroll">
          <div className="week-grid">
            {DAYS.map((day) => {
              const isToday = day.state === "today";
              const rgb = [1, 3, 5].map((i) => parseInt(day.color.slice(i, i + 2), 16));
              return (
                <div
                  key={day.name}
                  className={`day-card flex min-h-[160px] flex-col gap-[0.35rem] overflow-hidden rounded-lg px-2 py-[0.6rem] ${
                    isToday
                      ? "border border-accent bg-accent/[0.06] shadow-[0_0_12px_rgba(14,165,233,0.15)]"
                      : "border border-card-border bg-input-bg"
                  } ${day.state === "future" ? "opacity-50" : ""}`}
                >
                  <div className="day-card-head flex flex-col gap-[0.3rem] border-b border-card-border pb-1">
                    <div className="day-card-when text-center">
                      <span
                        className={`text-[0.7rem] uppercase tracking-[0.05em] ${
                          isToday ? "font-bold text-foreground" : "font-semibold text-muted-foreground"
                        }`}
                      >
                        {day.name}
                      </span>
                    </div>

                    <div className="day-card-tag flex min-w-0 justify-center">
                      <span
                        className="day-card-label max-w-full truncate rounded-[3px] px-1.5 py-px text-[0.55rem] font-semibold uppercase tracking-[0.03em]"
                        style={{
                          color: day.color,
                          background: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.2)`,
                        }}
                      >
                        {day.label}
                      </span>
                    </div>
                  </div>

                  <ItemList items={day.items} isToday={isToday} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
