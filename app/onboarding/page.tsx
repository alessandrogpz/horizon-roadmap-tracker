"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FocusType, Material, Phase, WeekDay } from "@/lib/types";
import { TEMPLATE_LIST, seedTrackFromTemplate, type TrackTemplate } from "@/lib/templates";
import { createTrack } from "@/lib/api";
import { todayYMD } from "@/lib/dates";
import WizardStepper from "@/components/onboarding/WizardStepper";
import TemplatePicker from "@/components/onboarding/TemplatePicker";
import TrackIdentityStep from "@/components/onboarding/TrackIdentityStep";
import HorizonStep from "@/components/onboarding/HorizonStep";
import PhaseReviewStep from "@/components/onboarding/PhaseReviewStep";
import RhythmStep from "@/components/onboarding/RhythmStep";
import MaterialsSeedStep from "@/components/onboarding/MaterialsSeedStep";

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
}

const STEPS = ["Template", "Identity", "Horizon", "Phases", "Rhythm", "Materials"] as const;

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
});

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAddMode = searchParams.get("mode") === "add";

  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>(() => draftFromTemplate(TEMPLATE_LIST[0]));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const template = TEMPLATE_LIST.find((t) => t.id === draft.templateId) || TEMPLATE_LIST[0];
  const currentStep = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const canProceed = (() => {
    switch (currentStep) {
      case "Template": return !!draft.templateId;
      case "Identity": return draft.name.trim().length > 0;
      case "Horizon": return draft.startDate.length > 0 && draft.durationDays > 0;
      case "Phases": return draft.phases.length > 0;
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
      });
      await createTrack(track);
      router.push("/");
    } catch (err) {
      console.error("Failed to create track", err);
      setCreateError(err instanceof Error ? err.message : "Failed to create track");
      setCreating(false);
    }
  };

  const goNext = () => {
    if (isLastStep) {
      handleFinish();
    } else {
      setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
    }
  };

  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-[720px] flex flex-col gap-6">
        <div>
          <h1 className="text-[1.6rem] font-bold text-white m-0 flex items-center gap-2">
            <span className="text-accent">&gt;_</span> {isAddMode ? "New Track" : "Welcome to Horizon"}
          </h1>
          <p className="text-zinc-400 text-[0.9rem] mt-1">
            {isAddMode
              ? "Set up a new roadmap alongside your existing tracks."
              : "Let's set up your first roadmap — pick a starting point, then make it yours."}
          </p>
        </div>

        <WizardStepper steps={STEPS} currentIndex={stepIndex} />

        <div className="glass-panel p-6 sm:p-8 min-h-[360px]">
          {currentStep === "Template" && (
            <TemplatePicker
              templates={TEMPLATE_LIST}
              selectedId={draft.templateId}
              onSelect={(t) => setDraft(draftFromTemplate(t))}
            />
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
                    next.phases = template.buildPhases(fields.durationDays);
                  }
                  return next;
                })
              }
            />
          )}
          {currentStep === "Phases" && (
            <PhaseReviewStep phases={draft.phases} onChange={(phases) => setDraft((d) => ({ ...d, phases }))} />
          )}
          {currentStep === "Rhythm" && (
            <RhythmStep
              weekSchedule={draft.weekSchedule}
              focusTypes={draft.focusTypes}
              onChange={(weekSchedule, focusTypes) => setDraft((d) => ({ ...d, weekSchedule, focusTypes }))}
            />
          )}
          {currentStep === "Materials" && (
            <MaterialsSeedStep materials={draft.materials} onChange={(materials) => setDraft((d) => ({ ...d, materials }))} />
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
                className="btn px-4 py-2 text-[0.85rem] !bg-transparent !text-zinc-400 !border-white/10 hover:!text-white"
              >
                Back
              </button>
            )}
            {stepIndex === 0 && isAddMode && (
              <Link
                href="/"
                className="btn px-4 py-2 text-[0.85rem] !bg-transparent !text-zinc-400 !border-white/10 hover:!text-white no-underline inline-block"
              >
                Cancel
              </Link>
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
