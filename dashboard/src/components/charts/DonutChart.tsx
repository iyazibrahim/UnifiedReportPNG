type Slice = { label: string; value: number; color: string };

const DEFAULT_COLORS = [
  "#1c4b3a",
  "#2d6a4f",
  "#40916c",
  "#52b788",
  "#74c69d",
  "#95d5b2",
  "#b7e4c7",
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
