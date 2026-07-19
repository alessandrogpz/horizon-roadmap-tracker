"use client";

import React from "react";
import type { Phase, PhaseDetailItem } from "@/lib/types";

interface PhaseDetailModalProps {
  phase: Phase;
  currentPhaseId: number;
  onClose: () => void;
  onActivatePhase: (id: number) => void;
}

// Placeholder state stores these sections as plain strings; render those as a single item
const asItems = (v: PhaseDetailItem[] | string | undefined): PhaseDetailItem[] => {
  if (!v) return [];
  return Array.isArray(v) ? v : [{ item: v, desc: "" }];
};

function DetailSection({ title, items }: { title: string; items: PhaseDetailItem[] }) {
  return (
    <div>
      <h4 className="text-[0.8rem] text-accent uppercase tracking-[0.05em] mb-2 border-b border-white/5 pb-1 font-bold">
        {title}
      </h4>
      <div className="flex flex-col gap-3">
        {items.map((f, idx) => (
          <div key={idx} className="text-[0.85rem] leading-normal">
            <div className="text-white font-semibold">• {f.item}</div>
            <div className="text-zinc-400 pl-4">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PhaseDetailModal({
  phase,
  currentPhaseId,
  onClose,
  onActivatePhase
}: PhaseDetailModalProps) {
  const { detailedInfo } = phase;
  const isActive = phase.id === currentPhaseId;
  const algoItems = asItems(detailedInfo.algoDS);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel max-w-[600px] w-full max-h-[90vh] overflow-y-auto flex flex-col gap-6 p-8 border !border-accent relative shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5),0_10px_10px_-5px_rgba(0,0,0,0.4)]"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 bg-transparent border-none text-zinc-400 text-[1.2rem] cursor-pointer font-[inherit]"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div>
          <div className="flex items-center gap-4">
            <h2 className="text-[1.4rem] font-bold text-accent">{phase.title}</h2>
            {isActive ? (
              <span className="text-xs bg-success/15 text-success px-2 py-0.5 rounded font-semibold">
                ACTIVE FOCUS
              </span>
            ) : null}
          </div>
          <p className="text-zinc-400 text-[0.9rem] mt-1">{phase.description}</p>
        </div>

        {/* Detailed Sections */}
        <div className="flex flex-col gap-5">
          <DetailSection title="Core Focus" items={asItems(detailedInfo.focus)} />
          <DetailSection title="Math Integration" items={asItems(detailedInfo.math)} />
          {algoItems.length > 0 && <DetailSection title="Algorithms & Data Structures" items={algoItems} />}

          {/* Expected Deliverable Block (Highlighted) */}
          <div>
            <h4 className="text-[0.8rem] text-accent uppercase tracking-[0.05em] mb-2 border-b border-white/5 pb-1 font-bold">
              Deliverable Goal
            </h4>
            <div className="flex flex-col gap-3">
              {asItems(detailedInfo.deliverable).map((d, idx) => (
                <div key={idx} className="text-[0.85rem] leading-normal p-3 bg-accent/5 rounded-md border-l-[3px] border-accent">
                  <div className="text-white font-semibold">{d.item}</div>
                  <div className="text-zinc-300 mt-1">{d.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center mt-2">
          <div>
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
          </div>
          <button onClick={onClose} className="btn px-5 py-2 text-[0.85rem]">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
