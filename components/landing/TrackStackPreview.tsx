import { Flame } from "lucide-react";
import TrackRing from "@/components/TrackRing";
import TrackYearStrip from "@/components/TrackYearStrip";
import { PREVIEW_TODAY, PREVIEW_TRACKS } from "./phoneData";

/**
 * Three tracks, three colours, one calendar year.
 *
 * The real component the app draws in Consistency, at the same cell size,
 * from the same data — nothing here is a mock-up except the names. Rendered
 * on the server: the strips are `div`s, and the whole thing costs no client
 * JavaScript at all.
 */
export default function TrackStackPreview() {
  return (
    <div aria-hidden="true" className="glass-panel landing-preview flex flex-col gap-3 select-none">
      <div className="flex items-baseline justify-between gap-3 border-b border-card-border pb-3">
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Consistency · all tracks
        </span>
        <span className="font-mono text-[0.65rem] text-muted-foreground">2026</span>
      </div>

      <div className="flex gap-3 overflow-hidden">
        <div className="flex shrink-0 flex-col gap-3" style={{ width: 132 }}>
          {PREVIEW_TRACKS.map((track) => (
            <div key={track.id} className="flex items-start gap-2" style={{ height: 7 * 11 + 6 * 3 }}>
              <TrackRing pct={track.pct} color={track.color} />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[0.72rem] font-semibold leading-tight text-foreground">{track.name}</span>
                <span
                  className="inline-flex items-center gap-1 self-start rounded px-1.5 py-px text-[0.6rem] font-bold"
                  style={{ color: track.color, background: "var(--surface-hover)" }}
                >
                  <Flame size={9} strokeWidth={2.5} />
                  {track.streak}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* Faded at the right rather than cut, so the year reading off the
            edge is obviously deliberate. */}
        <div
          className="flex min-w-0 flex-col gap-3 overflow-hidden"
          style={{ maskImage: "linear-gradient(to right, #000 82%, transparent)", WebkitMaskImage: "linear-gradient(to right, #000 82%, transparent)" }}
        >
          {PREVIEW_TRACKS.map((track) => (
            <TrackYearStrip
              key={track.id}
              days={track.days}
              color={track.color}
              cell={11}
              gap={3}
              start={track.startDate}
              today={PREVIEW_TODAY}
              pad={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
