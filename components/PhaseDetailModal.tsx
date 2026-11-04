"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { dateForDay, dayForDate, formatDateYMD, formatDayMonthYear } from "@/lib/dates";
import type { Phase, PhaseDetailItem, TaskItem } from "@/lib/types";
import { phaseDetailItems } from "@/lib/phaseDetails";

interface PhaseDetailModalProps {
  phase: Phase;
  currentPhaseId: number;
  /** Track start, needed to convert between this phase's recommendedByDay
   *  threshold and the calendar date shown in the editor. */
  startDate: string;
  onClose: () => void;
  onActivatePhase: (id: number) => void;
  onChange: (updatedPhase: Phase) => void;
  onDelete: (id: number) => void;
  canDelete: boolean;
}

// Some tracks still store these sections as a plain string; `phaseDetailItems`
// normalises both shapes, and the phone reads them through the same function.
const asItems = phaseDetailItems;

function ReadOnlyDetailSection({ title, items }: { title: string; items: PhaseDetailItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-[0.8rem] text-accent uppercase tracking-[0.05em] mb-2 border-b border-card-border pb-1 font-bold">
        {title}
      </h4>
      <div className="flex flex-col gap-3">
        {items.map((f, idx) => (
          <div key={idx} className="text-[0.85rem] leading-normal">
            <div className="text-foreground font-semibold">{f.item}</div>
            {f.desc && <div className="text-muted-foreground pl-4">{f.desc}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function EditableDetailSection({
  title,
  items,
  onChange,
}: {
  title: string;
  items: PhaseDetailItem[];
  onChange: (items: PhaseDetailItem[]) => void;
}) {
  return (
    <div>
      <h4 className="text-[0.8rem] text-accent uppercase tracking-[0.05em] mb-2 border-b border-card-border pb-1 font-bold">
        {title}
      </h4>
      <div className="flex flex-col gap-2">
        {items.map((f, idx) => (
          <div key={idx} className="flex flex-col gap-1 bg-input-bg border border-card-border rounded-md p-2.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={f.item}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...next[idx], item: e.target.value };
                  onChange(next);
                }}
                placeholder="Item"
                className="flex-1 bg-transparent border-none text-foreground text-[0.85rem] font-semibold outline-none"
              />
              <button
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                className="flex items-center bg-transparent border-none text-danger cursor-pointer"
                aria-label="Remove"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
            <input
              type="text"
              value={f.desc}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...next[idx], desc: e.target.value };
                onChange(next);
              }}
              placeholder="Description (optional)"
              className="bg-transparent border-none border-t border-dashed border-card-border text-muted-foreground text-[0.8rem] outline-none pt-1"
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange([...items, { item: "", desc: "" }])}
        className="text-accent bg-transparent border-none cursor-pointer text-[0.8rem] font-mono underline mt-2"
      >
        + Add
      </button>
    </div>
  );
}

/** The phase's deadline as an editable calendar date. `Phase.recommendedByDay`
 *  is stored as a day offset from the track start (so a track can be re-dated
 *  wholesale without rewriting every phase), but a day number is not something
 *  anyone wants to reason about — so it's edited as a date and converted here.
 *  Clearing the field removes the threshold entirely, which is how a phase opts
 *  out of the deadline/banner behaviour. */
function PhaseEndDateEditor({
  phase,
  startDate,
  onChange,
}: {
  phase: Phase;
  startDate: string;
  onChange: (updatedPhase: Phase) => void;
}) {
  if (!startDate) return null;

  const value =
    phase.recommendedByDay !== undefined
      ? formatDateYMD(dateForDay(startDate, phase.recommendedByDay))
      : "";

  const handle = (next: string) => {
    if (!next) {
      const cleared = { ...phase };
      delete cleared.recommendedByDay;
      onChange(cleared);
      return;
    }
    const day = dayForDate(startDate, next);
    if (day < 1) return; // a phase cannot end before the track begins
    onChange({ ...phase, recommendedByDay: day });
  };

  return (
    <div>
      <h4 className="text-[0.8rem] text-accent uppercase tracking-[0.05em] mb-2 border-b border-card-border pb-1 font-bold">
        Phase Ends
      </h4>
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="date"
          value={value}
          onChange={(e) => handle(e.target.value)}
          className="bg-input-bg border border-card-border rounded-md px-2.5 py-1.5 text-foreground text-[0.85rem] outline-none"
        />
        <span className="text-[0.8rem] font-mono text-muted-foreground">
          {phase.recommendedByDay !== undefined ? `day ${phase.recommendedByDay}` : "no deadline set"}
        </span>
        {phase.recommendedByDay !== undefined && (
          <button
            onClick={() => handle("")}
            className="text-[0.8rem] text-muted-foreground hover:text-danger bg-transparent border-none cursor-pointer underline"
          >
            Clear
          </button>
        )}
      </div>
      <p className="text-[0.7rem] text-muted-foreground/70 mt-1.5 m-0">
        Counted from the track start. The last phase with a date also sets the track&apos;s total length.
      </p>
    </div>
  );
}

export default function PhaseDetailModal({
  phase,
  currentPhaseId,
  startDate,
  onClose,
  onActivatePhase,
  onChange,
  onDelete,
  canDelete,
}: PhaseDetailModalProps) {
  const { detailedInfo } = phase;
  const isActive = phase.id === currentPhaseId;
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const endsOn =
    phase.recommendedByDay !== undefined && startDate
      ? formatDayMonthYear(dateForDay(startDate, phase.recommendedByDay))
      : null;

  const updateDetail = (field: keyof Phase["detailedInfo"], items: PhaseDetailItem[]) => {
    onChange({ ...phase, detailedInfo: { ...detailedInfo, [field]: items } });
  };

  const updateTask = (taskId: string, fields: Partial<TaskItem>) => {
    onChange({ ...phase, tasks: phase.tasks.map((t) => (t.id === taskId ? { ...t, ...fields } : t)) });
  };

  const removeTask = (taskId: string) => {
    onChange({ ...phase, tasks: phase.tasks.filter((t) => t.id !== taskId) });
  };

  const addTask = (title: string) => {
    if (!title.trim()) return;
    onChange({ ...phase, tasks: [...phase.tasks, { id: `t_${Date.now()}`, title: title.trim(), completed: false }] });
  };

  const algoItems = asItems(detailedInfo.algoDS);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel panel-roomy max-w-[600px] w-full max-h-[90vh] overflow-y-auto flex flex-col gap-6 border border-accent-muted relative shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5),0_10px_10px_-5px_rgba(0,0,0,0.4)]"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 flex items-center bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          aria-label="Close"
        >
          <X size={18} strokeWidth={2} />
        </button>

        {isEditing ? (
          <>
            {/* Modal Header (editing) */}
            <div className="flex flex-col gap-2 pr-8">
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  value={phase.title}
                  onChange={(e) => onChange({ ...phase, title: e.target.value })}
                  className="flex-1 bg-transparent border-none text-[1.3rem] font-bold text-accent outline-none"
                />
                {isActive ? (
                  <span className="text-xs bg-success/15 text-success px-2 py-0.5 rounded font-semibold shrink-0">
                    ACTIVE FOCUS
                  </span>
                ) : null}
              </div>
              <textarea
                value={phase.description}
                onChange={(e) => onChange({ ...phase, description: e.target.value })}
                placeholder="What is this phase about?"
                className="bg-transparent border-none border-b border-dashed border-card-border text-muted-foreground text-[0.95rem] outline-none pb-1.5 resize-none"
                rows={2}
              />
            </div>

            <PhaseEndDateEditor phase={phase} startDate={startDate} onChange={onChange} />

            {/* Tasks (editing) */}
            <div>
              <h4 className="text-[0.8rem] text-accent uppercase tracking-[0.05em] mb-2 border-b border-card-border pb-1 font-bold">
                Tasks
              </h4>
              <div className="flex flex-col gap-2">
                {phase.tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 bg-input-bg border border-card-border rounded-md px-2.5 py-1.5">
                    <input
                      type="checkbox"
                      className="checkbox-custom"
                      checked={task.completed}
                      onChange={(e) => updateTask(task.id, { completed: e.target.checked })}
                    />
                    <input
                      type="text"
                      value={task.title}
                      onChange={(e) => updateTask(task.id, { title: e.target.value })}
                      className="flex-1 bg-transparent border-none text-foreground text-[0.85rem] outline-none"
                    />
                    <button onClick={() => removeTask(task.id)} className="flex items-center bg-transparent border-none text-danger cursor-pointer" aria-label="Remove task">
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
              <input
                type="text"
                placeholder="Add a task and press Enter..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value.trim()) {
                    addTask(e.currentTarget.value);
                    e.currentTarget.value = "";
                  }
                }}
                className="mt-2 w-full bg-input-bg border border-dashed border-card-border rounded-md px-2.5 py-1.5 text-foreground text-[0.85rem] outline-none"
              />
            </div>

            {/* Detailed Sections (editing) */}
            <div className="flex flex-col gap-5">
              <EditableDetailSection title="Core Focus" items={asItems(detailedInfo.focus)} onChange={(items) => updateDetail("focus", items)} />
              <EditableDetailSection title="Math Integration" items={asItems(detailedInfo.math)} onChange={(items) => updateDetail("math", items)} />
              <EditableDetailSection title="Algorithms & Data Structures" items={algoItems} onChange={(items) => updateDetail("algoDS", items)} />
              <EditableDetailSection title="Deliverable Goal" items={asItems(detailedInfo.deliverable)} onChange={(items) => updateDetail("deliverable", items)} />
            </div>

            {/* Footer (editing) */}
            <div className="flex justify-between items-center mt-2 border-t border-card-border pt-4">
              {confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-[0.8rem] text-danger">Delete this phase?</span>
                  <button
                    onClick={() => {
                      onDelete(phase.id);
                      onClose();
                    }}
                    className="btn px-3 py-1.5 text-[0.8rem] !bg-danger/15 !text-danger !border-danger/40"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="btn px-3 py-1.5 text-[0.8rem] !bg-transparent !text-muted-foreground !border-card-border"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  {canDelete && (
                    <button
                      onClick={() => setConfirmingDelete(true)}
                      className="text-danger bg-transparent border-none cursor-pointer text-[0.8rem]"
                    >
                      Delete Phase
                    </button>
                  )}
                </div>
              )}
              <button onClick={() => setIsEditing(false)} className="btn px-5 py-2 text-[0.85rem]">
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Modal Header (read-only) */}
            <div className="pr-8">
              <div className="flex items-center gap-4">
                <h2 className="text-[1.3rem] font-bold text-accent m-0">{phase.title}</h2>
                {isActive ? (
                  <span className="text-xs bg-success/15 text-success px-2 py-0.5 rounded font-semibold shrink-0">
                    ACTIVE FOCUS
                  </span>
                ) : null}
              </div>
              <p className="text-muted-foreground text-[0.95rem] mt-1">{phase.description}</p>
              {endsOn && (
                <p className="text-[0.7rem] font-mono text-muted-foreground/60 mt-1 m-0">
                  Ends {endsOn}<span className="opacity-70"> · day {phase.recommendedByDay}</span>
                </p>
              )}
            </div>

            {/* Tasks (read-only — plain list, no checkboxes) */}
            {phase.tasks.length > 0 && (
              <div>
                <h4 className="text-[0.8rem] text-accent uppercase tracking-[0.05em] mb-2 border-b border-card-border pb-1 font-bold">
                  Tasks
                </h4>
                <div className="flex flex-col gap-2">
                  {phase.tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`text-[0.85rem] ${task.completed ? "text-muted-foreground line-through" : "text-foreground"}`}
                    >
                      {task.title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Sections (read-only) */}
            <div className="flex flex-col gap-5">
              <ReadOnlyDetailSection title="Core Focus" items={asItems(detailedInfo.focus)} />
              <ReadOnlyDetailSection title="Math Integration" items={asItems(detailedInfo.math)} />
              <ReadOnlyDetailSection title="Algorithms & Data Structures" items={algoItems} />
              <ReadOnlyDetailSection title="Deliverable Goal" items={asItems(detailedInfo.deliverable)} />
            </div>

            {/* Footer (read-only) */}
            <div className="flex justify-between items-center mt-2 border-t border-card-border pt-4">
              <div className="flex items-center gap-3">
                {!isActive && (
                  <button
                    onClick={() => {
                      onActivatePhase(phase.id);
                      onClose();
                    }}
                    className="btn !bg-accent/15 !text-accent border !border-accent text-[0.85rem]"
                  >
                    Set as Active Phase
                  </button>
                )}
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn px-4 py-2 text-[0.85rem] !bg-transparent !text-muted-foreground !border-card-border hover:!text-foreground"
                >
                  Edit
                </button>
              </div>
              <button onClick={onClose} className="btn px-5 py-2 text-[0.85rem]">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
