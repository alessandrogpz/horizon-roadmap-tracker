/**
 * The consistency grid itself — seven rows of day cells, one column per week,
 * sized to fill whatever width it's given rather than scrolling sideways.
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
  /** False for the cells that pad the final partial week out to seven. */
  filled?: boolean;
}

/** Largest a day cell is allowed to get, and the gutter between them (px). */
const MAX_CELL = 16;
const GAP = 2;

export default function StreakGrid({
  cells,
  onCellClick,
}: {
  cells: StreakCell[];
  onCellClick?: (id: string) => void;
}) {
  const columns = Math.ceil(cells.length / 7);

  return (
    <div
      className="grid grid-flow-col grid-rows-7 gap-[2px]"
      style={{
        // Columns share the width evenly rather than taking a fixed cell size,
        // so a 13-month track fills the panel exactly at whatever size fits...
        gridAutoColumns: "minmax(0, 1fr)",
        // ...but a track that's only a few weeks old would otherwise stretch
        // its handful of columns into huge tiles, so cap the total width at
        // what MAX_CELL-sized cells would occupy and let it sit left-aligned.
        maxWidth: `${columns * (MAX_CELL + GAP) - GAP}px`,
      }}
    >
      {cells.map((cell) => {
        const interactive = cell.filled !== false && !!onCellClick;
        return (
          <div
            key={cell.id}
            title={cell.title}
            onClick={interactive ? () => onCellClick(cell.id) : undefined}
            className={`aspect-square rounded-[1.5px] ${
              interactive
                ? "cursor-pointer transition-transform duration-150 hover:scale-[1.6] hover:ring-1 hover:ring-accent/50"
                : ""
            }`}
            style={{
              backgroundColor:
                cell.filled === false ? "transparent" : `var(--streak-${cell.level})`,
            }}
          />
        );
      })}
    </div>
  );
}
