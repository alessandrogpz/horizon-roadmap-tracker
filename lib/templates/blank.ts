import type { Phase } from "../types";
import type { TrackTemplate } from "./types";

const buildPhases = (durationDays: number): Phase[] => {
  const step = Math.round(durationDays / 4);
  return [1, 2, 3, 4].map((n) => ({
    id: n,
    title: `Phase ${n}`,
    description: "Describe what this phase is about.",
    recommendedByDay: step * n,
    tasks: [
      { id: `p${n}_t1`, title: "Add your first task", completed: false },
    ],
    detailedInfo: {
      focus: "What are you focusing on in this phase?",
      deliverable: "What will you have built or achieved by the end?",
      math: "",
    },
  }));
};

export const blankTemplate: TrackTemplate = {
  id: "blank",
  label: "Blank",
  description: "Start from a clean slate — a simple, fully editable skeleton for any goal not covered by the other templates.",
  defaultColor: "#0ea5e9",
  defaultDurationDays: 90,
  buildPhases,
  defaultWeekSchedule: [
    { name: "Mon", type: "focus", label: "Focus" },
    { name: "Tue", type: "focus", label: "Focus" },
    { name: "Wed", type: "focus", label: "Focus" },
    { name: "Thu", type: "focus", label: "Focus" },
    { name: "Fri", type: "focus", label: "Focus" },
    { name: "Sat", type: "review", label: "Review" },
    { name: "Sun", type: "free", label: "Free" },
  ],
  defaultFocusTypes: {
    focus: { label: "Focus", color: "#0ea5e9" },
    review: { label: "Review", color: "#34d399" },
    free: { label: "Free", color: "#a1a1aa" },
  },
};
