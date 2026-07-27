"use client";

import React, { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { hasAIConfigured } from "@/lib/ai/provider";
import { generateRoadmap } from "@/lib/ai/generateRoadmap";
import type { ValidatedRoadmap } from "@/lib/ai/validate";
import { useGeneration } from "@/lib/ai/useGeneration";

interface AIGoalStepProps {
  durationDays: number;
  /** Lifted rather than local: the horizon chosen here is the one the whole
   *  wizard uses afterwards, and the model is told the same number the
   *  validator enforces. Keeping a private copy is how they drift apart. */
  onDurationChange: (durationDays: number) => void;
  onGenerated: (roadmap: ValidatedRoadmap, goal: string) => void;
}

const DURATION_PRESETS = [
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "6 months", value: 180 },
  { label: "1 year", value: 365 },
];

/**
 * The AI entry point, shown alongside the template picker.
 *
 * Nothing here writes to the workspace. Generation fills the wizard draft and
 * drops the user on the phase review step with everything editable — that
 * human-in-the-loop pass is what makes a generated roadmap acceptable rather
 * than embarrassing, and nothing persists until "Create Track" on the last
 * step, exactly as without AI.
 */
export default function AIGoalStep({ durationDays, onDurationChange, onGenerated }: AIGoalStepProps) {
  const [goal, setGoal] = useState("");
  const [aiReady] = useState(hasAIConfigured);
  const { busy, error, run, cancel } = useGeneration<ValidatedRoadmap>();

  if (!aiReady) return null;

  // Screening found the lowest-signal prompt ("I want to get better at music")
  // produced the weakest output at every model size. Nudging toward specifics
  // is cheaper than repairing mush.
  const tooVague = goal.trim().length > 0 && goal.trim().length < 15;

  const handleGenerate = () => {
    void run(
      (signal) => generateRoadmap(goal, durationDays, signal),
      (roadmap) => onGenerated(roadmap, goal.trim()),
    );
  };

  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-card-border pt-6">
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-[0.95rem] font-semibold text-foreground">Or describe your goal</h3>
        <p className="m-0 text-[0.8rem] text-muted-foreground">
          Generate a starting roadmap you can edit. Your goal is sent to the AI provider you configured in
          Settings — nothing is saved until you finish the wizard.
        </p>
      </div>

      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        disabled={busy}
        rows={3}
        placeholder="e.g. Learn Vulkan, C++ memory management, and graphics rendering in 3 months"
        className="min-h-[76px] resize-y rounded-md border border-card-border bg-input-bg p-3 font-[inherit] text-[0.85rem] leading-relaxed text-foreground outline-none disabled:opacity-50"
      />

      {tooVague && (
        <p className="m-0 text-[0.78rem] text-muted-foreground">
          The more specific you are, the better this works. Name what you want to be able to do.
        </p>
      )}

      {/* Set here rather than on the later Horizon step: this number goes into
          the prompt, so if it isn't chosen before generating, a goal saying
          "in 13 months" contradicts a prompt saying "180 days". */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[0.8rem] text-muted-foreground">How long do you have?</label>
        <div className="flex flex-wrap items-center gap-2">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => onDurationChange(preset.value)}
              disabled={busy}
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-[0.85rem] transition-all duration-150 disabled:opacity-40 ${
                durationDays === preset.value
                  ? "border-accent bg-accent/[0.1] text-foreground"
                  : "border-card-border bg-surface-muted text-muted-foreground hover:border-card-border-hover"
              }`}
            >
              {preset.label}
            </button>
          ))}
          <input
            type="number"
            min={1}
            value={durationDays}
            disabled={busy}
            onChange={(e) => onDurationChange(Math.max(1, Number(e.target.value) || 1))}
            className="w-28 rounded-md border border-card-border bg-input-bg px-3 py-1.5 font-[inherit] text-[0.85rem] text-foreground outline-none disabled:opacity-40"
          />
        </div>
      </div>

      {error && (
        <div className="whitespace-pre-line rounded-md border border-red-500/30 bg-card p-3 text-[0.85rem] text-red-400">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={busy || goal.trim().length === 0}
          className="btn flex items-center gap-2 px-4 py-2 text-[0.82rem] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && <LoaderCircle className="animate-spin" size={14} strokeWidth={2.5} />}
          {busy ? "Generating…" : "Generate roadmap"}
        </button>
        {busy && (
          <button
            onClick={cancel}
            className="cursor-pointer border-none bg-transparent p-0 font-mono text-xs text-muted-foreground underline"
          >
            Cancel
          </button>
        )}
        <span className="text-[0.75rem] text-muted-foreground">
          Generates a {durationDays}-day plan. You review and edit everything before it&apos;s saved.
        </span>
      </div>
    </div>
  );
}
