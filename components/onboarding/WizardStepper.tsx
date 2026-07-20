"use client";

import React from "react";

interface WizardStepperProps {
  steps: readonly string[];
  currentIndex: number;
}

export default function WizardStepper({ steps, currentIndex }: WizardStepperProps) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, idx) => (
        <React.Fragment key={step}>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.7rem] font-bold font-mono shrink-0 ${
                idx < currentIndex
                  ? "bg-success text-black"
                  : idx === currentIndex
                    ? "bg-accent text-black"
                    : "bg-white/[0.06] text-zinc-500 border border-white/10"
              }`}
            >
              {idx < currentIndex ? "✓" : idx + 1}
            </div>
            <span className={`text-[0.75rem] hidden sm:inline ${idx === currentIndex ? "text-white font-semibold" : "text-zinc-500"}`}>
              {step}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`flex-1 h-px ${idx < currentIndex ? "bg-success" : "bg-white/10"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
