"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FocusType, Material, Phase, PortfolioProject, RotationDef, WeekDay, Workspace } from "@/lib/types";
import { TEMPLATE_LIST, seedTrackFromTemplate, type TrackTemplate } from "@/lib/templates";
import { createTrack } from "@/lib/workspaceRepo";
import { todayYMD } from "@/lib/dates";
import { rescalePhaseDeadlines } from "@/lib/phases";
import HorizonMark from "@/components/HorizonMark";
import WizardStepper from "@/components/onboarding/WizardStepper";
import TemplatePicker from "@/components/onboarding/TemplatePicker";
import TrackIdentityStep from "@/components/onboarding/TrackIdentityStep";
import HorizonStep from "@/components/onboarding/HorizonStep";
import PhaseReviewStep from "@/components/onboarding/PhaseReviewStep";
import RoadmapStep, { buildRoadmapOutline } from "@/components/onboarding/RoadmapStep";
import RhythmStep from "@/components/onboarding/RhythmStep";
import MaterialsSeedStep from "@/components/onboarding/MaterialsSeedStep";
import ConnectExistingAccount from "@/components/onboarding/ConnectExistingAccount";
import AIGoalStep from "@/components/onboarding/AIGoalStep";
import type { ValidatedRoadmap } from "@/lib/ai/validate";

interface WizardDraft {
  templateId: string;
  name: string;
  color: string;
  startDate: string;
  durationDays: number;
  phases: Phase[];
  weekSchedule: WeekDay[];
  focusTypes: Record<string, FocusType>;
  materials: Omit<Material, "id">[];
  portfolio: Omit<PortfolioProject, "id">[];
  rotations: Omit<RotationDef, "id">[];
  roadmapContent: string;
}

const STEPS = ["Template", "Identity", "Horizon", "Phases", "Roadmap", "Rhythm", "Materials"] as const;

const draftFromTemplate = (template: TrackTemplate): WizardDraft => ({
  templateId: template.id,
  name: template.label,
  color: template.defaultColor,
  startDate: todayYMD(),
  durationDays: template.defaultDurationDays,
  phases: template.buildPhases(template.defaultDurationDays),
  weekSchedule: template.defaultWeekSchedule,
  focusTypes: template.defaultFocusTypes,
  materials: template.defaultMaterials || [],
  portfolio: template.defaultPortfolio || [],
  rotations: [],
  roadmapContent: "",
});

