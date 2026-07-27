import type { Phase } from "./types";

/**
 * Stretches or compresses phase deadlines onto a new horizon, keeping their
 * relative pacing.
 *
 * Templates rebuild their phases wholesale when the duration changes, which is
 * right for generic scaffolding and wrong for anything with real content in it:
 * an AI-generated or hand-edited plan would lose every title, task and
 * deliverable to fix a date. Rescaling preserves the plan and moves the dates,
 * which is what someone adjusting a horizon actually means.
 *
 * Phases without a `recommendedByDay` are left alone — a track that never set
 * them simply doesn't show the phase-timing banner, and inventing values here
 * would turn it on uninvited.
 */
export function rescalePhaseDeadlines(
  phases: Phase[],
  previousDuration: number,
  nextDuration: number,
): Phase[] {
  if (nextDuration <= 0 || previousDuration <= 0 || previousDuration === nextDuration) {
    return phases;
  }

  const factor = nextDuration / previousDuration;

  const rescaled = phases.map((phase) => {
    if (phase.recommendedByDay === undefined) return phase;
    return {
      ...phase,
      // At least 1: a phase due on "day 0" reads as already overdue.
      recommendedByDay: Math.max(1, Math.round(phase.recommendedByDay * factor)),
    };
  });

  // Rounding can collapse adjacent deadlines onto the same day, or land the
  // last one just short of the horizon. Walk forward and force both invariants:
  // strictly increasing, ending exactly on the horizon.
  let previous = 0;
  for (const phase of rescaled) {
    if (phase.recommendedByDay === undefined) continue;
    if (phase.recommendedByDay <= previous) phase.recommendedByDay = previous + 1;
    previous = phase.recommendedByDay;
  }

  for (let i = rescaled.length - 1; i >= 0; i--) {
    if (rescaled[i].recommendedByDay !== undefined) {
      rescaled[i].recommendedByDay = nextDuration;
      // Pushing the last one back can break monotonicity against the one
      // before it when the plan was compressed hard; walk backwards and pull
      // earlier deadlines down to stay strictly increasing.
      for (let j = i - 1; j >= 0; j--) {
        const later = rescaled[j + 1].recommendedByDay!;
        const current = rescaled[j].recommendedByDay;
        if (current !== undefined && current >= later) {
          rescaled[j].recommendedByDay = Math.max(1, later - 1);
        }
      }
      break;
    }
  }

  return rescaled;
}
