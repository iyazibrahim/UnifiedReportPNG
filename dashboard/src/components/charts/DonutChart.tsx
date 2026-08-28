type Slice = { label: string; value: number; color: string };

const DEFAULT_COLORS = [
  "oklch(0.22 0.04 240)",
  "oklch(0.52 0.14 235)",
  "oklch(0.72 0.14 85)",
  "oklch(0.78 0.06 230)",
  "oklch(0.62 0.08 235)",
  "oklch(0.88 0.04 230)",
  "oklch(0.42 0.1 155)",
];

export function DonutChart({
  slices,
  size = 180,
  thickness = 28,
  title,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  title?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={title}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={thickness}
        />
        {slices.map((slice, i) => {
          const len = (slice.value / total) * c;
          const el = (
            <circle
              key={slice.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={slice.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += len;
          return el;
        })}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-[var(--color-foreground)] text-xl font-semibold"
          style={{ fontSize: 22 }}
        >
          {slices.reduce((s, x) => s + x.value, 0)}
        </text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{
                background:
                  s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
              }}
            />
            <span className="text-[var(--color-muted-foreground)]">
              {s.label}
            </span>
            <span className="ml-auto font-medium tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
