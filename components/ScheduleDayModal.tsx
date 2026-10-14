"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { setWeeklyRhythm } from "@/lib/trackActions";
import type { TrackState, WeekDay } from "@/lib/types";
import { getDateForDayName, getWeekNum, parseYMD, todayYMD } from "@/lib/dates";
import { DEFAULT_WEEK_SCHEDULE, DEFAULT_FOCUS_TYPES } from "@/lib/constants";
import { dayItems, NEW_ITEM_KIND } from "@/lib/dayItems";
import {
  addDayItem,
  isItemCompleted,
  removeDayItem,
  setItemCompletion,
  updateDayItem,
  type ItemKind,
} from "@/lib/completions";
import { useWorkspaceActions } from "@/components/workspace/WorkspaceProvider";
import FocusTypeEditor from "@/components/shared/FocusTypeEditor";

interface ScheduleDayModalProps {
  day: WeekDay;
  data: TrackState;
  /** Optimistic update plus a debounced save. Takes an updater so an edit
   *  always applies to the newest track, never a captured snapshot. */
  applyChange: (updater: (previous: TrackState) => TrackState) => void;
  onClose: () => void;
  weekOffset?: number;
}

const fieldInputClass = "bg-input-bg border border-card-border rounded-md text-foreground font-[inherit] text-[0.8rem] outline-none px-2.5 py-1.5";

