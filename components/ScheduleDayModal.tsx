"use client";

import React, { useState } from "react";
import type { AppState, WeekDay } from "@/lib/types";
import { getDateForDayName, todayYMD } from "@/lib/dates";
import { rebuildStreakHistory, completedItemTitle } from "@/lib/streak";
import { DEFAULT_WEEK_SCHEDULE, DEFAULT_FOCUS_TYPES } from "@/lib/constants";

interface ScheduleDayModalProps {
  day: WeekDay;
  data: AppState;
  setData: (data: AppState) => void;
  saveDailyChanges: (data: AppState) => void;
  onClose: () => void;
  updateAppState: (state: AppState) => Promise<unknown>;
  weekOffset?: number;
}

const fieldInputClass = "bg-black/25 border border-card-border rounded-md text-zinc-200 font-[inherit] text-[0.8rem] outline-none px-2.5 py-1.5";

export default function ScheduleDayModal({
  day,
  data,
  setData,
  saveDailyChanges,
  onClose,
  updateAppState,
  weekOffset = 0
}: ScheduleDayModalProps) {
  const [showManager, setShowManager] = useState(false);

  const focusTypes = data.focusTypes || DEFAULT_FOCUS_TYPES;

  const currentDaySchedule = (data.weekSchedule || DEFAULT_WEEK_SCHEDULE).find((d) => d.name === day.name) || day;

  const getFullLabel = (type: string) => {
    return focusTypes[type]?.label || type || "Daily Focus";
  };

  const getDateForDay = (dayName: string): string => getDateForDayName(dayName, weekOffset);

  const targetDateStr = getDateForDay(day.name);
  const isTargetToday = targetDateStr === todayYMD();

  const applyChange = (newData: AppState) => {
    setData(newData);
    saveDailyChanges(newData);
  };

  const persistOnBlur = async () => {
    try {
      await updateAppState(data);
    } catch (err) {
      console.error("Failed to save edits inside schedule modal", err);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel max-w-[500px] w-full flex flex-col gap-5 p-8 border !border-accent relative rounded-lg shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5),0_10px_10px_-5px_rgba(0,0,0,0.4)]"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 bg-transparent border-none text-zinc-400 text-[1.2rem] cursor-pointer font-[inherit]"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div>
          <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded font-semibold uppercase font-mono tracking-[0.05em]">
            {day.name} Schedule • {targetDateStr}
          </span>
          <h2 className="text-[1.3rem] font-bold text-white mt-2">
            {getFullLabel(currentDaySchedule.type)}
          </h2>
        </div>

        {/* Dynamic Focus Selection & Management */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[0.8rem] text-zinc-400">Focus Type:</span>
              <select
                value={currentDaySchedule.type}
                onChange={(e) => {
                  const newType = e.target.value;
                  const newLabel = focusTypes[newType]?.label || newType;
                  const updatedSchedule = (data.weekSchedule || DEFAULT_WEEK_SCHEDULE).map((d) => {
                    if (d.name === day.name) {
                      return { ...d, type: newType, label: newLabel };
                    }
                    return d;
                  });
                  applyChange({ ...data, weekSchedule: updatedSchedule });
                }}
                className="bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-white text-[0.85rem] font-[inherit] outline-none cursor-pointer"
              >
                {Object.entries(focusTypes).map(([key, val]) => (
                  <option key={key} value={key} className="bg-zinc-900 text-white">
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
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 flex flex-col gap-[0.6rem]">
              <span className="text-[0.7rem] text-zinc-400 font-bold uppercase">
                Edit Focus Types Pool
              </span>

              <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
                {Object.entries(focusTypes).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={val.label}
                      onChange={(e) => {
                        const updatedTypes = {
                          ...focusTypes,
                          [key]: { ...val, label: e.target.value }
                        };

                        const updatedSchedule = (data.weekSchedule || DEFAULT_WEEK_SCHEDULE).map((d) => {
                          if (d.type === key) {
                            return { ...d, label: e.target.value };
                          }
                          return d;
                        });

                        applyChange({ ...data, focusTypes: updatedTypes, weekSchedule: updatedSchedule });
                      }}
                      placeholder="Label"
                      className="flex-1 bg-black/25 border border-white/10 rounded px-1.5 py-0.5 text-white text-xs outline-none"
                    />

                    <input
                      type="color"
                      value={val.color || "#a1a1aa"}
                      onChange={(e) => {
                        const updatedTypes = {
                          ...focusTypes,
                          [key]: { ...val, color: e.target.value }
                        };
                        applyChange({ ...data, focusTypes: updatedTypes });
                      }}
                      className="w-6 h-6 border-none bg-transparent cursor-pointer p-0"
                    />

                    <button
                      onClick={() => {
                        const updatedTypes = { ...focusTypes };
                        delete updatedTypes[key];

                        const fallbackType = Object.keys(updatedTypes)[0] || "free";
                        const fallbackLabel = updatedTypes[fallbackType]?.label || "Free";

                        const updatedSchedule = (data.weekSchedule || DEFAULT_WEEK_SCHEDULE).map((d) => {
                          if (d.type === key) {
                            return { ...d, type: fallbackType, label: fallbackLabel };
                          }
                          return d;
                        });

                        applyChange({ ...data, focusTypes: updatedTypes, weekSchedule: updatedSchedule });
                      }}
                      disabled={Object.keys(focusTypes).length <= 1}
                      className={`bg-transparent border-none text-[0.8rem] px-0.5 ${
                        Object.keys(focusTypes).length <= 1 ? "text-zinc-700 cursor-not-allowed" : "text-red-500 cursor-pointer"
                      }`}
                      title="Delete Focus Type"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-1.5 items-center border-t border-white/5 pt-2">
                <input
                  type="text"
                  id="new-type-label"
                  placeholder="New type label..."
                  className="flex-1 bg-black/25 border border-white/10 rounded px-2 py-1 text-white text-xs outline-none"
                />
                <input
                  type="color"
                  id="new-type-color"
                  defaultValue="#0ea5e9"
                  className="w-6 h-6 border-none bg-transparent cursor-pointer p-0"
                />
                <button
                  onClick={() => {
                    const labelInput = document.getElementById("new-type-label") as HTMLInputElement;
                    const colorInput = document.getElementById("new-type-color") as HTMLInputElement;
                    if (labelInput && labelInput.value.trim()) {
                      const labelVal = labelInput.value.trim();
                      const colorVal = colorInput ? colorInput.value : "#0ea5e9";
                      const keyVal = labelVal.toLowerCase().replace(/[^a-z0-9]/g, "");

                      if (keyVal && !focusTypes[keyVal]) {
                        const updatedTypes = {
                          ...focusTypes,
                          [keyVal]: { label: labelVal, color: colorVal }
                        };
                        applyChange({ ...data, focusTypes: updatedTypes });
                        labelInput.value = "";
                      }
                    }
                  }}
                  className="btn px-2 py-1 text-xs"
                >
                  Add Type
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Content */}
        <div className="flex flex-col gap-4">
          {/* Daily Revision and Focus Checklist Editors inside Modal */}
          <div className="flex flex-col gap-5 max-h-[550px] overflow-y-auto pr-1">

            {/* Revision Section */}
            <div className="flex flex-col gap-3">
              <strong className="text-accent text-xs font-mono tracking-[0.05em] uppercase">
                {isTargetToday ? "TODAY'S " : ""}REVISION CHECKLIST:
              </strong>
              <div className="flex flex-col gap-2">
                {(data.dailyRevisionItems?.[day.name] || []).map((item, index) => (
                  <div
                    key={item.id || index}
                    className="flex flex-col gap-1.5 bg-black/15 px-3 py-[0.6rem] rounded-md border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="checkbox-custom"
                        checked={(data.weeklyCompletions?.[targetDateStr]?.revisions || []).includes(item.id)}
                        onChange={(e) => {
                          const updatedItems = (data.dailyRevisionItems?.[day.name] || []).map((it) => {
                            if (it.id === item.id) {
                              return { ...it, completed: e.target.checked };
                            }
                            return it;
                          });

                          // Sync streak history for the actual date of this day
                          const newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
                          const newWeeklyCompletions = { ...(data.weeklyCompletions || {}) };

                          const dateItems = newCompletedItemsHistory[targetDateStr] || [];
                          const targetComps = newWeeklyCompletions[targetDateStr] || { tasks: [], revisions: [] };

                          if (e.target.checked) {
                            const alreadyExists = dateItems.some((it) => completedItemTitle(it) === item.title);
                            if (!alreadyExists) {
                              newCompletedItemsHistory[targetDateStr] = [...dateItems, { title: item.title, description: item.description || "" }];
                            }
                            if (!targetComps.revisions.includes(item.id)) {
                              targetComps.revisions = [...targetComps.revisions, item.id];
                            }
                          } else {
                            newCompletedItemsHistory[targetDateStr] = dateItems.filter((it) => completedItemTitle(it) !== item.title);
                            targetComps.revisions = targetComps.revisions.filter((id: string) => id !== item.id);
                          }

                          newWeeklyCompletions[targetDateStr] = targetComps;

                          applyChange({
                            ...data,
                            dailyRevisionItems: {
                              ...(data.dailyRevisionItems || {}),
                              [day.name]: updatedItems
                            },
                            streakHistory: rebuildStreakHistory(newCompletedItemsHistory),
                            completedItemsHistory: newCompletedItemsHistory,
                            weeklyCompletions: newWeeklyCompletions
                          });
                        }}
                      />
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => {
                          const updatedItems = (data.dailyRevisionItems?.[day.name] || []).map((it) => {
                            if (it.id === item.id) {
                              return { ...it, title: e.target.value };
                            }
                            return it;
                          });
                          applyChange({
                            ...data,
                            dailyRevisionItems: {
                              ...(data.dailyRevisionItems || {}),
                              [day.name]: updatedItems
                            }
                          });
                        }}
                        onBlur={persistOnBlur}
                        placeholder="Revision topic..."
                        className="flex-1 bg-transparent border-none text-white font-[inherit] text-[0.85rem] font-semibold outline-none"
                      />
                      <button
                        onClick={() => {
                          const updatedItems = (data.dailyRevisionItems?.[day.name] || []).filter((it) => it.id !== item.id);

                          // Sync streak history for the actual date of this day
                          const newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
                          const newWeeklyCompletions = { ...(data.weeklyCompletions || {}) };
                          const targetComps = newWeeklyCompletions[targetDateStr] || { tasks: [], revisions: [] };

                          if (item.completed) {
                            const dateItems = newCompletedItemsHistory[targetDateStr] || [];
                            newCompletedItemsHistory[targetDateStr] = dateItems.filter((it) => completedItemTitle(it) !== item.title);
                          }

                          targetComps.revisions = targetComps.revisions.filter((id: string) => id !== item.id);
                          newWeeklyCompletions[targetDateStr] = targetComps;

                          applyChange({
                            ...data,
                            dailyRevisionItems: {
                              ...(data.dailyRevisionItems || {}),
                              [day.name]: updatedItems
                            },
                            streakHistory: rebuildStreakHistory(newCompletedItemsHistory),
                            completedItemsHistory: newCompletedItemsHistory,
                            weeklyCompletions: newWeeklyCompletions
                          });
                        }}
                        className="bg-transparent border-none text-red-500 cursor-pointer text-[0.9rem]"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Description Field */}
                    <input
                      type="text"
                      value={item.description || ""}
                      onChange={(e) => {
                        const updatedItems = (data.dailyRevisionItems?.[day.name] || []).map((it) => {
                          if (it.id === item.id) {
                            return { ...it, description: e.target.value };
                          }
                          return it;
                        });
                        applyChange({
                          ...data,
                          dailyRevisionItems: {
                            ...(data.dailyRevisionItems || {}),
                            [day.name]: updatedItems
                          }
                        });
                      }}
                      onBlur={persistOnBlur}
                      placeholder="Topic description (optional)..."
                      className="bg-transparent border-none border-b border-dashed border-white/10 text-zinc-400 font-[inherit] text-[0.8rem] outline-none py-px ml-7"
                    />
                  </div>
                ))}

                {/* Add revision item form */}
                <div className="flex flex-col gap-1.5 bg-white/[0.02] p-[0.6rem] rounded-md border border-dashed border-white/10">
                  <input
                    type="text"
                    id="new-rev-title"
                    placeholder="New revision topic..."
                    className={fieldInputClass}
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="new-rev-desc"
                      placeholder="Topic description (optional)..."
                      className={`flex-1 ${fieldInputClass}`}
                    />
                    <button
                      onClick={() => {
                        const titleInput = document.getElementById("new-rev-title") as HTMLInputElement;
                        const descInput = document.getElementById("new-rev-desc") as HTMLInputElement;
                        if (titleInput && titleInput.value.trim()) {
                          const newItem = {
                            id: `rev_${Date.now()}`,
                            title: titleInput.value.trim(),
                            description: descInput ? descInput.value.trim() : "",
                            completed: false
                          };
                          const updatedItems = [...(data.dailyRevisionItems?.[day.name] || []), newItem];
                          applyChange({
                            ...data,
                            dailyRevisionItems: {
                              ...(data.dailyRevisionItems || {}),
                              [day.name]: updatedItems
                            }
                          });
                          titleInput.value = "";
                          if (descInput) descInput.value = "";
                        }
                      }}
                      className="btn px-3 py-1.5 text-[0.8rem]"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-none border-t border-card-border my-2" />

            {/* Focus Section */}
            <div className="flex flex-col gap-3">
              <strong className="text-accent text-xs font-mono tracking-[0.05em] uppercase">
                {isTargetToday ? "TODAY'S " : ""}FOCUS CHECKLIST:
              </strong>
              <div className="flex flex-col gap-2">
                {(data.dailyTasks?.[day.name] || []).map((task, index) => (
                  <div
                    key={task.id || index}
                    className="flex items-center gap-3 bg-black/15 px-[0.6rem] py-1.5 rounded-md border border-white/5"
                  >
                    <input
                      type="checkbox"
                      className="checkbox-custom"
                      checked={(data.weeklyCompletions?.[targetDateStr]?.tasks || []).includes(task.id)}
                      onChange={(e) => {
                        const updatedTasks = (data.dailyTasks?.[day.name] || []).map((t) => {
                          if (t.id === task.id) {
                            return { ...t, completed: e.target.checked };
                          }
                          return t;
                        });

                        // Sync streak history for the actual date of this day
                        const newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
                        const newWeeklyCompletions = { ...(data.weeklyCompletions || {}) };

                        const dateItems = newCompletedItemsHistory[targetDateStr] || [];
                        const targetComps = newWeeklyCompletions[targetDateStr] || { tasks: [], revisions: [] };

                        if (e.target.checked) {
                          const alreadyExists = dateItems.some((it) => completedItemTitle(it) === task.title);
                          if (!alreadyExists) {
                            newCompletedItemsHistory[targetDateStr] = [...dateItems, { title: task.title }];
                          }
                          if (!targetComps.tasks.includes(task.id)) {
                            targetComps.tasks = [...targetComps.tasks, task.id];
                          }
                        } else {
                          newCompletedItemsHistory[targetDateStr] = dateItems.filter((it) => completedItemTitle(it) !== task.title);
                          targetComps.tasks = targetComps.tasks.filter((id: string) => id !== task.id);
                        }

                        newWeeklyCompletions[targetDateStr] = targetComps;

                        applyChange({
                          ...data,
                          dailyTasks: {
                            ...(data.dailyTasks || {}),
                            [day.name]: updatedTasks
                          },
                          streakHistory: rebuildStreakHistory(newCompletedItemsHistory),
                          completedItemsHistory: newCompletedItemsHistory,
                          weeklyCompletions: newWeeklyCompletions
                        });
                      }}
                    />
                    <input
                      type="text"
                      value={task.title}
                      onChange={(e) => {
                        const updatedTasks = (data.dailyTasks?.[day.name] || []).map((t) => {
                          if (t.id === task.id) {
                            return { ...t, title: e.target.value };
                          }
                          return t;
                        });
                        applyChange({
                          ...data,
                          dailyTasks: {
                            ...(data.dailyTasks || {}),
                            [day.name]: updatedTasks
                          }
                        });
                      }}
                      onBlur={persistOnBlur}
                      placeholder="Task description..."
                      className="flex-1 bg-transparent border-none text-white font-[inherit] text-[0.85rem] outline-none"
                    />
                    <button
                      onClick={() => {
                        const updatedTasks = (data.dailyTasks?.[day.name] || []).filter((t) => t.id !== task.id);

                        // Sync streak history for the actual date of this day
                        const newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
                        const newWeeklyCompletions = { ...(data.weeklyCompletions || {}) };
                        const targetComps = newWeeklyCompletions[targetDateStr] || { tasks: [], revisions: [] };

                        if (task.completed) {
                          const dateItems = newCompletedItemsHistory[targetDateStr] || [];
                          newCompletedItemsHistory[targetDateStr] = dateItems.filter((it) => completedItemTitle(it) !== task.title);
                        }

                        targetComps.tasks = targetComps.tasks.filter((id: string) => id !== task.id);
                        newWeeklyCompletions[targetDateStr] = targetComps;

                        applyChange({
                          ...data,
                          dailyTasks: {
                            ...(data.dailyTasks || {}),
                            [day.name]: updatedTasks
                          },
                          streakHistory: rebuildStreakHistory(newCompletedItemsHistory),
                          completedItemsHistory: newCompletedItemsHistory,
                          weeklyCompletions: newWeeklyCompletions
                        });
                      }}
                      className="bg-transparent border-none text-red-500 cursor-pointer text-[0.9rem]"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Add task option inside modal */}
                <div className="flex items-center gap-3 mt-2">
                  <input
                    type="text"
                    placeholder="Add a focus item..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value.trim()) {
                        const newTask = {
                          id: `task_${Date.now()}`,
                          title: e.currentTarget.value.trim(),
                          completed: false
                        };
                        const updatedTasks = [...(data.dailyTasks?.[day.name] || []), newTask];
                        applyChange({
                          ...data,
                          dailyTasks: {
                            ...(data.dailyTasks || {}),
                            [day.name]: updatedTasks
                          }
                        });
                        e.currentTarget.value = "";
                      }
                    }}
                    className="flex-1 bg-black/25 border border-card-border rounded-md px-3 py-2 text-zinc-200 font-[inherit] text-[0.85rem] outline-none"
                  />
                  <button
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      if (input && input.value.trim()) {
                        const newTask = {
                          id: `task_${Date.now()}`,
                          title: input.value.trim(),
                          completed: false
                        };
                        const updatedTasks = [...(data.dailyTasks?.[day.name] || []), newTask];
                        applyChange({
                          ...data,
                          dailyTasks: {
                            ...(data.dailyTasks || {}),
                            [day.name]: updatedTasks
                          }
                        });
                        input.value = "";
                      }
                    }}
                    className="btn px-4 py-2 text-[0.85rem]"
                  >
                    + Add
                  </button>
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