type EntryChoice = "unset" | "connect" | "fresh";

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAddMode = searchParams.get("mode") === "add";

  // Adding a track to an existing account skips straight to the wizard —
  // the "connect an existing account" choice only makes sense on first run.
  const [entryChoice, setEntryChoice] = useState<EntryChoice>(isAddMode ? "fresh" : "unset");

  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>(() => draftFromTemplate(TEMPLATE_LIST[0]));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  /** The goal the user typed, when they came in via AI. Carried forward so the
   *  Roadmap step can draft a document that aims at the same thing. */
  const [goal, setGoal] = useState("");
  /** Repairs the validator applied, surfaced once on the Phases step so the
   *  user knows the plan was adjusted rather than generated exactly as shown. */
  const [aiAdjustments, setAIAdjustments] = useState<string[]>([]);
  /** Whether the phases hold real content rather than template scaffolding.
   *  Changing the duration rebuilds template phases from scratch, which would
   *  silently destroy a generated plan — so generated phases get rescaled. */
  const [phasesAreGenerated, setPhasesAreGenerated] = useState(false);

  const template = TEMPLATE_LIST.find((t) => t.id === draft.templateId) || TEMPLATE_LIST[0];
  const currentStep = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const canProceed = (() => {
    switch (currentStep) {
      case "Template": return !!draft.templateId;
      case "Identity": return draft.name.trim().length > 0;
      case "Horizon": return draft.startDate.length > 0 && draft.durationDays > 0;
      case "Phases": return draft.phases.length > 0;
      case "Roadmap": return true;
      case "Rhythm": return draft.weekSchedule.length === 7;
      case "Materials": return true;
      default: return true;
    }
  })();

  const handleFinish = async () => {
    setCreating(true);
    setCreateError("");
    try {
      const track = seedTrackFromTemplate(template, {
        name: draft.name.trim(),
        color: draft.color,
        startDate: draft.startDate,
        phases: draft.phases,
        weekSchedule: draft.weekSchedule,
        focusTypes: draft.focusTypes,
        materials: draft.materials.filter((m) => m.title.trim().length > 0),
        portfolio: draft.portfolio.filter((p) => p.title.trim().length > 0),
        rotations: draft.rotations,
        roadmapContent: draft.roadmapContent,
      });
      await createTrack(track);
      router.push("/");
    } catch (err) {
      console.error("Failed to create track", err);
      setCreateError(err instanceof Error ? err.message : "Failed to create track");
      setCreating(false);
    }
  };

  /**
   * Merges a generated roadmap over a fresh template draft and jumps to review.
   *
   * D5: this only ever fills the *draft*. It cannot touch an existing track or
   * the workspace — creation still goes through seedTrackFromTemplate and
   * createTrack at the end of the wizard, like every other path.
   */
  const applyGeneratedDraft = (roadmap: ValidatedRoadmap, sourceGoal: string) => {
    setDraft((d) => ({
      ...d,
      name: roadmap.name,
      color: roadmap.color,
      phases: roadmap.phases,
      weekSchedule: roadmap.weekSchedule,
      focusTypes: roadmap.focusTypes,
      materials: roadmap.materials,
      portfolio: roadmap.portfolio,
      rotations: roadmap.rotations,
      // Left empty on purpose: the Roadmap step drafts this separately, so the
      // user isn't paying for a long document they may not want.
      roadmapContent: "",
    }));
    setGoal(sourceGoal);
    setAIAdjustments(roadmap.adjustments);
    setPhasesAreGenerated(true);
    setStepIndex(STEPS.indexOf("Phases"));
  };

  const goNext = () => {
    if (isLastStep) {
      handleFinish();
      return;
    }
    // Auto-fill a starter roadmap outline from the phases just reviewed —
    // only if the user hasn't already written something of their own.
    if (currentStep === "Phases" && !draft.roadmapContent) {
      setDraft((d) => ({ ...d, roadmapContent: buildRoadmapOutline(d.name, d.phases) }));
    }
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  };

  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  const handleConnected = (workspace: Workspace) => {
    void workspace;
    router.push("/");
  };

  if (entryChoice === "unset") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[560px] flex flex-col gap-6">
          <div>
            <h1 className="text-[1.6rem] font-bold text-foreground m-0 flex items-center gap-2">
              <HorizonMark className="h-[0.8em] w-auto text-accent" /> Welcome to Horizon
            </h1>
            <p className="text-muted-foreground text-[0.9rem] mt-1">
              Is this a new setup, or do you already have an account synced elsewhere?
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setEntryChoice("fresh")}
              className="glass-panel p-5 text-left cursor-pointer border border-card-border hover:border-card-border-hover transition-all duration-150"
            >
              <span className="text-foreground font-semibold text-[0.95rem] block mb-1">Start fresh</span>
              <span className="text-muted-foreground text-[0.8rem]">Build a new roadmap from scratch.</span>
            </button>
            <button
              onClick={() => setEntryChoice("connect")}
              className="glass-panel p-5 text-left cursor-pointer border border-card-border hover:border-card-border-hover transition-all duration-150"
            >
              <span className="text-foreground font-semibold text-[0.95rem] block mb-1">I already have an account</span>
              <span className="text-muted-foreground text-[0.8rem]">Connect Google Drive to pull down your existing tracks — e.g. opening on a new device for the first time.</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (entryChoice === "connect") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[560px] flex flex-col gap-6">
          <div>
            <h1 className="text-[1.6rem] font-bold text-foreground m-0 flex items-center gap-2">
              <HorizonMark className="h-[0.8em] w-auto text-accent" /> Welcome to Horizon
            </h1>
          </div>
          <div className="glass-panel p-6 sm:p-8">
            <ConnectExistingAccount onConnected={handleConnected} onBack={() => setEntryChoice("unset")} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-[720px] flex flex-col gap-6">
        <div>
          <h1 className="text-[1.6rem] font-bold text-foreground m-0 flex items-center gap-2">
            <HorizonMark className="h-[0.8em] w-auto text-accent" /> {isAddMode ? "New Track" : "Welcome to Horizon"}
          </h1>
          <p className="text-muted-foreground text-[0.9rem] mt-1">
            {isAddMode
              ? "Set up a new roadmap alongside your existing tracks."
              : "Let's set up your first roadmap — pick a starting point, then make it yours."}
          </p>
        </div>

        <WizardStepper steps={STEPS} currentIndex={stepIndex} />

        <div className="glass-panel p-6 sm:p-8 min-h-[360px]">
          {currentStep === "Template" && (
            <>
              <TemplatePicker
                templates={TEMPLATE_LIST}
                selectedId={draft.templateId}
                onSelect={(t) => {
                  // A fresh template replaces the phases outright, so anything
                  // previously generated is gone — drop the flag and the notice
                  // with it rather than letting them describe stale content.
                  setDraft(draftFromTemplate(t));
                  setPhasesAreGenerated(false);
                  setAIAdjustments([]);
                  setGoal("");
                }}
              />
              <AIGoalStep
                durationDays={draft.durationDays}
                onDurationChange={(durationDays) =>
                  setDraft((d) => ({
                    ...d,
                    durationDays,
                    // Still template scaffolding at this point; keep it in step
                    // with the horizon so a user who skips generation isn't
                    // left with phases sized for the old duration.
                    phases: template.buildPhases(durationDays),
                  }))
                }
                onGenerated={applyGeneratedDraft}
              />
            </>
          )}
          {currentStep === "Identity" && (
            <TrackIdentityStep
              name={draft.name}
              color={draft.color}
              onChange={(fields) => setDraft((d) => ({ ...d, ...fields }))}
            />
          )}
          {currentStep === "Horizon" && (
            <HorizonStep
              startDate={draft.startDate}
              durationDays={draft.durationDays}
              onChange={(fields) =>
                setDraft((d) => {
                  const next = { ...d, ...fields };
                  if (fields.durationDays !== undefined && fields.durationDays !== d.durationDays) {
                    // Template phases are scaffolding and cheap to rebuild.
                    // Generated ones carry titles, tasks and deliverables the
                    // user came here for — move their dates, don't discard them.
                    next.phases = phasesAreGenerated
                      ? rescalePhaseDeadlines(d.phases, d.durationDays, fields.durationDays)
                      : template.buildPhases(fields.durationDays);
                  }
                  return next;
                })
              }
            />
          )}
          {currentStep === "Phases" && (
            <div className="flex flex-col gap-4">
              {aiAdjustments.length > 0 && (
                <div className="rounded-md border border-card-border bg-surface-muted p-3 text-[0.8rem] text-muted-foreground">
                  <span className="font-semibold text-foreground">Generated, with adjustments:</span>{" "}
                  {aiAdjustments.join("; ")}. Everything below is editable.
                </div>
              )}
              <PhaseReviewStep phases={draft.phases} onChange={(phases) => setDraft((d) => ({ ...d, phases }))} />
            </div>
          )}
          {currentStep === "Roadmap" && (
            <RoadmapStep
              trackName={draft.name}
              phases={draft.phases}
              content={draft.roadmapContent}
              goal={goal}
              onChange={(roadmapContent) => setDraft((d) => ({ ...d, roadmapContent }))}
            />
          )}
          {currentStep === "Rhythm" && (
            <RhythmStep
              weekSchedule={draft.weekSchedule}
              focusTypes={draft.focusTypes}
              onChange={(weekSchedule, focusTypes) => setDraft((d) => ({ ...d, weekSchedule, focusTypes }))}
            />
          )}
          {currentStep === "Materials" && (
            <MaterialsSeedStep
              materials={draft.materials}
              onChange={(materials) => setDraft((d) => ({ ...d, materials }))}
              portfolio={draft.portfolio}
              onPortfolioChange={(portfolio) => setDraft((d) => ({ ...d, portfolio }))}
              rotations={draft.rotations}
              onRotationsChange={(rotations) => setDraft((d) => ({ ...d, rotations }))}
              isGenerated={phasesAreGenerated}
            />
          )}
        </div>

        {createError && (
          <div className="p-3 bg-card rounded-md border border-red-500/30 text-red-400 text-[0.85rem]">
            {createError}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div>
            {stepIndex > 0 && (
              <button
                onClick={goBack}
                className="btn px-4 py-2 text-[0.85rem] !bg-transparent !text-muted-foreground !border-card-border hover:!text-foreground"
              >
                Back
              </button>
            )}
            {stepIndex === 0 && isAddMode && (
              <Link
                href="/"
                className="btn px-4 py-2 text-[0.85rem] !bg-transparent !text-muted-foreground !border-card-border hover:!text-foreground no-underline inline-block"
              >
                Cancel
              </Link>
            )}
            {stepIndex === 0 && !isAddMode && (
              <button
                onClick={() => setEntryChoice("unset")}
                className="btn px-4 py-2 text-[0.85rem] !bg-transparent !text-muted-foreground !border-card-border hover:!text-foreground"
              >
                Back
              </button>
            )}
          </div>
          <button
            onClick={goNext}
            disabled={!canProceed || creating}
            className="btn px-6 py-2 text-[0.85rem] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLastStep ? (creating ? "Creating..." : "Create Track") : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingContent />
    </Suspense>
  );
}
