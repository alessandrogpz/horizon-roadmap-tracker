"use client";

import React, { useState } from "react";
import { Check, X } from "lucide-react";
import type { RotationDef, TrackState } from "@/lib/types";
import { NEW_ITEM_KIND } from "@/lib/dayItems";
import { getWeekNum } from "@/lib/dates";
import { renderMarkdownToHtml } from "@/lib/markdown";
import { useDismiss } from "@/components/useDismiss";
import { LIMITS } from "@/lib/limits";

interface RotationModalProps {
  data: TrackState;
  /** null opens the "create a new rotation" flow. */
  rotationId: string | null;
  onClose: () => void;
  /** Applies an optimistic state update and schedules a debounced save. Takes
   *  an updater, so the debounced plan autosave below always writes against
   *  the newest track rather than the one captured at keystroke time. */
  applyChange: (updater: (previous: TrackState) => TrackState) => void;
}

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface DraftItem {
  title: string;
  description: string;
}

type ModalMode = "view" | "edit" | "plan";

export default function RotationModal({ data, rotationId, onClose, applyChange }: RotationModalProps) {
  // Lets the panel and its backdrop play their exit before whoever owns
  // this modal takes it off the page.
  const { closing, dismiss } = useDismiss(onClose);
  const isNew = rotationId === null;
  const existing = rotationId ? (data.rotations || []).find((r) => r.id === rotationId) : undefined;
  const currentWeekNum = getWeekNum(data.startDate);

  const [mode, setMode] = useState<ModalMode>(isNew ? "edit" : "view");
  const [label, setLabel] = useState(existing?.label || "");
  const [items, setItems] = useState<DraftItem[]>(
    existing?.items.map((it) => ({ title: it.title, description: it.description || "" })) || [{ title: "", description: "" }]
  );
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(existing?.daysOfWeek || []);
  /**
   * Which of the two stored lists this rotation's items land in.
   *
   * A day shows one list now, so there is nothing to choose and nothing asks:
   * an existing rotation keeps whichever it has always written to, and a new
   * one takes the list that can hold a description, which rotation items have.
   * Kept in the shape because every device and the server still store it.
   */
  const [target] = useState<"revision" | "focus">(existing?.target || NEW_ITEM_KIND);
  /** Which phase this belongs to, or `undefined` for every phase. */
  const [phase, setPhase] = useState<number | undefined>(existing?.phase);
  const [explanation, setExplanation] = useState(existing?.explanation || "");

  // The full-plan editor is a separate always-live autosave surface (like
  // /roadmap), independent from the batched edit form above — entering it
  // re-seeds from the current saved value so it never shows stale content.
  const [planContent, setPlanContent] = useState("");
  const [planTab, setPlanTab] = useState<"write" | "preview">("preview");
  const [planSaveStatus, setPlanSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const planSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!isNew && !existing) return null;

  const openEdit = () => {
    if (existing) {
      setLabel(existing.label);
      setItems(existing.items.map((it) => ({ title: it.title, description: it.description || "" })));
      setDaysOfWeek(existing.daysOfWeek);
      setPhase(existing.phase);
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
      // Omitted rather than written as undefined: an absent key is "every
      // phase", and a stored `undefined` becomes null on the way through the
      // database.
      ...(phase === undefined ? {} : { phase }),
      startWeek: existing?.startWeek ?? currentWeekNum,
      explanation: explanation.trim() || undefined,
    };

    applyChange((previous) => ({
      ...previous,
      rotations: existing
        ? (previous.rotations || []).map((r) => (r.id === rotation.id ? rotation : r))
        : [...(previous.rotations || []), rotation],
    }));

    if (isNew) dismiss();
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

    applyChange((previous) => ({
      ...previous,
      rotations: (previous.rotations || []).filter((r) => r.id !== existing.id),
      dailyRevisionItems: stripRotationItem(previous.dailyRevisionItems) || previous.dailyRevisionItems,
      dailyTasks: stripRotationItem(previous.dailyTasks) || previous.dailyTasks,
    }));
    dismiss();
  };

  // Shift which item is "current" for this week by picking one from the cycle.
  const selectActiveItem = (idx: number) => {
    if (!existing) return;
    const newStartWeek = currentWeekNum - idx;
    applyChange((previous) => ({
      ...previous,
      rotations: (previous.rotations || []).map((r) =>
        r.id === existing.id ? { ...r, startWeek: newStartWeek } : r
      ),
    }));
  };

  const persistPlan = (newContent: string) => {
    if (!existing) return;
    if (planSaveTimeoutRef.current) clearTimeout(planSaveTimeoutRef.current);
    setPlanSaveStatus("saving");
    planSaveTimeoutRef.current = setTimeout(() => {
      applyChange((previous) => ({
        ...previous,
        rotations: (previous.rotations || []).map((r) =>
          r.id === existing.id ? { ...r, explanation: newContent } : r
        ),
      }));
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
      onClick={dismiss}
      className={`modal-overlay ${closing ? "overlay-out" : "overlay-in"} fixed inset-0 z-[1000] flex items-center justify-center p-4`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${closing ? "modal-out" : "modal-in"} glass-panel panel-roomy w-full max-h-[90vh] flex flex-col gap-6 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] border border-accent-muted relative rounded-lg overflow-hidden ${
          mode === "plan" ? "max-w-[900px] h-[80vh]" : "max-w-[600px]"
        }`}
      >
        <button
          onClick={dismiss}
          className="absolute top-6 right-6 flex items-center bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          aria-label="Close"
        >
          <X size={18} strokeWidth={2} />
        </button>

        {mode === "plan" && existing ? (
          <>
            <div className="pr-8 shrink-0">
              <h2 className="type-title font-bold text-foreground mb-1">
                {existing.label}: Full Plan
              </h2>
              <p className="type-body text-muted-foreground m-0">
                This rotation&apos;s own private plan — autosaves.
              </p>
            </div>

            <div className="glass-panel panel-flush !border-card-border flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-card-border px-6 pt-4 shrink-0">
                <div className="flex gap-1">
                  <button
                    className={`px-4 py-2 type-label font-semibold border-b-2 -mb-px cursor-pointer bg-transparent ${
                      planTab === "write" ? "text-accent border-accent" : "text-muted-foreground border-transparent hover:text-foreground"
                    }`}
                    onClick={() => setPlanTab("write")}
                  >
                    Write
                  </button>
                  <button
                    className={`px-4 py-2 type-label font-semibold border-b-2 -mb-px cursor-pointer bg-transparent ${
                      planTab === "preview" ? "text-accent border-accent" : "text-muted-foreground border-transparent hover:text-foreground"
                    }`}
                    onClick={() => setPlanTab("preview")}
                  >
                    Preview
                  </button>
                </div>
                <span className="type-caption font-mono text-muted-foreground pb-2 inline-flex items-center gap-1">
                  {planSaveStatus === "saving" && "Saving..."}
                  {planSaveStatus === "saved" && (<><Check size={12} strokeWidth={2.5} /> Saved</>)}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
                {planTab === "write" ? (
                  <textarea
                  maxLength={LIMITS.document}
                    value={planContent}
                    onChange={(e) => handlePlanChange(e.target.value)}
                    aria-label="Rotation plan, in Markdown"
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
                    <p className="text-muted-foreground type-subhead mb-4">You haven&apos;t written a plan for this rotation yet.</p>
                    <button onClick={() => setPlanTab("write")} className="btn px-5 py-2 type-body">
                      Start Writing
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-card-border pt-4 shrink-0">
              <button
                onClick={() => setMode("view")}
                className="btn px-4 py-2 type-label !bg-transparent !text-muted-foreground !border-card-border hover:!text-foreground"
              >
                &larr; Back to Rotation
              </button>
              <button onClick={dismiss} className="btn px-4 py-2 type-label">
                Close
              </button>
            </div>
          </>
        ) : mode === "edit" ? (
          <>
            <div className="pr-8 shrink-0">
              <h2 className="type-title font-bold text-foreground mb-1">
                {isNew ? "New Rotation" : "Edit Rotation"}
              </h2>
              <p className="type-body text-muted-foreground m-0">
                A list of items that cycles once per week, shown on the days you choose.
              </p>
            </div>

            <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
              <label className="flex flex-col gap-1.5">
                <span className="type-label text-muted-foreground font-semibold">Label</span>
                <input
                  type="text"
                  maxLength={LIMITS.name}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Weekly Reading"
                  className="bg-surface-muted border border-card-border rounded-md px-3 py-2 type-body text-foreground focus:outline-none focus:border-accent"
                />
              </label>

              {/* Which phase this belongs to. A cycle and a curriculum are
                  different shapes: ten topics on a twenty-four week track
                  wrap and repeat, so you meet the same ones in phase three
                  that you met in phase one. Scoped, a short rotation per
                  phase works through them once and is done by the end. */}
              <div className="flex flex-col gap-1.5">
                <span className="type-label text-muted-foreground font-semibold">
                  Runs during
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setPhase(undefined)}
                    className={`px-3 py-1.5 rounded-md type-label font-semibold cursor-pointer border transition-colors duration-150 ${
                      phase === undefined
                        ? "bg-accent/15 border-accent text-accent"
                        : "bg-surface-muted border-card-border text-muted-foreground hover:border-card-border-hover"
                    }`}
                  >
                    Every phase
                  </button>
                  {(data.phases || []).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPhase(p.id)}
                      title={p.title}
                      className={`max-w-[11rem] truncate px-3 py-1.5 rounded-md type-label font-semibold cursor-pointer border transition-colors duration-150 ${
                        phase === p.id
                          ? "bg-accent/15 border-accent text-accent"
                          : "bg-surface-muted border-card-border text-muted-foreground hover:border-card-border-hover"
                      }`}
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
                <span className="type-caption text-subtle-foreground">
                  {phase === undefined
                    ? "Shows on its days whatever phase you are on."
                    : "Hidden until the track reaches that phase, and gone once it moves past."}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="type-label text-muted-foreground font-semibold">Days of Week</span>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_DAYS.map((day) => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`w-11 py-1.5 rounded-md type-label font-semibold cursor-pointer border transition-colors duration-150 ${
                        daysOfWeek.includes(day)
                          ? "bg-accent/15 border-accent text-accent"
                          : "bg-surface-muted border-card-border text-muted-foreground hover:border-card-border-hover"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="type-label text-muted-foreground font-semibold">
                    Items (cycles weekly, in order)
                  </span>
                  <button
                    onClick={() => setItems((prev) => [...prev, { title: "", description: "" }])}
                    className="type-label text-accent cursor-pointer bg-transparent border-none"
                  >
                    + Add Item
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1.5 bg-surface-muted border border-card-border rounded-md p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="type-caption text-subtle-foreground font-mono w-5 shrink-0">{idx + 1}.</span>
                        <input
                          type="text"
                          maxLength={LIMITS.title}
                          value={item.title}
                          onChange={(e) => updateItem(idx, "title", e.target.value)}
                          placeholder="Title (e.g. Tolkien)"
                          className="flex-1 bg-transparent border-b border-card-border px-1 py-1 type-label text-foreground focus:outline-none focus:border-accent"
                        />
                        <button
                          onClick={() => removeItem(idx)}
                          className="flex items-center text-danger cursor-pointer bg-transparent border-none px-1"
                          title="Remove item"
                        >
                          <X size={14} strokeWidth={2} />
                        </button>
                      </div>
                      <input
                        type="text"
                        maxLength={LIMITS.description}
                        value={item.description}
                        onChange={(e) => updateItem(idx, "description", e.target.value)}
                        placeholder="Description (optional)"
                        className="ml-7 bg-transparent border-b border-card-border px-1 py-1 type-label text-muted-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="type-label text-muted-foreground font-semibold">
                  Explanation (optional)
                </span>
                <textarea
                maxLength={LIMITS.document}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Why this rotation, what it covers, how to use it — written as Markdown. Viewable/editable in full any time via the Full Plan button."
                  rows={4}
                  className="bg-surface-muted border border-card-border rounded-md px-3 py-2 type-label text-foreground focus:outline-none focus:border-accent resize-y"
                />
              </label>
            </div>

            <div className="flex justify-between items-center border-t border-card-border pt-4 shrink-0">
              {existing ? (
                <button
                  onClick={() => setMode("view")}
                  className="btn px-4 py-2 type-label !bg-transparent !text-muted-foreground !border-card-border hover:!text-foreground"
                >
                  Cancel
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="btn px-4 py-2 type-label disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="pr-8 shrink-0">
              <span className="type-caption bg-accent/10 text-accent px-2 py-0.5 rounded font-semibold font-mono">
                {len}-Week Cycle
              </span>
              <h2 className="type-title font-bold text-foreground mt-2 mb-1">
                {existing?.label}
              </h2>
              <p className="type-body text-muted-foreground m-0">
                Currently on Week {currentWeekNum} of curriculum · shows on {existing?.daysOfWeek.join(", ")}
              </p>
            </div>

            <div className="flex flex-col gap-[0.6rem] flex-1 min-h-0 overflow-y-auto pr-2">
              {existing?.items.map((item, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <div
                    key={idx}
                    onClick={() => selectActiveItem(idx)}
                    className={`flex flex-col gap-1 px-4 py-3 rounded-md cursor-pointer transition-[background-color,border-color,box-shadow] duration-200 ${
                      isActive
                        ? "bg-accent/[0.08] border border-accent shadow-[0_0_10px_rgba(14,165,233,0.1)]"
                        : "bg-surface-muted border border-card-border hover:bg-surface-hover hover:border-card-border-hover"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`type-label font-bold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        Week {idx + 1}: {item.title}
                      </span>
                      {isActive && (
                        <span className="type-micro bg-accent text-black px-1.5 py-px rounded-[3px] font-bold">
                          Active Week
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <span className={`type-caption leading-snug ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {item.description}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center border-t border-card-border pt-4 shrink-0">
              {confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="type-label text-danger">Delete this rotation?</span>
                  <button
                    onClick={handleDelete}
                    className="btn px-3 py-1.5 type-label !bg-danger/15 !text-danger !border-danger/40"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="btn px-3 py-1.5 type-label !bg-transparent !text-muted-foreground !border-card-border"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="btn px-4 py-2 type-label !bg-transparent !text-danger !border-danger/20 hover:!border-danger/50"
                >
                  Delete Rotation
                </button>
              )}
              <div className="flex gap-2">
                <button
                  onClick={openPlan}
                  className="btn px-4 py-2 type-label !bg-transparent !text-muted-foreground !border-card-border hover:!text-foreground"
                >
                  Full Plan
                </button>
                <button
                  onClick={openEdit}
                  className="btn px-4 py-2 type-label !bg-transparent !text-muted-foreground !border-card-border hover:!text-foreground"
                >
                  Edit
                </button>
                <button
                  onClick={dismiss}
                  className="btn px-4 py-2 type-label"
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
