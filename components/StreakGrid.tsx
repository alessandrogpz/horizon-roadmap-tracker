/**
 * The consistency grid itself — seven rows of day cells, one column per week.
 *
 * Shared on purpose: the dashboard's StreakGraph and the landing page's
 * dashboard miniature both render through this, so the two can never drift
 * into looking like different products. It holds no state and no hooks, which
 * is what lets a server component (the landing page) use it too — just don't
 * pass `onCellClick` from one.
 */

export interface StreakCell {
  /** Stable key — the date for a real day, anything unique for a filler. */
  id: string;
  /** 0-4, indexing --streak-0 … --streak-4. */
  level: number;
  /** Native tooltip. Absent on filler cells. */
  title?: string;
  /** False for the cells that pad a week out to seven, at either end. */
  filled?: boolean;
  /**
   * A day worth finding rather than a day worth counting.
   *
   * `start` is drawn in the page's opposite — white on a dark screen, black
   * on a light one — and never in a colour, because the grid itself is now
   * the track's colour and a mark painted in that colour disappears against
   * a busy day. The six colours a track may wear deliberately stop short of
   * white and black so that this can never collide with one.
   *
   */
  mark?: "start" | "today";
  /**
   * A day the track's own week has off, which has passed with nothing
   * recorded on it.
   *
   * Its own flag rather than a third `mark`, because it is not exclusive with
   * the others: today can be a day off, and when it is, the square needs the
   * ring *and* the dot. As a mark it was one or the other, and `today` won —
   * so the one day you are most likely to be looking at was the one day the
   * mark never appeared on.
   *
   * It keeps the empty square — nothing was done, and pretending otherwise
   * would be a lie about the history — and carries a small dot to say the gap
   * was the plan. Filling it instead would make a week with Sunday off
   * indistinguishable from one where Sunday was worked.
   */
  rest?: boolean;
}

/**
 * How big a day is, and the gutter between them.
 *
 * Fixed, not stretched. The columns used to share the panel's width evenly,
 * which is fine for a season and unreadable for a year: fifty-odd columns in
 * a half-width panel gave cells about four points across, too small to see a
 * shade in and far too small to hit. A day is now always this size, and a
 * grid too wide for its panel scrolls or is read a month at a time.
 */
export const CELL = 16;
export const GAP = 2;

export default function StreakGrid({
  cells,
  cell = CELL,
  onCellClick,
  className,
}: {
  cells: StreakCell[];
  /** Overridable only for miniatures — the landing page's hero draws a whole
   *  half-year inside a card. */
  cell?: number;
  onCellClick?: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-flow-col grid-rows-7 ${className ?? ""}`}
      style={{ gap: GAP, gridAutoColumns: `${cell}px`, width: "max-content" }}
    >
      {cells.map((entry) => {
        const interactive = entry.filled !== false && !!onCellClick;
        return (
          <div
            key={entry.id}
            title={entry.title}
            onClick={interactive ? () => onCellClick(entry.id) : undefined}
            className={`flex items-center justify-center rounded-[2px] ${
              interactive
                ? "cursor-pointer transition-transform duration-150 hover:scale-[1.35] hover:ring-1 hover:ring-accent/50"
                : ""
            }`}
            style={{
              height: cell,
              backgroundColor:
                entry.filled === false
                  ? "transparent"
                  : entry.mark === "start"
                    ? "var(--foreground)"
                    : `var(--streak-${entry.level})`,
              boxShadow: entry.mark === "today" ? "0 0 0 1.5px var(--foreground)" : undefined,
            }}
          >
            {/* Never on the first day: that square is already solid, drawn in
                the page's opposite, and a dot on it reads as a smudge. */}
            {entry.rest && entry.mark !== "start" && (
              <span
                aria-hidden="true"
                className="block rounded-full"
                style={{ width: Math.max(3, Math.round(cell * 0.3)), height: Math.max(3, Math.round(cell * 0.3)), backgroundColor: "var(--accent)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
