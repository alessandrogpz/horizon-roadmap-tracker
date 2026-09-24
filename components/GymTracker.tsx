"use client";

import React, { useMemo, useState } from "react";
import { Check, Circle, Dumbbell, Minus, Plus, X } from "lucide-react";
import {
  addExercise,
  addSet,
  addToPlan,
  focusOfDay,
  gymNoteId,
  lastTime,
  parseGymLog,
  plannedFor,
  removeFromPlan,
  removeSet,
  serializeGymLog,
  sessionFor,
  setCountOf,
  updatePlanItem,
  volumeOf,
  type GymLog,
} from "@/lib/gym";
import { DAYS_SHORT, parseYMD, todayYMD } from "@/lib/dates";
import { useQuickNote } from "@/components/useQuickNote";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";

/**
 * Training, on the website: the same log the phone writes.
 *
 * The log lives in a note (`lib/gym.ts` explains why), so this reads and
 * writes the note the phone already syncs — `gym-<trackId>` — and neither
 * platform knows or cares which one wrote it. Nothing here is a second source
 * of truth: which day is a push day comes from the track's weekly rhythm, the
 * same place every other part of the app asks.
 *
 * What a desk is better at than a phone is *planning*: typing exercise names,
 * setting numbers, seeing the whole week. What a phone is better at is logging
 * between sets. So this leans to the first — the plan is editable inline,
 * with logging kept to one click per set.
 */
export default function GymTracker() {
  const { track } = useWorkspace();
  const today = todayYMD();
  const noteId = track ? gymNoteId(track.meta.id) : "";
  const { content, update } = useQuickNote(noteId, 600);

  const log = useMemo(() => parseGymLog(content), [content]);
  const [draft, setDraft] = useState("");

  if (!track) return null;

  const change = (next: (log: GymLog) => GymLog) => update(serializeGymLog(next(log)));

  const dayKey = DAYS_SHORT[parseYMD(today).getDay()];
  const focus = focusOfDay(track.weekSchedule, dayKey);
  const planned = plannedFor(log, focus?.key);
  const session = sessionFor(log, today);

  if (!focus) {
    return (
      <p className="text-[0.85rem] text-muted-foreground">
        This track&apos;s week doesn&apos;t say what today is for yet. Set it in the weekly rhythm and
        the plan for each kind of day appears here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[0.95rem] font-semibold text-foreground">{focus.label}</span>
        <span className="text-[0.8rem] text-muted-foreground">
          {setCountOf(session)} set{setCountOf(session) === 1 ? "" : "s"}
          {volumeOf(session) > 0 ? ` · ${Math.round(volumeOf(session)).toLocaleString()} kg` : ""}
        </span>
      </div>

      {planned.length === 0 && (
        <p className="text-[0.85rem] text-muted-foreground">
          Nothing planned for {focus.label.toLowerCase()} days yet. Add exercises below and they wait
          on every {focus.label.toLowerCase()} day.
        </p>
      )}

      {planned.map((item) => {
        const logged = session.exercises.find(
          (exercise) => exercise.name.toLowerCase() === item.name.toLowerCase()
        );
        const done = logged?.sets.length ?? 0;
        const complete = done >= item.sets;
        const previous = lastTime(log, item.name, today);

        return (
          <div
            key={item.name}
            className="flex flex-col gap-1.5 rounded-md border border-card-border bg-input-bg p-2.5"
          >
            <div className="flex items-center gap-2">
              {complete ? (
                <Check size={15} className="shrink-0 text-green-500" />
              ) : (
                <Circle size={15} className="shrink-0 text-subtle-foreground" />
              )}
              <span
                className={`flex-1 text-[0.9rem] ${complete ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                {item.name}
              </span>

              <Stepper
                value={item.sets}
                unit="sets"
                onChange={(sets) => change((l) => updatePlanItem(l, focus.key, item.name, { sets }))}
              />
              <Stepper
                value={item.reps}
                unit="reps"
                onChange={(reps) => change((l) => updatePlanItem(l, focus.key, item.name, { reps }))}
              />

              <button
                onClick={() => change((l) => removeFromPlan(l, focus.key, item.name))}
                className="text-subtle-foreground hover:text-red-500"
                aria-label={`Remove ${item.name} from the ${focus.label} plan`}
                title="Remove from the plan"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2 pl-[23px]">
              <span className="font-mono text-[0.75rem] text-muted-foreground">
                {done}/{item.sets} done
              </span>

              {/* One click per set, because the desk is not where anyone counts
                  reps — it is where they see what is left. */}
              <button
                onClick={() =>
                  change((l) => {
                    const withExercise = logged
                      ? l
                      : addExercise(l, today, item.name);
                    const id = sessionFor(withExercise, today).exercises.find(
                      (exercise) => exercise.name.toLowerCase() === item.name.toLowerCase()
                    )?.id;
                    return id ? addSet(withExercise, today, id, { reps: item.reps }) : withExercise;
                  })
                }
                className="rounded border border-card-border px-2 py-0.5 text-[0.75rem] text-foreground hover:border-accent"
              >
                Log a set
              </button>

              {logged && logged.sets.length > 0 && (
                <button
                  onClick={() => change((l) => removeSet(l, today, logged.id, logged.sets.length - 1))}
                  className="text-[0.75rem] text-subtle-foreground hover:text-foreground"
                >
                  Undo last
                </button>
              )}

              {previous && (
                <span className="ml-auto text-[0.72rem] text-subtle-foreground">
                  last {previous.date.slice(5)}:{" "}
                  {previous.sets.map((set) => `${set.reps}${set.weight ? `×${set.weight}` : ""}`).join(", ")}
                </span>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-2 border-t border-card-border pt-2">
        <Dumbbell size={14} className="text-subtle-foreground" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            const name = draft.trim();
            if (!name) return;
            change((l) => addToPlan(l, focus.key, name));
            setDraft("");
          }}
          placeholder={`Add to the ${focus.label.toLowerCase()} plan…`}
          className="flex-1 border-none bg-transparent text-[0.85rem] text-foreground outline-none placeholder:text-subtle-foreground"
        />
      </div>
    </div>
  );
}

/** A number on a plan row, nudged rather than typed — the values are small and
 *  the keyboard is a detour. */
function Stepper({
  value,
  unit,
  onChange,
}: {
  value: number;
  unit: "sets" | "reps";
  onChange: (value: number) => void;
}) {
  const step = unit === "sets" ? 1 : 5;
  return (
    <span className="flex items-center gap-0.5 rounded border border-card-border px-1">
      <button
        onClick={() => onChange(Math.max(1, value - step))}
        className="text-subtle-foreground hover:text-foreground"
        aria-label={`One less ${unit}`}
      >
        <Minus size={11} />
      </button>
      <span className="min-w-[2.6rem] text-center font-mono text-[0.72rem] text-foreground">
        {value} {unit}
      </span>
      <button
        onClick={() => onChange(value + step)}
        className="text-subtle-foreground hover:text-foreground"
        aria-label={`One more ${unit}`}
      >
        <Plus size={11} />
      </button>
    </span>
  );
}