export default function ScheduleDayModal({ day, data, applyChange, onClose, weekOffset = 0 }: ScheduleDayModalProps) {
  const { flush } = useWorkspaceActions();
  const [showManager, setShowManager] = useState(false);
  const [newItem, setNewItem] = useState({ title: "", description: "" });

  const focusTypes = data.focusTypes || DEFAULT_FOCUS_TYPES;
  const currentDaySchedule = (data.weekSchedule || DEFAULT_WEEK_SCHEDULE).find((d) => d.name === day.name) || day;
  const getFullLabel = (type: string) => focusTypes[type]?.label || type || "Daily Focus";

  const targetDateStr = getDateForDayName(day.name, weekOffset);
  const isTargetToday = targetDateStr === todayYMD();

  // One list, from the same place the weekly plan and the phone read it.
  // Rotation items in it are recomputed live for the viewed week rather than
  // read from storage, so they always show the current topic and can't be
  // edited or deleted here — an edit made to one would be silently overwritten
  // the next time the day recomputes. The rotation's own editor changes those.
  const viewedWeekNum = getWeekNum(data.startDate, parseYMD(targetDateStr));
  const items = dayItems(data, day.name, viewedWeekNum);

  /** Blur commits immediately rather than waiting out the debounce, so tabbing
   *  away from a field can never leave an edit in flight. */
  const persistOnBlur = () => {
    void flush();
  };

  const isDone = (kind: ItemKind, id: string) => isItemCompleted(data, targetDateStr, kind, id);

  /** `stored` distinguishes a manually-added item (which has a saved record
   *  whose `completed` flag needs syncing) from a rotation item (recomputed
   *  every render, so completion lives only in the day's id set). */
  const toggle = (
    kind: ItemKind,
    item: { id: string; title: string; description?: string },
    completed: boolean,
    stored: boolean
  ) => {
    applyChange((previous) =>
      setItemCompletion(
        previous,
        { dateStr: targetDateStr, dayKey: stored ? day.name : undefined, kind, ...item },
        completed
      )
    );
  };

  const addItem = () => {
    if (!newItem.title.trim()) return;
    applyChange((previous) => addDayItem(previous, day.name, NEW_ITEM_KIND, newItem));
    setNewItem({ title: "", description: "" });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel max-w-[500px] w-full flex flex-col gap-5 p-8 border border-accent-muted relative rounded-lg shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5),0_10px_10px_-5px_rgba(0,0,0,0.4)]"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 flex items-center bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          aria-label="Close"
        >
          <X size={18} strokeWidth={2} />
        </button>

        {/* Modal Header */}
        <div>
          <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded font-semibold uppercase font-mono tracking-[0.05em]">
            {day.name} Schedule • {targetDateStr}
          </span>
          <h2 className="text-[1.3rem] font-bold text-foreground mt-2">
            {getFullLabel(currentDaySchedule.type)}
          </h2>
        </div>

        {/* Dynamic Focus Selection & Management */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[0.8rem] text-muted-foreground">Focus Type:</span>
              <select
                value={currentDaySchedule.type}
                onChange={(e) => {
                  const newType = e.target.value;
                  const newLabel = focusTypes[newType]?.label || newType;
                  // Through `setWeeklyRhythm` rather than written in place:
                  // that is where a change to the week gets dated, and a day
                  // changed from here is as much a change to the week as one
                  // changed from the rhythm editor.
                  applyChange((previous) =>
                    setWeeklyRhythm(
                      previous,
                      (previous.weekSchedule || DEFAULT_WEEK_SCHEDULE).map((d) =>
                        d.name === day.name ? { ...d, type: newType, label: newLabel } : d
                      ),
                      previous.focusTypes || {}
                    )
                  );
                }}
                className="bg-input-bg border border-card-border rounded-md px-2 py-1.5 text-foreground text-[0.85rem] font-[inherit] outline-none cursor-pointer"
              >
                {Object.entries(focusTypes).map(([key, val]) => (
                  <option key={key} value={key} className="bg-card text-foreground">
                    {val.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowManager(!showManager)}
              className="bg-transparent border-none text-accent text-xs cursor-pointer font-mono p-0 underline"
            >
              {showManager ? "Hide Settings" : "Customize Pool"}
            </button>
          </div>

          {showManager && (
            <FocusTypeEditor
              focusTypes={focusTypes}
              weekSchedule={data.weekSchedule || DEFAULT_WEEK_SCHEDULE}
              onChange={(updatedTypes, updatedSchedule) => {
                applyChange((previous) => setWeeklyRhythm(previous, updatedSchedule, updatedTypes));
              }}
            />
          )}
        </div>

        {/* Modal Content */}
        <div className="flex flex-col gap-4">
          {/* One list. What the day is *about* is the focus type above; what
              is on it is just a list of things, in the order they read on the
              weekly plan. */}
          <div className="flex flex-col gap-5 max-h-[550px] overflow-y-auto pr-1">
            <div className="flex flex-col gap-3">
              <strong className="text-accent text-xs font-mono tracking-[0.05em] uppercase">
                {isTargetToday ? "TODAY'S " : ""}CHECKLIST:
              </strong>

              <div className="flex flex-col gap-2">
                {items.map((item) => {
                  const completed = isDone(item.kind, item.id);

                  // Written by a rotation: tickable, not editable.
                  if (item.generated) {
                    return (
                      <div
                        key={`${item.kind}:${item.id}`}
                        className="flex flex-col gap-1 bg-accent/[0.04] px-3 py-[0.6rem] rounded-md border border-dashed border-accent/20"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            className="checkbox-custom"
                            checked={completed}
                            onChange={(e) =>
                              toggle(item.kind, { id: item.id, title: item.title, description: item.description }, e.target.checked, false)
                            }
                          />
                          <span className={`flex-1 text-[0.85rem] font-semibold ${completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                            {item.title}
                          </span>
                          <span className="text-[0.65rem] text-accent/70 uppercase tracking-[0.05em] shrink-0">Rotation</span>
                        </div>
                        {item.description && (
                          <span className="text-[0.8rem] text-muted-foreground ml-7">{item.description}</span>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`${item.kind}:${item.id}`}
                      className="flex flex-col gap-1.5 bg-input-bg px-3 py-[0.6rem] rounded-md border border-card-border"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="checkbox-custom"
                          checked={completed}
                          onChange={(e) =>
                            toggle(item.kind, { id: item.id, title: item.title, description: item.description }, e.target.checked, true)
                          }
                        />
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) =>
                            applyChange((previous) =>
                              updateDayItem(previous, day.name, item.kind, item.id, { title: e.target.value })
                            )
                          }
                          onBlur={persistOnBlur}
                          placeholder="Item..."
                          className="flex-1 bg-transparent border-none text-foreground font-[inherit] text-[0.85rem] font-semibold outline-none"
                        />
                        <button
                          onClick={() =>
                            applyChange((previous) =>
                              removeDayItem(previous, {
                                dateStr: targetDateStr,
                                dayKey: day.name,
                                kind: item.kind,
                                id: item.id,
                                title: item.title,
                              })
                            )
                          }
                          className="flex items-center bg-transparent border-none text-red-500 cursor-pointer"
                          aria-label="Remove item"
                        >
                          <X size={14} strokeWidth={2} />
                        </button>
                      </div>

                      {/* Only where there is somewhere to put it: the older of
                          the two stored lists has no description field, so an
                          item written before this change keeps just its title
                          rather than offering a box that would discard what
                          you typed. Everything written now has one. */}
                      {item.kind === "revision" && (
                        <input
                          type="text"
                          value={item.description || ""}
                          onChange={(e) =>
                            applyChange((previous) =>
                              updateDayItem(previous, day.name, item.kind, item.id, { description: e.target.value })
                            )
                          }
                          onBlur={persistOnBlur}
                          placeholder="Description (optional)..."
                          className="bg-transparent border-none border-b border-dashed border-card-border text-muted-foreground font-[inherit] text-[0.8rem] outline-none py-px ml-7"
                        />
                      )}
                    </div>
                  );
                })}

                {/* Add an item */}
                <div className="flex flex-col gap-1.5 bg-surface-muted p-[0.6rem] rounded-md border border-dashed border-card-border">
                  <input
                    type="text"
                    value={newItem.title}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, title: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addItem()}
                    placeholder="Add an item..."
                    className={fieldInputClass}
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newItem.description}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && addItem()}
                      placeholder="Description (optional)..."
                      className={`flex-1 ${fieldInputClass}`}
                    />
                    <button onClick={addItem} className="btn px-3 py-1.5 text-[0.8rem]">
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end mt-2">
          <button onClick={onClose} className="btn px-6 py-2 text-[0.85rem]">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
