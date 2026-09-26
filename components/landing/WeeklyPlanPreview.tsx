"use client";

import { useState } from "react";
import { CalendarDays, Check, Plus, X } from "lucide-react";

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
 * two lists, today's highlight, dimmed future days — and it reuses the app's
 * own `.week-grid` classes, so it scrolls sideways on a phone exactly like the
 * real panel does.
 *
 * It holds no workspace and writes nothing, but it is not inert: the boxes
 * tick, a day can be picked, and a rotation can be added. A week plan whose
 * checkboxes do nothing is the one panel on this page where a visitor is most
 * likely to try.
 */

interface PreviewDay {
  name: string;
  /** Focus type label and colour, as configured on the track. */
  label: string;
  color: string;
  /** The two lists a day carries. Their headings are the track's own words —
   *  a study track calls them Revision and Focus, a training one Warm-up and
   *  Session — so they travel with the data rather than being hard-coded. */
  lists: { heading: string; items: { title: string; done: boolean }[] }[];
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
    lists: [
      { heading: "Warm-up", items: [{ title: "Shoulder mobility", done: true }] },
      {
        heading: "Session",
        items: [
          { title: "Bench press", done: true },
          { title: "Overhead press", done: true },
          { title: "Triceps", done: true },
        ],
      },
    ],
    state: "past",
  },
  {
    name: "Tue",
    label: "Pull",
    color: PULL,
    lists: [
      { heading: "Warm-up", items: [{ title: "Band pull-aparts", done: true }] },
      {
        heading: "Session",
        items: [
          { title: "Deadlift", done: true },
          { title: "Barbell row", done: true },
          { title: "Curls", done: false },
        ],
      },
    ],
    state: "past",
  },
  {
    name: "Wed",
    label: "Legs",
    color: LEGS,
    lists: [
      { heading: "Warm-up", items: [{ title: "Hip mobility", done: true }] },
      {
        heading: "Session",
        items: [
          { title: "Front squat", done: true },
          { title: "Walking lunges", done: true },
          { title: "Calves", done: true },
        ],
      },
    ],
    state: "past",
  },
  {
    name: "Thu",
    label: "Push",
    color: PUSH,
    lists: [
      { heading: "Warm-up", items: [{ title: "Shoulder mobility", done: true }] },
      {
        heading: "Session",
        items: [
          { title: "Incline press", done: true },
          { title: "Dips", done: false },
          { title: "Lateral raises", done: false },
        ],
      },
    ],
    state: "today",
  },
  {
    name: "Fri",
    label: "Pull",
    color: PULL,
    lists: [
      { heading: "Warm-up", items: [{ title: "Band pull-aparts", done: false }] },
      {
        heading: "Session",
        items: [
          { title: "Pull-ups", done: false },
          { title: "Cable row", done: false },
          { title: "Face pulls", done: false },
        ],
      },
    ],
    state: "future",
  },
  {
    name: "Sat",
    label: "Conditioning",
    color: CARDIO,
    lists: [
      { heading: "Warm-up", items: [{ title: "Easy jog, 10 min", done: false }] },
      {
        heading: "Session",
        items: [
          { title: "5km at tempo", done: false },
          { title: "Core circuit", done: false },
        ],
      },
    ],
    state: "future",
  },
  {
    name: "Sun",
    label: "Rest",
    color: REST,
    lists: [
      {
        heading: "Session",
        items: [
          { title: "Long walk", done: false },
          { title: "Stretch, 15 min", done: false },
        ],
      },
    ],
    state: "future",
  },
];

/** What a box started as, so the first click flips it rather than setting it
 *  to true. Keyed the same way `ItemList` keys its rows. */
