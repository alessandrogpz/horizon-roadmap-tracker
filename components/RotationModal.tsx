"use client";

import React from "react";
import type { AppState } from "@/lib/types";
import { getWeekNum } from "@/lib/dates";
import { DSA_PATTERN_WEEKS, dsaPatternIndex } from "@/lib/constants";

interface RotationModalProps {
  data: AppState;
  onClose: () => void;
  /** Applies an optimistic state update and schedules a debounced save. */
  applyChange: (newData: AppState) => void;
}

export default function RotationModal({ data, onClose, applyChange }: RotationModalProps) {
  const currentWeekNum = getWeekNum(data.startDate);
  const dsaStartWeek = data.dsaStartWeek || 1;
  const activeIndex = dsaPatternIndex(currentWeekNum, dsaStartWeek);

  const selectPattern = (idx: number) => {
    const newDsaStartWeek = currentWeekNum - idx;
    const currentPattern = DSA_PATTERN_WEEKS[idx];

    // Update existing auto-revision items to match the newly selected pattern immediately
    const updatedRevisionItems = { ...(data.dailyRevisionItems || {}) };
    Object.keys(updatedRevisionItems).forEach((dayKey) => {
      updatedRevisionItems[dayKey] = (updatedRevisionItems[dayKey] || []).map((item) => {
        if (item.id === "dsa_auto") {
          return {
            ...item,
            title: currentPattern.pattern,
            description: currentPattern.problems
          };
        }
        return item;
      });
    });

    applyChange({
      ...data,
      dsaStartWeek: newDsaStartWeek,
      dailyRevisionItems: updatedRevisionItems
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
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
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          padding: "2rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
          border: "1px solid var(--accent)",
          position: "relative",
          borderRadius: "8px"
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
          }}
        >
          ✕
        </button>

        {/* Modal Header */}
        <div>
          <span style={{
            fontSize: "0.75rem",
            background: "rgba(14, 165, 233, 0.1)",
            color: "var(--accent)",
            padding: "0.15rem 0.5rem",
            borderRadius: "4px",
            fontWeight: 600,
            textTransform: "uppercase",
            fontFamily: "monospace",
            letterSpacing: "0.05em"
          }}>
            10-Week Rotation Cycle
          </span>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff", marginTop: "0.5rem", marginBottom: "0.25rem" }}>
            DSA Pattern Rotation
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#a1a1aa", margin: 0 }}>
            Currently on Week {currentWeekNum} of curriculum.
          </p>
        </div>

        {/* Rotation list */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
          maxHeight: "350px",
          overflowY: "auto",
          paddingRight: "0.5rem"
        }}>
          {DSA_PATTERN_WEEKS.map((patternItem, idx) => {
            const isActive = idx === activeIndex;

            return (
              <div
                key={patternItem.pattern}
                onClick={() => selectPattern(idx)}
                onMouseOver={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.05)";
                  }
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "6px",
                  background: isActive ? "rgba(14, 165, 233, 0.08)" : "rgba(255, 255, 255, 0.02)",
                  border: isActive ? "1px solid var(--accent)" : "1px solid rgba(255, 255, 255, 0.05)",
                  boxShadow: isActive ? "0 0 10px rgba(14, 165, 233, 0.1)" : "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: isActive ? "#fff" : "#a1a1aa"
                  }}>
                    Week {idx + 1}: {patternItem.pattern}
                  </span>
                  {isActive && (
                    <span style={{
                      fontSize: "0.65rem",
                      background: "var(--accent)",
                      color: "#000",
                      padding: "0.05rem 0.35rem",
                      borderRadius: "3px",
                      fontWeight: 700,
                      textTransform: "uppercase"
                    }}>
                      Active Week
                    </span>
                  )}
                </div>
                <span style={{ fontSize: "0.75rem", color: isActive ? "#e4e4e7" : "#71717a", lineHeight: 1.4 }}>
                  Problems: {patternItem.problems}
                </span>
              </div>
            );
          })}
        </div>

        {/* Links and Actions */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          paddingTop: "1rem",
          marginTop: "0.5rem"
        }}>
          <a
            href="/dsa"
            onClick={onClose}
            className="btn"
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.8rem",
              textDecoration: "none",
              display: "inline-block"
            }}
          >
            Go to DSA Page
          </a>
          <button
            onClick={onClose}
            className="btn"
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.8rem",
              background: "transparent",
              color: "#a1a1aa",
              border: "1px solid rgba(255, 255, 255, 0.1)"
            }}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
