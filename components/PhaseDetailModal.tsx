"use client";

import React, { useState } from "react";
import type { Phase, PhaseDetailItem, TaskItem } from "@/lib/types";

interface PhaseDetailModalProps {
  phase: Phase;
  currentPhaseId: number;
  onClose: () => void;
  onActivatePhase: (id: number) => void;
  onChange: (updatedPhase: Phase) => void;
  onDelete: (id: number) => void;
  canDelete: boolean;
}

// Placeholder state stores these sections as plain strings; normalize to array form.
const asItems = (v: PhaseDetailItem[] | string | undefined): PhaseDetailItem[] => {
  if (!v) return [];
  return Array.isArray(v) ? v : [{ item: v, desc: "" }];
};

function ReadOnlyDetailSection({ title, items }: { title: string; items: PhaseDetailItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-[0.8rem] text-accent uppercase tracking-[0.05em] mb-2 border-b border-white/5 pb-1 font-bold">
        {title}
      </h4>
      <div className="flex flex-col gap-3">
        {items.map((f, idx) => (
          <div key={idx} className="text-[0.85rem] leading-normal">
            <div className="text-white font-semibold">{f.item}</div>
            {f.desc && <div className="text-zinc-400 pl-4">{f.desc}</div>}
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
      <h4 className="text-[0.8rem] text-accent uppercase tracking-[0.05em] mb-2 border-b border-white/5 pb-1 font-bold">
        {title}
      </h4>
      <div className="flex flex-col gap-2">
        {items.map((f, idx) => (
          <div key={idx} className="flex flex-col gap-1 bg-black/15 border border-white/5 rounded-md p-2.5">
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
                className="flex-1 bg-transparent border-none text-white text-[0.85rem] font-semibold outline-none"
              />
              <button
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                className="bg-transparent border-none text-red-500 cursor-pointer text-[0.85rem]"
              >
                ✕
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
              className="bg-transparent border-none border-t border-dashed border-white/10 text-zinc-400 text-[0.8rem] outline-none pt-1"
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange([...items, { item: "", desc: "" }])}
        className="text-accent bg-transparent border-none cursor-pointer text-[0.75rem] font-mono underline mt-2"
      >
        + Add
      </button>
    </div>
  );
}

export default function PhaseDetailModal({
  phase,
  currentPhaseId,
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
        className="glass-panel max-w-[600px] w-full max-h-[90vh] overflow-y-auto flex flex-col gap-6 p-8 border border-accent-muted relative shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5),0_10px_10px_-5px_rgba(0,0,0,0.4)]"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 bg-transparent border-none text-zinc-400 text-[1.2rem] cursor-pointer font-[inherit]"
        >
          ✕
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
                  className="flex-1 bg-transparent border-none text-[1.4rem] font-bold text-accent outline-none"
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
                className="bg-transparent border-none border-b border-dashed border-white/10 text-zinc-400 text-[0.9rem] outline-none pb-1.5 resize-none"
                rows={2}
              />
            </div>

            {/* Tasks (editing) */}
            <div>
              <h4 className="text-[0.8rem] text-accent uppercase tracking-[0.05em] mb-2 border-b border-white/5 pb-1 font-bold">
                Tasks
              </h4>
              <div className="flex flex-col gap-2">
                {phase.tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 bg-black/15 border border-white/5 rounded-md px-2.5 py-1.5">
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
                      className="flex-1 bg-transparent border-none text-white text-[0.85rem] outline-none"
                    />
                    <button onClick={() => removeTask(task.id)} className="bg-transparent border-none text-red-500 cursor-pointer text-[0.85rem]">
                      ✕
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
                className="mt-2 w-full bg-black/25 border border-dashed border-white/10 rounded-md px-2.5 py-1.5 text-white text-[0.85rem] outline-none"
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
            <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-4">
              {confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-[0.8rem] text-red-400">Delete this phase?</span>
                  <button
                    onClick={() => {
                      onDelete(phase.id);
                      onClose();
                    }}
                    className="btn px-3 py-1.5 text-[0.8rem] !bg-red-500/15 !text-red-400 !border-red-500/40"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="btn px-3 py-1.5 text-[0.8rem] !bg-transparent !text-zinc-400 !border-white/10"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  {canDelete && (
                    <button
                      onClick={() => setConfirmingDelete(true)}
                      className="text-red-500 bg-transparent border-none cursor-pointer text-[0.8rem]"
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
                <h2 className="text-[1.4rem] font-bold text-accent m-0">{phase.title}</h2>
                {isActive ? (
                  <span className="text-xs bg-success/15 text-success px-2 py-0.5 rounded font-semibold shrink-0">
                    ACTIVE FOCUS
                  </span>
                ) : null}
              </div>
              <p className="text-zinc-400 text-[0.9rem] mt-1">{phase.description}</p>
            </div>

            {/* Tasks (read-only — plain list, no checkboxes) */}
            {phase.tasks.length > 0 && (
              <div>
                <h4 className="text-[0.8rem] text-accent uppercase tracking-[0.05em] mb-2 border-b border-white/5 pb-1 font-bold">
                  Tasks
                </h4>
                <div className="flex flex-col gap-2">
                  {phase.tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`text-[0.85rem] ${task.completed ? "text-zinc-500 line-through" : "text-foreground"}`}
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
            <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-4">
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
                  className="btn px-4 py-2 text-[0.85rem] !bg-transparent !text-zinc-400 !border-white/10 hover:!text-white"
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
