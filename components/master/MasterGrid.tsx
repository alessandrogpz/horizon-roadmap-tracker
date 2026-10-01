/**
 * The consistency grid, with several tracks in one square.
 *
 * A day on which three tracks did something has to say so, and the obvious
 * answer — mix the three colours — is the wrong one: blue and amber average to
 * a muddy grey that is neither, and the more tracks a day has the less it says.
 * Blending loses exactly the information the square exists to carry.
 *
 * So a day is *divided* instead. One band per contributing track, in that
 * track's own colour at the strength its own grid would have used, left to
 * right in the order the tracks are listed in. A day one track worked is a
 * solid square exactly as it is on that track's own panel; a day three tracks
 * worked is three stripes, and you can see which three.
 *
 * Drawn as a hard-stopped gradient rather than child elements: a year is some
 * four hundred squares and this one is drawn at every size, so a square costs
 * one element whatever is in it.
 */

import { shadeOf } from "@/lib/colors";
import type { MasterDay } from "@/lib/masterTrack";

export const CELL = 16;
export const GAP = 2;

/** The bands of one day, as a CSS background. */
export function bandsFor(day: MasterDay): string {
  if (day.parts.length === 0) return "var(--streak-0)";
  if (day.parts.length === 1) return shadeOf(day.parts[0].color, day.parts[0].count, "var(--streak-0)");

  const share = 100 / day.parts.length;
  const stops = day.parts.flatMap((part, index) => {
    const colour = shadeOf(part.color, part.count, "var(--streak-0)");
    return [`${colour} ${index * share}%`, `${colour} ${(index + 1) * share}%`];
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/** What the square says when you rest on it. */
export function titleFor(day: MasterDay, resting: boolean): string {
  if (!day.date) return "";
  const head = `${day.date}: ${day.count} update${day.count === 1 ? "" : "s"}${resting && day.count === 0 ? " — a day off" : ""}`;
  if (day.parts.length === 0) return head;
  return `${head}\n${day.parts.map((part) => `• ${part.name}: ${part.count}`).join("\n")}`;
}

export default function MasterGrid({
  days,
  today,
  isRest,
  cell = CELL,
  onDayClick,
  className,
}: {
  /** Week-major and padded to sevens for the continuous shape, or one month's
   *  cells with `null` where a week needs padding out. */
  days: (MasterDay | null)[];
  today: string;
  /** Whether a date is one every track has off. */
  isRest: (date: string) => boolean;
  cell?: number;
  onDayClick?: (date: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-flow-col grid-rows-7 ${className ?? ""}`}
      style={{ gap: GAP, gridAutoColumns: `${cell}px`, width: "max-content" }}
    >
      {days.map((day, index) => {
        if (!day || !day.date) return <div key={`pad-${index}`} style={{ height: cell }} />;
        const resting = day.count === 0 && isRest(day.date);
        const pressable = Boolean(onDayClick);
        return (
          <div
            key={day.date}
            title={titleFor(day, resting)}
            onClick={pressable ? () => onDayClick?.(day.date) : undefined}
            className={`flex items-center justify-center rounded-[2px] ${
              pressable ? "cursor-pointer transition-transform duration-150 hover:scale-[1.35] hover:ring-1 hover:ring-accent/50" : ""
            }`}
            style={{
              height: cell,
              background: bandsFor(day),
              // Today is ringed. The day a track *began* is deliberately not
              // marked here: with six tracks there are six of them, and a mark
              // that appears six times for six different reasons has stopped
              // being a mark.
              boxShadow: day.date === today ? "0 0 0 1.5px var(--foreground)" : undefined,
            }}
          >
            {resting && (
              <span
                aria-hidden="true"
                className="block rounded-full"
                style={{
                  width: Math.max(3, Math.round(cell * 0.3)),
                  height: Math.max(3, Math.round(cell * 0.3)),
                  background: "var(--subtle-foreground)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
