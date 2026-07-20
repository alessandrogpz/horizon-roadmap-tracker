import type { Phase } from "../types";
import type { TrackTemplate } from "./types";

const buildPhases = (durationDays: number): Phase[] => {
  const step = Math.round(durationDays / 4);
  return [
    {
      id: 1,
      title: "Phase 1: Foundation",
      description: "Build the habit and establish baseline form.",
      recommendedByDay: step,
      tasks: [
        { id: "p1_t1", title: "Set your training schedule", completed: false },
        { id: "p1_t2", title: "Record baseline measurements", completed: false },
      ],
      detailedInfo: {
        focus: "Consistency over intensity — show up on schedule and learn correct form.",
        deliverable: "A repeatable weekly routine you can sustain without burning out.",
        math: "",
      },
    },
    {
      id: 2,
      title: "Phase 2: Base Building",
      description: "Progressively increase volume and intensity.",
      recommendedByDay: step * 2,
      tasks: [
        { id: "p2_t1", title: "Increase weekly training volume", completed: false },
      ],
      detailedInfo: {
        focus: "Progressive overload — track weights/distances/times and push them steadily.",
        deliverable: "A measurable improvement over your phase 1 baseline.",
        math: "",
      },
    },
    {
      id: 3,
      title: "Phase 3: Intensification",
      description: "Sharpen toward your specific goal.",
      recommendedByDay: step * 3,
      tasks: [
        { id: "p3_t1", title: "Focus training on your specific goal", completed: false },
      ],
      detailedInfo: {
        focus: "Specificity — training closer to what your goal actually demands.",
        deliverable: "Performance close to your target benchmark.",
        math: "",
      },
    },
    {
      id: 4,
      title: "Phase 4: Peak & Maintain",
      description: "Hit your goal and settle into a sustainable maintenance rhythm.",
      recommendedByDay: step * 4,
      tasks: [
        { id: "p4_t1", title: "Hit your target goal", completed: false },
        { id: "p4_t2", title: "Plan your next cycle", completed: false },
      ],
      detailedInfo: {
        focus: "Peak for your goal, then transition to a maintainable long-term routine.",
        deliverable: "Goal achieved, with a plan for what comes next.",
        math: "",
      },
    },
  ];
};

export const fitnessTemplate: TrackTemplate = {
  id: "fitness",
  label: "Fitness",
  description: "A progressive training plan — build the habit, add volume, sharpen toward your goal, then peak and maintain.",
  defaultColor: "#f97316",
  defaultDurationDays: 120,
  buildPhases,
  defaultWeekSchedule: [
    { name: "Mon", type: "strength", label: "Strength" },
    { name: "Tue", type: "cardio", label: "Cardio" },
    { name: "Wed", type: "rest", label: "Rest" },
    { name: "Thu", type: "strength", label: "Strength" },
    { name: "Fri", type: "cardio", label: "Cardio" },
    { name: "Sat", type: "strength", label: "Strength" },
    { name: "Sun", type: "rest", label: "Rest" },
  ],
  defaultFocusTypes: {
    strength: { label: "Strength", color: "#f97316" },
    cardio: { label: "Cardio", color: "#22d3ee" },
    rest: { label: "Rest", color: "#a1a1aa" },
  },
};
