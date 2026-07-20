import type { Phase } from "../types";
import type { TrackTemplate } from "./types";

const buildPhases = (durationDays: number): Phase[] => {
  const step = Math.round(durationDays / 4);
  return [
    {
      id: 1,
      title: "Phase 1: Foundation",
      description: "Clarify the goal and build the core skills it needs.",
      recommendedByDay: step,
      tasks: [
        { id: "p1_t1", title: "Define the specific role or outcome you're after", completed: false },
      ],
      detailedInfo: {
        focus: "Get precise about the target, then close the biggest skill gaps standing between here and there.",
        deliverable: "A clear target and a resume/portfolio baseline you're not embarrassed by.",
        math: "",
      },
    },
    {
      id: 2,
      title: "Phase 2: Visible Work",
      description: "Build a portfolio and a network people can actually see.",
      recommendedByDay: step * 2,
      tasks: [
        { id: "p2_t1", title: "Ship one piece of visible work", completed: false },
      ],
      detailedInfo: {
        focus: "Produce something concrete — a project, a case study, a talk — and start showing up where the right people already are.",
        deliverable: "A portfolio piece and a handful of real conversations started.",
        math: "",
      },
    },
    {
      id: 3,
      title: "Phase 3: Active Outreach",
      description: "Apply, pitch, and interview — in volume.",
      recommendedByDay: step * 3,
      tasks: [
        { id: "p3_t1", title: "Set a weekly outreach/application target", completed: false },
      ],
      detailedInfo: {
        focus: "Consistent weekly volume beats sporadic bursts — applications, pitches, interviews, follow-ups.",
        deliverable: "A steady pipeline of live opportunities in motion.",
        math: "",
      },
    },
    {
      id: 4,
      title: "Phase 4: Land & Grow",
      description: "Close the opportunity, then ramp up in it.",
      recommendedByDay: step * 4,
      tasks: [
        { id: "p4_t1", title: "Close the opportunity", completed: false },
        { id: "p4_t2", title: "Plan your first 90 days in it", completed: false },
      ],
      detailedInfo: {
        focus: "Negotiate well, start strong, and figure out what growth looks like from here.",
        deliverable: "The role/deal landed, with a plan for the first stretch inside it.",
        math: "",
      },
    },
  ];
};

export const workTemplate: TrackTemplate = {
  id: "work",
  label: "Work",
  description: "A career or professional goal — building skills and a portfolio, then actively pursuing and landing the opportunity.",
  defaultColor: "#eab308",
  defaultDurationDays: 120,
  buildPhases,
  defaultWeekSchedule: [
    { name: "Mon", type: "build", label: "Build" },
    { name: "Tue", type: "outreach", label: "Outreach" },
    { name: "Wed", type: "build", label: "Build" },
    { name: "Thu", type: "outreach", label: "Outreach" },
    { name: "Fri", type: "build", label: "Build" },
    { name: "Sat", type: "review", label: "Review" },
    { name: "Sun", type: "free", label: "Free" },
  ],
  defaultFocusTypes: {
    build: { label: "Build", color: "#eab308" },
    outreach: { label: "Outreach", color: "#22d3ee" },
    review: { label: "Review", color: "#a78bfa" },
    free: { label: "Free", color: "#a1a1aa" },
  },
};
