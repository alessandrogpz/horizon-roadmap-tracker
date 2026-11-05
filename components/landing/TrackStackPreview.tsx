import { Flame } from "lucide-react";
import TrackRing from "@/components/TrackRing";
import TrackYearStrip from "@/components/TrackYearStrip";
import { PREVIEW_TODAY, PREVIEW_TRACKS } from "./phoneData";
import { trackInkVariables } from "@/lib/trackAccent";

/**
 * Three tracks, three colours, one calendar year.
 *
 * The real component the app draws in Consistency, at the same cell size,
 * from the same data — and a picture of it, not a copy: nothing here
 * responds, because a preview that responds is a promise this page cannot
 * keep. Rendered on the server; the strips are `div`s and it costs no client
 * JavaScript at all.
 */
export default function TrackStackPreview() {
  return (
    <div
      aria-hidden="true"
      // A scaled picture of the real interface, so its insides follow the app's
      // rules rather than the page's: 9px type and 2px radii are right in a
      // miniature and wrong in a paragraph. `data-ui` tells the inspector so.
      data-ui
      className="glass-panel landing-preview flex min-w-0 select-none flex-col gap-3 overflow-hidden"
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-card-border pb-3">
        <span className="text-[0.68rem] font-semibold text-foreground">
          Consistency · all tracks
        </span>
        <span className="font-mono text-[0.65rem] text-muted-foreground">2026</span>
      </div>

      <div className="flex gap-3">
        <div className="flex w-[104px] shrink-0 flex-col gap-3 sm:w-[132px]">
          {PREVIEW_TRACKS.map((track) => (
            <div key={track.id} className="flex items-start gap-2" style={{ height: 7 * 11 + 6 * 3 }}>
              <TrackRing pct={track.pct} color={track.color} />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[0.72rem] font-semibold leading-tight text-foreground">{track.name}</span>
                <span
                  className="track-ink inline-flex items-center gap-1 self-start rounded px-1.5 py-px text-[0.6rem] font-bold"
                  style={{ ...trackInkVariables(track.color), background: "var(--surface-hover)" } as React.CSSProperties}
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
          style={{
            maskImage: "linear-gradient(to right, #000 82%, transparent)",
            WebkitMaskImage: "linear-gradient(to right, #000 82%, transparent)",
          }}
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
