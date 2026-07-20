"use client";

import React, { useState } from "react";
import type { RotationDef, TrackState } from "@/lib/types";
import { getWeekNum } from "@/lib/dates";
import { renderMarkdownToHtml } from "@/lib/markdown";

interface RotationModalProps {
  data: TrackState;
  /** null opens the "create a new rotation" flow. */
  rotationId: string | null;
  onClose: () => void;
  /** Applies an optimistic state update and schedules a debounced save. */
  applyChange: (newData: TrackState) => void;
}

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface DraftItem {
  title: string;
  description: string;
}

type ModalMode = "view" | "edit" | "plan";

export default function RotationModal({ data, rotationId, onClose, applyChange }: RotationModalProps) {
  const isNew = rotationId === null;
  const existing = rotationId ? (data.rotations || []).find((r) => r.id === rotationId) : undefined;
  const currentWeekNum = getWeekNum(data.startDate);

  const [mode, setMode] = useState<ModalMode>(isNew ? "edit" : "view");
  const [label, setLabel] = useState(existing?.label || "");
  const [items, setItems] = useState<DraftItem[]>(
    existing?.items.map((it) => ({ title: it.title, description: it.description || "" })) || [{ title: "", description: "" }]
  );
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(existing?.daysOfWeek || []);
  const [target, setTarget] = useState<"revision" | "focus">(existing?.target || "revision");
  const [explanation, setExplanation] = useState(existing?.explanation || "");

  // The full-plan editor is a separate always-live autosave surface (like
  // /roadmap), independent from the batched edit form above — entering it
  // re-seeds from the current saved value so it never shows stale content.
  const [planContent, setPlanContent] = useState("");
  const [planTab, setPlanTab] = useState<"write" | "preview">("preview");
  const [planSaveStatus, setPlanSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const planSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  if (!isNew && !existing) return null;

  const openEdit = () => {
    if (existing) {
      setLabel(existing.label);
      setItems(existing.items.map((it) => ({ title: it.title, description: it.description || "" })));
      setDaysOfWeek(existing.daysOfWeek);
      setTarget(existing.target);
      setExplanation(existing.explanation || "");
    }
    setMode("edit");
  };

  const openPlan = () => {
    const current = existing?.explanation || "";
    setPlanContent(current);
    setPlanTab(current ? "preview" : "write");
    setMode("plan");
  };

  const toggleDay = (day: string) => {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const updateItem = (idx: number, field: "title" | "description", value: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const canSave = label.trim().length > 0 && daysOfWeek.length > 0 && items.some((it) => it.title.trim().length > 0);

  const handleSave = () => {
    if (!canSave) return;
    const cleanItems = items
      .map((it) => ({ title: it.title.trim(), description: it.description.trim() || undefined }))
      .filter((it) => it.title.length > 0);

    const rotation: RotationDef = {
      id: existing?.id || crypto.randomUUID(),
      label: label.trim(),
      items: cleanItems,
      daysOfWeek,
      target,
      startWeek: existing?.startWeek ?? currentWeekNum,
      explanation: explanation.trim() || undefined,
    };

    const nextRotations = existing
      ? (data.rotations || []).map((r) => (r.id === rotation.id ? rotation : r))
      : [...(data.rotations || []), rotation];

    applyChange({ ...data, rotations: nextRotations });

    if (isNew) onClose();
    else setMode("view");
  };

  const handleDelete = () => {
    if (!existing) return;
    const itemId = `rotation_${existing.id}`;
    const stripRotationItem = <T extends { id: string }>(map: Record<string, T[]> | undefined) => {
      if (!map) return map;
      const next: Record<string, T[]> = {};
      Object.entries(map).forEach(([day, list]) => {
        next[day] = list.filter((it) => it.id !== itemId);
      });
      return next;
    };

    applyChange({
      ...data,
      rotations: (data.rotations || []).filter((r) => r.id !== existing.id),
      dailyRevisionItems: stripRotationItem(data.dailyRevisionItems) || data.dailyRevisionItems,
      dailyTasks: stripRotationItem(data.dailyTasks) || data.dailyTasks,
    });
    onClose();
  };

  // Shift which item is "current" for this week by picking one from the cycle.
  const selectActiveItem = (idx: number) => {
    if (!existing) return;
    const newStartWeek = currentWeekNum - idx;
    const nextRotations = (data.rotations || []).map((r) =>
      r.id === existing.id ? { ...r, startWeek: newStartWeek } : r
    );
    applyChange({ ...data, rotations: nextRotations });
  };

  const persistPlan = (newContent: string) => {
    if (!existing) return;
    if (planSaveTimeoutRef.current) clearTimeout(planSaveTimeoutRef.current);
    setPlanSaveStatus("saving");
    planSaveTimeoutRef.current = setTimeout(() => {
      const nextRotations = (data.rotations || []).map((r) =>
        r.id === existing.id ? { ...r, explanation: newContent } : r
      );
      applyChange({ ...data, rotations: nextRotations });
      setPlanSaveStatus("saved");
      setTimeout(() => setPlanSaveStatus("idle"), 2000);
    }, 800);
  };

  const handlePlanChange = (value: string) => {
    setPlanContent(value);
    persistPlan(value);
  };

  const len = existing?.items.length || 0;
  const activeIndex = len > 0 ? (((currentWeekNum - (existing?.startWeek ?? 0)) % len) + len) % len : 0;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`glass-panel w-full max-h-[90vh] flex flex-col gap-6 p-8 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] border border-accent-muted relative rounded-lg overflow-hidden ${
          mode === "plan" ? "max-w-[900px] h-[80vh]" : "max-w-[600px]"
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 bg-transparent border-none text-zinc-400 text-[1.2rem] cursor-pointer"
        >
          ✕
        </button>

        {mode === "plan" && existing ? (
          <>
            <div className="pr-8 shrink-0">
              <h2 className="text-[1.4rem] font-bold text-white mb-1">
                {existing.label}: Full Plan
              </h2>
              <p className="text-[0.85rem] text-zinc-400 m-0">
                This rotation&apos;s own private plan — autosaves.
              </p>
            </div>

            <div className="glass-panel !p-0 !border-white/10 flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/5 px-6 pt-4 shrink-0">
                <div className="flex gap-1">
                  <button
                    className={`px-4 py-2 text-[0.8rem] font-semibold uppercase tracking-[0.05em] border-b-2 -mb-px cursor-pointer bg-transparent ${
                      planTab === "write" ? "text-accent border-accent" : "text-zinc-500 border-transparent hover:text-white"
                    }`}
                    onClick={() => setPlanTab("write")}
                  >
                    Write
                  </button>
                  <button
                    className={`px-4 py-2 text-[0.8rem] font-semibold uppercase tracking-[0.05em] border-b-2 -mb-px cursor-pointer bg-transparent ${
                      planTab === "preview" ? "text-accent border-accent" : "text-zinc-500 border-transparent hover:text-white"
                    }`}
                    onClick={() => setPlanTab("preview")}
                  >
                    Preview
                  </button>
                </div>
                <span className="text-[0.7rem] font-mono text-zinc-500 pb-2">
                  {planSaveStatus === "saving" && "Saving..."}
                  {planSaveStatus === "saved" && "Saved ✓"}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
                {planTab === "write" ? (
                  <textarea
                    value={planContent}
                    onChange={(e) => handlePlanChange(e.target.value)}
                    placeholder="Write this rotation's full plan using Markdown..."
                    className="notes-editor-textarea px-8 py-6"
                  />
                ) : planContent ? (
                  <div
                    className="notes-preview-pane px-8 py-6"
                    dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(planContent, "<p>Nothing written yet.</p>") }}
                  />
                ) : (
                  <div className="px-8 py-16 text-center">
                    <p className="text-zinc-400 text-[0.9rem] mb-4">You haven&apos;t written a plan for this rotation yet.</p>
                    <button onClick={() => setPlanTab("write")} className="btn px-5 py-2 text-[0.85rem]">
                      Start Writing
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-white/5 pt-4 shrink-0">
              <button
                onClick={() => setMode("view")}
                className="btn px-4 py-2 text-[0.8rem] !bg-transparent !text-zinc-400 !border-white/10 hover:!text-white"
              >
                &larr; Back to Rotation
              </button>
              <button onClick={onClose} className="btn px-4 py-2 text-[0.8rem]">
                Close
              </button>
            </div>
          </>
        ) : mode === "edit" ? (
          <>
            <div className="pr-8 shrink-0">
              <h2 className="text-[1.4rem] font-bold text-white mb-1">
                {isNew ? "New Rotation" : "Edit Rotation"}
              </h2>
              <p className="text-[0.85rem] text-zinc-400 m-0">
                A list of items that cycles once per week, shown on the days you choose.
              </p>
            </div>

            <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.75rem] text-zinc-400 uppercase tracking-[0.05em] font-semibold">Label</span>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Weekly Reading"
                  className="bg-white/[0.03] border border-white/10 rounded-md px-3 py-2 text-[0.85rem] text-white focus:outline-none focus:border-accent"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[0.75rem] text-zinc-400 uppercase tracking-[0.05em] font-semibold">Target</span>
                <div className="flex gap-2">
                  {(["revision", "focus"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTarget(t)}
                      className={`px-3 py-1.5 rounded-md text-[0.8rem] font-semibold capitalize cursor-pointer border transition-all duration-150 ${
                        target === t
                          ? "bg-accent/15 border-accent text-accent"
                          : "bg-white/[0.02] border-white/10 text-zinc-400 hover:border-white/25"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-[0.75rem] text-zinc-400 uppercase tracking-[0.05em] font-semibold">Days of Week</span>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_DAYS.map((day) => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`w-11 py-1.5 rounded-md text-[0.75rem] font-semibold cursor-pointer border transition-all duration-150 ${
                        daysOfWeek.includes(day)
                          ? "bg-accent/15 border-accent text-accent"
                          : "bg-white/[0.02] border-white/10 text-zinc-400 hover:border-white/25"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[0.75rem] text-zinc-400 uppercase tracking-[0.05em] font-semibold">
                    Items (cycles weekly, in order)
                  </span>
                  <button
                    onClick={() => setItems((prev) => [...prev, { title: "", description: "" }])}
                    className="text-[0.75rem] text-accent cursor-pointer bg-transparent border-none"
                  >
                    + Add Item
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1.5 bg-white/[0.02] border border-white/5 rounded-md p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.7rem] text-zinc-600 font-mono w-5 shrink-0">{idx + 1}.</span>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => updateItem(idx, "title", e.target.value)}
                          placeholder="Title (e.g. Tolkien)"
                          className="flex-1 bg-transparent border-b border-white/10 px-1 py-1 text-[0.8rem] text-white focus:outline-none focus:border-accent"
                        />
                        <button
                          onClick={() => removeItem(idx)}
                          className="text-[0.75rem] text-red-400 cursor-pointer bg-transparent border-none px-1"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(idx, "description", e.target.value)}
                        placeholder="Description (optional)"
                        className="ml-7 bg-transparent border-b border-white/5 px-1 py-1 text-[0.75rem] text-zinc-400 focus:outline-none focus:border-accent"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-[0.75rem] text-zinc-400 uppercase tracking-[0.05em] font-semibold">
                  Explanation (optional)
                </span>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Why this rotation, what it covers, how to use it — written as Markdown. Viewable/editable in full any time via the Full Plan button."
                  rows={4}
                  className="bg-white/[0.03] border border-white/10 rounded-md px-3 py-2 text-[0.8rem] text-white leading-snug focus:outline-none focus:border-accent resize-y"
                />
              </label>
            </div>

            <div className="flex justify-between items-center border-t border-white/5 pt-4 shrink-0">
              {existing ? (
                <button
                  onClick={() => setMode("view")}
                  className="btn px-4 py-2 text-[0.8rem] !bg-transparent !text-zinc-400 !border-white/10 hover:!text-white"
                >
                  Cancel
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="btn px-4 py-2 text-[0.8rem] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="pr-8 shrink-0">
              <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded font-semibold uppercase font-mono tracking-[0.05em]">
                {len}-Week Cycle
              </span>
              <h2 className="text-[1.4rem] font-bold text-white mt-2 mb-1">
                {existing?.label}
              </h2>
              <p className="text-[0.85rem] text-zinc-400 m-0">
                Currently on Week {currentWeekNum} of curriculum · shows on {existing?.daysOfWeek.join(", ")} · {existing?.target}
              </p>
            </div>

            <div className="flex flex-col gap-[0.6rem] flex-1 min-h-0 overflow-y-auto pr-2">
              {existing?.items.map((item, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <div
                    key={idx}
                    onClick={() => selectActiveItem(idx)}
                    className={`flex flex-col gap-1 px-4 py-3 rounded-md cursor-pointer transition-all duration-200 ${
                      isActive
                        ? "bg-accent/[0.08] border border-accent shadow-[0_0_10px_rgba(14,165,233,0.1)]"
                        : "bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] hover:border-white/15"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-[0.8rem] font-bold ${isActive ? "text-white" : "text-zinc-400"}`}>
                        Week {idx + 1}: {item.title}
                      </span>
                      {isActive && (
                        <span className="text-[0.65rem] bg-accent text-black px-1.5 py-px rounded-[3px] font-bold uppercase">
                          Active Week
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <span className={`text-xs leading-snug ${isActive ? "text-zinc-200" : "text-zinc-500"}`}>
                        {item.description}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center border-t border-white/5 pt-4 shrink-0">
              <button
                onClick={handleDelete}
                className="btn px-4 py-2 text-[0.8rem] !bg-transparent !text-red-400 !border-red-400/20 hover:!border-red-400/50"
              >
                Delete Rotation
              </button>
              <div className="flex gap-2">
                <button
                  onClick={openPlan}
                  className="btn px-4 py-2 text-[0.8rem] !bg-transparent !text-zinc-400 !border-white/10 hover:!text-white"
                >
                  Full Plan
                </button>
                <button
                  onClick={openEdit}
                  className="btn px-4 py-2 text-[0.8rem] !bg-transparent !text-zinc-400 !border-white/10 hover:!text-white"
                >
                  Edit
                </button>
                <button
                  onClick={onClose}
                  className="btn px-4 py-2 text-[0.8rem]"
                >
                  Close
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
