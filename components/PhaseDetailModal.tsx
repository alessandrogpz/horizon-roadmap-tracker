"use client";

import React from "react";

interface DetailItem {
  item: string;
  desc: string;
}

interface DetailedInfo {
  focus: DetailItem[];
  deliverable: DetailItem[];
  math: DetailItem[];
  algoDS?: DetailItem[];
}

interface Phase {
  id: number;
  title: string;
  description: string;
  detailedInfo: DetailedInfo;
}

interface PhaseDetailModalProps {
  phase: Phase;
  currentPhaseId: number;
  onClose: () => void;
  onActivatePhase: (id: number) => void;
}

export default function PhaseDetailModal({ 
  phase, 
  currentPhaseId, 
  onClose, 
  onActivatePhase 
}: PhaseDetailModalProps) {
  const { detailedInfo } = phase;
  const isActive = phase.id === currentPhaseId;

  return (
    <div 
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem"
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="glass-panel"
        style={{
          maxWidth: "600px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          padding: "2rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)",
          border: "1px solid var(--accent)",
          position: "relative"
        }}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1.5rem",
            right: "1.5rem",
            background: "transparent",
            border: "none",
            color: "#a1a1aa",
            fontSize: "1.2rem",
            cursor: "pointer",
            fontFamily: "inherit"
          }}
        >
          ✕
        </button>

        {/* Modal Header */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--accent)" }}>{phase.title}</h2>
            {isActive ? (
              <span style={{ fontSize: "0.75rem", background: "rgba(16, 185, 129, 0.15)", color: "var(--success)", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>
                ACTIVE FOCUS
              </span>
            ) : null}
          </div>
          <p style={{ color: "#a1a1aa", fontSize: "0.9rem", marginTop: "0.25rem" }}>{phase.description}</p>
        </div>

        {/* Detailed Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          
          {/* Core Focus Block */}
          <div>
            <h4 style={{ fontSize: "0.8rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.25rem" }}>
              Core Focus
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {detailedInfo.focus.map((f, idx) => (
                <div key={idx} style={{ fontSize: "0.85rem", lineHeight: 1.5 }}>
                  <div style={{ color: "#fff", fontWeight: 600 }}>• {f.item}</div>
                  <div style={{ color: "#a1a1aa", paddingLeft: "1rem" }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Math Integration Block */}
          <div>
            <h4 style={{ fontSize: "0.8rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.25rem" }}>
              Math Integration
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {detailedInfo.math.map((m, idx) => (
                <div key={idx} style={{ fontSize: "0.85rem", lineHeight: 1.5 }}>
                  <div style={{ color: "#fff", fontWeight: 600 }}>• {m.item}</div>
                  <div style={{ color: "#a1a1aa", paddingLeft: "1rem" }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Algorithms & Data Structures Block */}
          {detailedInfo.algoDS && detailedInfo.algoDS.length > 0 && (
            <div>
              <h4 style={{ fontSize: "0.8rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.25rem" }}>
                Algorithms & Data Structures
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {detailedInfo.algoDS.map((a, idx) => (
                  <div key={idx} style={{ fontSize: "0.85rem", lineHeight: 1.5 }}>
                    <div style={{ color: "#fff", fontWeight: 600 }}>• {a.item}</div>
                    <div style={{ color: "#a1a1aa", paddingLeft: "1rem" }}>{a.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expected Deliverable Block (Highlighted) */}
          <div>
            <h4 style={{ fontSize: "0.8rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.25rem" }}>
              Deliverable Goal
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {detailedInfo.deliverable.map((d, idx) => (
                <div key={idx} style={{ fontSize: "0.85rem", lineHeight: 1.5, padding: "0.75rem", background: "rgba(14, 165, 233, 0.05)", borderRadius: "6px", borderLeft: "3px solid var(--accent)" }}>
                  <div style={{ color: "#fff", fontWeight: 600 }}>{d.item}</div>
                  <div style={{ color: "#d4d4d8", marginTop: "0.25rem" }}>{d.desc}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
          <div>
            {!isActive && (
              <button 
                onClick={() => {
                  onActivatePhase(phase.id);
                  onClose();
                }}
                className="btn"
                style={{ background: "rgba(14,165,233,0.15)", color: "var(--accent)", border: "1px solid var(--accent)", fontSize: "0.85rem" }}
              >
                Set as Active Phase
              </button>
            )}
          </div>
          <button onClick={onClose} className="btn" style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
