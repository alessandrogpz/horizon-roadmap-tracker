"use client";

import React from "react";
import { X } from "lucide-react";
import type { Material } from "@/lib/types";

interface MaterialsSeedStepProps {
  materials: Omit<Material, "id">[];
  onChange: (materials: Omit<Material, "id">[]) => void;
}

export default function MaterialsSeedStep({ materials, onChange }: MaterialsSeedStepProps) {
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
      <h2 className="text-[1.1rem] font-semibold text-white m-0">Starter materials (optional)</h2>
      <p className="text-zinc-400 text-[0.85rem] m-0">
        Books, courses, or references you&apos;ll track progress on. You can add more anytime from the dashboard.
      </p>

      <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
        {materials.map((m, idx) => (
          <div key={idx} className="flex items-center gap-2 bg-black/15 border border-white/5 rounded-md px-3 py-2">
            <input
              type="text"
              value={m.title}
              onChange={(e) => updateMaterial(idx, { title: e.target.value })}
              placeholder="Title"
              className="flex-1 bg-transparent border-none text-white text-[0.85rem] outline-none"
            />
            <input
              type="text"
              value={m.category}
              onChange={(e) => updateMaterial(idx, { category: e.target.value })}
              placeholder="Category"
              className="w-28 bg-black/25 border border-white/10 rounded px-2 py-1 text-zinc-300 text-[0.8rem] outline-none"
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
          <p className="text-zinc-600 text-[0.8rem] italic">No starter materials yet.</p>
        )}
      </div>

      <button onClick={addMaterial} className="btn px-3 py-1.5 text-[0.8rem] self-start">
        + Add Material
      </button>
    </div>
  );
}
