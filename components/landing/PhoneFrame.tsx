/**
 * A phone, drawn rather than photographed.
 *
 * The screens inside are the real components where they can be — the same
 * year strips and rings the app draws — at phone proportions. A screenshot
 * would go stale the first time a colour changed; this cannot, because it is
 * built out of the same parts.
 *
 * The tab bar was briefly a working one. It is lit and still again: three
 * phones on a marketing page are a photograph of an app, and a photograph
 * that half-works is worse than one that plainly does not. Decorative
 * throughout — `aria-hidden`, no handlers, no client JS.
 */
import { CheckCircle, Flame, LayoutGrid, Map } from "lucide-react";
import { trackInkVariables } from "@/lib/trackAccent";

const TABS = [
  { id: "space", label: "My Space", icon: LayoutGrid },
  { id: "today", label: "Today", icon: CheckCircle },
  { id: "plan", label: "Plan", icon: Map },
  { id: "progress", label: "Progress", icon: Flame },
] as const;

export default function PhoneFrame({
  label,
  caption,
  tab,
  accent,
  children,
}: {
  /** Left off where the phone is decoration leaning on something else. */
  label?: string;
  caption?: string;
  /** Which of the four tabs is lit. The bar is what makes a drawn rectangle
   *  read as a screen rather than as a card. */
  tab?: (typeof TABS)[number]["id"];
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="flex flex-col items-center gap-4">
      <div
        aria-hidden="true"
        className="relative w-[258px] shrink-0 rounded-[2.2rem] border border-card-border bg-card p-[9px] shadow-[0_1px_2px_rgba(0,0,0,0.4),0_30px_60px_-30px_rgba(0,0,0,0.9)]"
      >
        {/* The bezel's inner lip, which is what stops a drawn phone reading as
            a rounded rectangle with a picture in it. */}
        <div className="relative overflow-hidden rounded-[1.7rem] border border-card-border bg-background">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 pt-2.5 pb-1 text-[0.55rem] font-mono text-subtle-foreground">
            <span>9:41</span>
            <span className="absolute left-1/2 top-[7px] h-[14px] w-[62px] -translate-x-1/2 rounded-full bg-card" />
            <span className="flex items-center gap-1">
              <span className="inline-block h-[6px] w-[10px] rounded-[1px] border border-current" />
            </span>
          </div>
          <div className={`overflow-hidden px-3 ${tab ? "h-[438px]" : "h-[480px] pb-3"}`}>{children}</div>
          {tab && (
            <div className="flex items-stretch justify-between border-t border-card-border px-2 pt-1.5 pb-2.5">
              {TABS.map((entry) => {
                const on = entry.id === tab;
                return (
                  <span
                    key={entry.id}
                    className={`flex flex-1 flex-col items-center gap-1 py-0.5 ${
                      on ? "track-ink" : "text-subtle-foreground"
                    }`}
                    style={accent ? (trackInkVariables(accent) as React.CSSProperties) : undefined}
                  >
                    <entry.icon size={14} strokeWidth={on ? 2.6 : 2} />
                    <span className="text-[0.48rem] font-semibold">{entry.label}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {(label || caption) && (
        <figcaption className="flex max-w-[280px] flex-col gap-1 text-center">
          {label && <span className="text-[0.85rem] font-semibold text-foreground">{label}</span>}
          {caption && <span className="text-[0.8rem] leading-snug text-muted-foreground">{caption}</span>}
        </figcaption>
      )}
    </figure>
  );
}
