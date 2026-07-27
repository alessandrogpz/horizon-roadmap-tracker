"use client";

import React from "react";
import { X } from "lucide-react";
import type { Material, PortfolioProject, RotationDef } from "@/lib/types";

interface MaterialsSeedStepProps {
  materials: Omit<Material, "id">[];
  onChange: (materials: Omit<Material, "id">[]) => void;
  /** Generated alongside the materials. Reviewable here rather than silently
   *  saved — this is the last step before the track is created, and nothing
   *  generated should reach the workspace without having been seen. */
  portfolio?: Omit<PortfolioProject, "id">[];
  onPortfolioChange?: (portfolio: Omit<PortfolioProject, "id">[]) => void;
  rotations?: Omit<RotationDef, "id">[];
  onRotationsChange?: (rotations: Omit<RotationDef, "id">[]) => void;
  /** True when this content came from the model, which changes what needs
   *  saying: generated titles are plausible but unverified. */
  isGenerated?: boolean;
}

export default function MaterialsSeedStep({
  materials,
  onChange,
  portfolio = [],
  onPortfolioChange,
  rotations = [],
  onRotationsChange,
  isGenerated = false,
}: MaterialsSeedStepProps) {
  const updateMaterial = (idx: number, fields: Partial<Material>) => {
    onChange(materials.map((m, i) => (i === idx ? { ...m, ...fields } : m)));
  };

  const removeMaterial = (idx: number) => {
    onChange(materials.filter((_, i) => i !== idx));
  };

  const addMaterial = () => {
    onChange([
      ...materials,
      { title: "", category: "General", type: "Book", status: "Not Started", currentPage: 0, totalPages: 0, currentSubject: "", link: "" },
    ]);
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[1.1rem] font-semibold text-foreground m-0">Starter materials (optional)</h2>
      <p className="text-muted-foreground text-[0.85rem] m-0">
        Books, courses, or references you&apos;ll track progress on. You can add more anytime from the dashboard.
      </p>

      {isGenerated && materials.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-3 text-[0.8rem] text-muted-foreground">
          <span className="font-semibold text-foreground">
            These titles and authors are AI-suggested and unverified.
          </span>{" "}
          Models produce plausible-sounding books that don&apos;t exist, and misattribute real ones, so check
          anything you don&apos;t recognise. No links were generated — each material gets a &ldquo;find&rdquo;
          search on the dashboard instead, which is also how you&apos;ll spot one that isn&apos;t real.
        </div>
      )}

      <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
        {materials.map((m, idx) => (
          <div key={idx} className="flex items-center gap-2 bg-input-bg border border-card-border rounded-md px-3 py-2">
            <div className="flex flex-1 flex-col">
              <input
                type="text"
                value={m.title}
                onChange={(e) => updateMaterial(idx, { title: e.target.value })}
                placeholder="Title"
                className="border-none bg-transparent text-[0.85rem] text-foreground outline-none"
              />
              <input
                type="text"
                value={m.author ?? ""}
                onChange={(e) => updateMaterial(idx, { author: e.target.value })}
                placeholder="Author (optional)"
                className="border-none bg-transparent text-[0.75rem] text-muted-foreground outline-none"
              />
            </div>
            <input
              type="text"
              value={m.category}
              onChange={(e) => updateMaterial(idx, { category: e.target.value })}
              placeholder="Category"
              className="w-28 bg-input-bg border border-card-border rounded px-2 py-1 text-foreground text-[0.8rem] outline-none"
            />
            <button
              onClick={() => removeMaterial(idx)}
              className="flex items-center bg-transparent border-none text-red-500 cursor-pointer"
              aria-label="Remove material"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        ))}
        {materials.length === 0 && (
          <p className="text-subtle-foreground text-[0.8rem] italic">No starter materials yet.</p>
        )}
      </div>

      <button onClick={addMaterial} className="btn px-3 py-1.5 text-[0.8rem] self-start">
        + Add Material
      </button>

      {portfolio.length > 0 && onPortfolioChange && (
        <div className="flex flex-col gap-2 border-t border-card-border pt-4">
          <h3 className="m-0 text-[0.95rem] font-semibold text-foreground">Projects to build</h3>
          <p className="m-0 text-[0.8rem] text-muted-foreground">
            Tracked in your portfolio. Remove anything you don&apos;t intend to build.
          </p>
          {portfolio.map((project, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-md border border-card-border bg-input-bg px-3 py-2"
            >
              <input
                type="text"
                value={project.title}
                onChange={(e) =>
                  onPortfolioChange(
                    portfolio.map((p, i) => (i === idx ? { ...p, title: e.target.value } : p)),
                  )
                }
                className="flex-1 border-none bg-transparent text-[0.85rem] text-foreground outline-none"
              />
              <button
                onClick={() => onPortfolioChange(portfolio.filter((_, i) => i !== idx))}
                className="flex items-center border-none bg-transparent text-red-500 cursor-pointer"
                aria-label="Remove project"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      {rotations.length > 0 && onRotationsChange && (
        <div className="flex flex-col gap-2 border-t border-card-border pt-4">
          <h3 className="m-0 text-[0.95rem] font-semibold text-foreground">Weekly rotations</h3>
          <p className="m-0 text-[0.8rem] text-muted-foreground">
            Recurring cycles that advance one item per week. Edit the items themselves later from the dashboard.
          </p>
          {rotations.map((rotation, idx) => (
            <div key={idx} className="flex flex-col gap-1 rounded-md border border-card-border bg-input-bg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[0.85rem] font-semibold text-foreground">{rotation.label}</span>
                <button
                  onClick={() => onRotationsChange(rotations.filter((_, i) => i !== idx))}
                  className="flex items-center border-none bg-transparent text-red-500 cursor-pointer"
                  aria-label="Remove rotation"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
              <span className="text-[0.76rem] text-muted-foreground">
                {rotation.items.length} items · {rotation.daysOfWeek.join(", ")} ·{" "}
                {rotation.target === "focus" ? "daily focus" : "revision"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
