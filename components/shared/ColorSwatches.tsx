"use client";

import { Check } from "lucide-react";
import { TRACK_COLORS } from "@/lib/trackColors";

/**
 * The six colours a track can wear, and which one it is wearing.
 *
 * A fixed set rather than a colour picker. This used to be `<input
 * type="color">`, which let someone choose a colour the app then has to work
 * around: the consistency grid paints a track's days in its colour at four
 * strengths, and a colour near the page's own is four shades of nothing.
 * White and black are absent on purpose — the day a track began is drawn in
 * the page's opposite, and offering white would make that mark vanish on
 * exactly one track.
 */
export default function ColorSwatches({
  value,
  onPick,
}: {
  value: string;
  onPick: (color: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {TRACK_COLORS.map((color) => {
        const picked = value === color;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onPick(color)}
            aria-label={`Colour ${color}`}
            aria-pressed={picked}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-black/20 cursor-pointer transition-transform hover:scale-110"
            style={{ backgroundColor: color }}
          >
            {/* A tick inside, not a ring around the outside: a ring on a
                circle of colour reads as a seventh colour at a glance. */}
            {picked && <Check size={15} strokeWidth={3} className="text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  );
}
