import type { Phase } from "../types";
import type { TrackTemplate } from "./types";

const buildPhases = (durationDays: number): Phase[] => {
  const step = Math.round(durationDays / 4);
  return [
    {
      id: 1,
      title: "Phase 1: Fundamentals",
      description: "Learn the core vocabulary and basic mechanics.",
      recommendedByDay: step,
      tasks: [
        { id: "p1_t1", title: "Pick your primary learning resource", completed: false },
      ],
      detailedInfo: {
        focus: "Cover the fundamentals before specializing — vocabulary, core mechanics, basic exercises.",
        deliverable: "Comfort with beginner-level material without hand-holding.",
        math: "",
      },
    },
    {
      id: 2,
      title: "Phase 2: Practice & Application",
      description: "Apply what you've learned to real exercises or small projects.",
      recommendedByDay: step * 2,
      tasks: [
        { id: "p2_t1", title: "Start a practice project", completed: false },
      ],
      detailedInfo: {
        focus: "Move from passive learning to active practice — exercises, small projects, real use.",
        deliverable: "A finished small project or a consistent practice habit.",
        math: "",
      },
    },
    {
      id: 3,
      title: "Phase 3: Deepen Expertise",
      description: "Tackle harder material and fill in gaps.",
      recommendedByDay: step * 3,
      tasks: [
        { id: "p3_t1", title: "Identify and close your weakest area", completed: false },
      ],
      detailedInfo: {
        focus: "Intermediate/advanced material, with deliberate practice on weak spots.",
        deliverable: "Confidence handling non-beginner material unaided.",
        math: "",
      },
    },
    {
      id: 4,
      title: "Phase 4: Mastery & Projects",
      description: "Prove it with a real, substantial project.",
      recommendedByDay: step * 4,
      tasks: [
        { id: "p4_t1", title: "Ship a capstone project", completed: false },
      ],
      detailedInfo: {
        focus: "Consolidate everything into one substantial, real output.",
        deliverable: "A finished capstone project you can show or use.",
        math: "",
      },
    },
  ];
};

export const learningTemplate: TrackTemplate = {
  id: "learning",
  label: "Learning",
  description: "A general study plan for any subject or skill — fundamentals, practice, depth, then a capstone project.",
  defaultColor: "#a78bfa",
  defaultDurationDays: 180,
  buildPhases,
  defaultWeekSchedule: [
    { name: "Mon", type: "study", label: "Study" },
    { name: "Tue", type: "practice", label: "Practice" },
    { name: "Wed", type: "study", label: "Study" },
    { name: "Thu", type: "practice", label: "Practice" },
    { name: "Fri", type: "study", label: "Study" },
    { name: "Sat", type: "review", label: "Review" },
    { name: "Sun", type: "free", label: "Free" },
  ],
  defaultFocusTypes: {
    study: { label: "Study", color: "#a78bfa" },
    practice: { label: "Practice", color: "#34d399" },
    review: { label: "Review", color: "#fbbf24" },
    free: { label: "Free", color: "#a1a1aa" },
  },
};
