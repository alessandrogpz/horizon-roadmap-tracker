/**
 * The Horizon mark, drawn plate-free in `currentColor` for use inside the app
 * (header). Same shape language as the app icon in `app/icon.svg`:
 * a sun clearing the horizon, where the horizon line is a progress bar.
 *
 * Without the icon's dark plate there's nothing to hide the seam where the bar
 * crosses the sun, so the sun sits just above the line instead of behind it.
 * The viewBox is cropped to the artwork, so the mark sizes off its height and
 * lines up optically with the text beside it.
 */
export default function HorizonMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="56 170 400 164"
      className={className}
      fill="currentColor"
      role="img"
      aria-label="Horizon"
    >
      {/* Sun: a top half-disc, so no clip path (and no duplicate ids across
          however many times this renders). */}
      <path d="M 152 284 A 104 104 0 0 1 360 284 Z" />
      {/* Horizon line, read as a progress bar: full track, then the filled part. */}
      <rect x="64" y="296" width="384" height="30" rx="15" opacity="0.28" />
      <rect x="64" y="296" width="238" height="30" rx="15" />
    </svg>
  );
}
