import HorizonMark from "@/components/HorizonMark";

/**
 * A decorative, non-interactive miniature of the dashboard for the landing
 * hero. Deliberately static markup rather than the real panels: it must render
 * without a workspace, without IndexedDB and without client JS, and it shows a
 * plausible track rather than the visitor's (they have none yet).
 *
 * Every value here is fixed so server and client render identically.
 */

/**
 * Six months of streak cells, seven per column. Generated from a fixed seed
 * rather than Math.random so server and client always agree — and weighted so
 * the run reads like a real one: mostly kept, occasionally missed, denser
 * toward the present (the right-hand side).
 */
const STREAK_LEVELS = (() => {
  const cells = 26 * 7;
  let seed = 20260726;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  return Array.from({ length: cells }, (_, i) => {
    const recency = i / cells; // 0 at the oldest column, 1 at the newest
    const r = next();
    if (r > 0.55 + recency * 0.35) return 0; // a missed day, rarer lately
    return 1 + Math.floor(next() * (2 + recency * 2));
  });
})();

const PHASES = [
  { name: "Foundations", state: "done", detail: "Weeks 1–8" },
  { name: "Rasterizer & pipeline", state: "current", detail: "Weeks 9–20" },
  { name: "Physics & scene graph", state: "todo", detail: "Weeks 21–32" },
] as const;

const WEEK = [
  { day: "Mon", label: "Study", color: "#a78bfa" },
  { day: "Tue", label: "Build", color: "#34d399" },
  { day: "Wed", label: "Study", color: "#a78bfa" },
  { day: "Thu", label: "Build", color: "#34d399" },
  { day: "Fri", label: "Study", color: "#a78bfa" },
  { day: "Sat", label: "Review", color: "#fbbf24" },
  { day: "Sun", label: "Free", color: "#a1a1aa" },
] as const;

export default function DashboardPreview() {
  return (
    <div
      aria-hidden="true"
      className="glass-panel landing-preview select-none text-[0.72rem] sm:text-[0.78rem]"
    >
      {/* Header line */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-card-border">
        <div className="flex items-center gap-2 min-w-0">
          <HorizonMark className="h-3.5 w-auto text-accent shrink-0" />
          <span className="font-semibold truncate">Engine Track</span>
          <span className="hidden sm:inline rounded-full border border-card-border bg-surface-muted px-2 py-0.5 text-[0.65rem] text-muted-foreground font-mono">
            3 tracks
          </span>
        </div>
        <span className="font-mono text-[0.65rem] text-muted-foreground whitespace-nowrap">
          Day 96 / 396
        </span>
      </div>

      {/* Horizon progress */}
      <div className="pt-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
            Horizon
          </span>
          <span className="font-mono text-[0.65rem] text-accent">24%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-surface-hover overflow-hidden">
          <div className="h-full w-[24%] rounded-full bg-accent" />
        </div>
      </div>

      {/* Phase timeline */}
      <div className="pt-5 flex flex-col gap-2.5">
        {PHASES.map((phase) => (
          <div key={phase.name} className="flex items-center gap-3">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                phase.state === "done"
                  ? "bg-success"
                  : phase.state === "current"
                    ? "bg-accent ring-4 ring-accent/20"
                    : "bg-surface-hover border border-card-border-hover"
              }`}
            />
            <span
              className={`truncate ${
                phase.state === "todo" ? "text-subtle-foreground" : "text-foreground"
              }`}
            >
              {phase.name}
            </span>
            <span className="ml-auto font-mono text-[0.6rem] text-subtle-foreground whitespace-nowrap">
              {phase.detail}
            </span>
          </div>
        ))}
      </div>

      {/* Streak grid */}
      <div className="pt-5">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
            Consistency
          </span>
          <span className="font-mono text-[0.65rem] text-success">31-day streak</span>
        </div>
        <div
          className="grid grid-flow-col grid-rows-7 gap-[2px]"
          style={{ gridAutoColumns: "minmax(0, 1fr)" }}
        >
          {STREAK_LEVELS.map((level, i) => (
            <span
              key={i}
              className="aspect-square rounded-[1.5px]"
              style={{ backgroundColor: `var(--streak-${level})` }}
            />
          ))}
        </div>
      </div>

      {/* Weekly rhythm */}
      <div className="pt-5">
        <div className="grid grid-cols-7 gap-1">
          {WEEK.map((d, i) => (
            <div
              key={d.day}
              className={`rounded-md border px-1 py-1.5 text-center ${
                i === 2 ? "border-accent-muted bg-accent/[0.07]" : "border-card-border bg-surface-muted"
              }`}
            >
              <div className="font-mono text-[0.55rem] text-subtle-foreground">{d.day}</div>
              <div
                className="mt-1 h-1 w-full rounded-full"
                style={{ backgroundColor: d.color, opacity: 0.85 }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
