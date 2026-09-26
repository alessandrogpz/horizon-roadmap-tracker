/**
 * A progress ring. An SVG circle with a dash offset, which is two lines and
 * exact — the phone builds the same thing out of two clipped half-circles,
 * because `react-native-svg` is not in that build.
 *
 * No state and no hooks, so a server component can render it.
 */
export default function TrackRing({
  pct,
  size = 26,
  stroke = 3,
  color,
  title,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color: string;
  title?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const done = Math.max(0, Math.min(100, pct)) / 100;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title ?? `${Math.round(pct)}% through`}>
      {title ? <title>{title}</title> : null}
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--card-border)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - done)}
        // Zero is twelve o'clock, going clockwise — the direction a clock and
        // every other progress ring goes, rather than the three o'clock start
        // an SVG circle has by default.
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
