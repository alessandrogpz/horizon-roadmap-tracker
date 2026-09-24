// A phase's four detail sections, and the one awkward thing about them.
//
// `PhaseDetailedInfo` types each section as `PhaseDetailItem[] | string`. The
// string is history: the earliest templates wrote a sentence where the shape
// now wants a list, and those tracks are still in people's accounts. Rather
// than migrate them — the sentence is real content, and there is no honest way
// to split one into items and descriptions — every reader normalises on the
// way in.
//
// "Every reader" was one reader until the phone became the second, at which
// point the normaliser and the section labels had to stop living inside a
// React component. Both platforms import them from here so a track shows the
// same four headings, in the same order, wherever it is opened.

import type { Phase, PhaseDetailedInfo, PhaseDetailItem } from "./types";

/** The stored form of a section, as a list — whichever of the two shapes it
 *  was written in. */
export function phaseDetailItems(value: PhaseDetailItem[] | string | undefined): PhaseDetailItem[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [{ item: value, desc: "" }];
}

/**
 * The sections, in the order they are shown: what the phase is about, then what
 * it needs from maths and from algorithms, then what it has to produce.
 *
 * The keys are fixed by the stored schema and date from when Horizon was one
 * computer-science curriculum. They are not a good fit for a track about
 * training or a language, which is why nothing here should be rendered unless
 * it actually has content — a fitness phase headed "Maths" with nothing under
 * it is just confusing. Callers filter on emptiness; the labels were shortened
 * so the ones that *are* used read less like a syllabus.
 */
export const PHASE_DETAIL_SECTIONS: { key: keyof PhaseDetailedInfo; label: string }[] = [
  { key: "focus", label: "Focus" },
  { key: "math", label: "Maths" },
  { key: "algoDS", label: "Algorithms" },
  { key: "deliverable", label: "Deliverable" },
];

/** Replaces one section, always in list form — so editing a phase that still
 *  holds the legacy string quietly converts it, which is the only migration
 *  that can be done without guessing. */
export function setPhaseDetail(
  phase: Phase,
  key: keyof PhaseDetailedInfo,
  items: PhaseDetailItem[]
): Phase {
  return { ...phase, detailedInfo: { ...phase.detailedInfo, [key]: items } };
}