function seeded(key: string): boolean {
  for (const day of DAYS) {
    for (const list of day.lists) {
      for (const item of list.items) {
        if (`${day.name}-${list.heading}-${item.title}` === key) return item.done;
      }
    }
  }
  return false;
}

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
  heading,
  items,
  isToday,
  dayName,
  ticked,
  onToggle,
}: {
  heading: string;
  items: { title: string; done: boolean }[];
  isToday: boolean;
  dayName: string;
  ticked: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <div>
      <span className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.05em] text-accent">
        {heading}
      </span>
      <div className="mt-[0.15rem] flex flex-col gap-[0.15rem]">
        {items.map((item) => {
          const key = `${dayName}-${heading}-${item.title}`;
          // The seeded value is the starting point; a click owns it after
          // that, which is how a checkbox behaves everywhere else.
          const done = key in ticked ? ticked[key] : item.done;
          return (
            <button
              key={item.title}
              onClick={() => onToggle(key)}
              className="flex w-full cursor-pointer items-start gap-[0.3rem] rounded text-left transition-colors hover:bg-surface-hover"
            >
              <Box done={done} />
              <span
                className={`text-[0.72rem] leading-[1.3] ${
                  done
                    ? "text-subtle-foreground line-through"
                    : isToday
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {item.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function WeeklyPlanPreview() {
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<string | null>(null);
  /** Rotations the visitor adds. The two the week starts with are the
   *  track's; these are theirs, and the point of letting them is that a
   *  rotation is the one idea in this app nobody arrives already knowing. */
  const [rotations, setRotations] = useState<{ scope: string; item: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [draftScope, setDraftScope] = useState("");
  const [draftItem, setDraftItem] = useState("");

  const toggle = (key: string) => setTicked((current) => ({ ...current, [key]: !(key in current ? current[key] : seeded(key)) }));

  return (
    <div className="glass-panel landing-lift select-none border-l-4 border-accent-muted">
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

            {rotations.map((rotation, index) => (
              <span
                key={`${rotation.scope}-${index}`}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-dashed border-accent/30 bg-accent/[0.08] px-3 py-1.5"
              >
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  {rotation.scope} rotation:
                </span>
                <span className="font-mono text-[0.85rem] font-bold text-accent">{rotation.item}</span>
                <button
                  onClick={() => setRotations((current) => current.filter((_, i) => i !== index))}
                  aria-label={`Remove the ${rotation.scope} rotation`}
                  className="cursor-pointer text-subtle-foreground transition-colors hover:text-foreground"
                >
                  <X size={11} strokeWidth={2.5} />
                </button>
              </span>
            ))}

            {adding ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!draftScope.trim() || !draftItem.trim()) return;
                  setRotations((current) => [...current, { scope: draftScope.trim(), item: draftItem.trim() }]);
                  setDraftScope("");
                  setDraftItem("");
                  setAdding(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-accent/40 bg-accent/[0.08] px-2 py-1"
              >
                <input
                  value={draftScope}
                  onChange={(event) => setDraftScope(event.target.value)}
                  placeholder="Core"
                  autoFocus
                  className="w-[5.5rem] rounded border border-card-border bg-input-bg px-1.5 py-1 text-[0.75rem] text-foreground outline-none placeholder:text-subtle-foreground"
                />
                <input
                  value={draftItem}
                  onChange={(event) => setDraftItem(event.target.value)}
                  placeholder="Hanging leg raise"
                  className="w-[9rem] rounded border border-card-border bg-input-bg px-1.5 py-1 font-mono text-[0.75rem] text-foreground outline-none placeholder:font-sans placeholder:text-subtle-foreground"
                />
                <button type="submit" className="btn px-2 py-1 text-[0.72rem]">
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  aria-label="Cancel"
                  className="cursor-pointer text-subtle-foreground transition-colors hover:text-foreground"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-dashed border-card-border-hover px-3 py-1.5 text-[0.75rem] font-semibold text-muted-foreground transition-colors hover:border-accent-muted hover:text-foreground"
              >
                <Plus size={12} strokeWidth={2.5} />
                New rotation
              </button>
            )}
          </div>
        </div>

        {/* The seven day cards — same grid the app uses, so it scrolls on a phone */}
        <div className="week-grid-scroll">
          <div className="week-grid">
            {DAYS.map((day) => {
              const isToday = day.state === "today";
              const rgb = [1, 3, 5].map((i) => parseInt(day.color.slice(i, i + 2), 16));
              return (
                <div
                  key={day.name}
                  className={`flex min-h-[160px] flex-col gap-[0.35rem] overflow-hidden rounded-lg px-2 py-[0.6rem] transition-opacity ${
                    isToday || picked === day.name
                      ? "border border-accent bg-accent/[0.06] shadow-[0_0_12px_rgba(14,165,233,0.15)]"
                      : "border border-card-border bg-input-bg"
                  } ${day.state === "future" && picked !== day.name ? "opacity-50" : ""}`}
                >
                  <button
                    onClick={() => setPicked((current) => (current === day.name ? null : day.name))}
                    title={`Open ${day.name}`}
                    className="w-full cursor-pointer border-b border-card-border pb-1 text-center"
                  >
                    <span
                      className={`text-[0.7rem] uppercase tracking-[0.05em] ${
                        isToday || picked === day.name ? "font-bold text-foreground" : "font-semibold text-muted-foreground"
                      }`}
                    >
                      {day.name}
                    </span>
                  </button>

                  <div className="mb-[0.15rem] flex justify-center">
                    <span
                      className="whitespace-nowrap rounded-[3px] px-1.5 py-px text-[0.55rem] font-semibold uppercase tracking-[0.03em]"
                      style={{
                        color: day.color,
                        background: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.2)`,
                      }}
                    >
                      {day.label}
                    </span>
                  </div>

                  {day.lists.map((list) => (
                    <ItemList
                      key={list.heading}
                      heading={list.heading}
                      items={list.items}
                      isToday={isToday || picked === day.name}
                      dayName={day.name}
                      ticked={ticked}
                      onToggle={toggle}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
