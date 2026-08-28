import { AGENCY_THEME } from "@/lib/api";

const AGENCY_ORDER = [
  "pearl_mbpp",
  "aspire_mbsp",
  "myjalan",
  "pbapp",
  "epintas",
] as const;

export function AgencyFlow({
  byAgency,
}: {
  byAgency: Record<string, number>;
}) {
  const nodes = AGENCY_ORDER.map((id) => ({
    id,
    label: AGENCY_THEME[id]?.short || id,
    count: byAgency[id] || 0,
    color: AGENCY_THEME[id]?.accent || "oklch(0.52 0.14 235)",
  }));

  const w = 640;
  const h = 280;
  const source = { x: w / 2, y: 36 };
  const targets = nodes.map((_, i) => {
    const gap = w / (nodes.length + 1);
    return { x: gap * (i + 1), y: 210 };
  });

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mx-auto h-auto w-full max-w-3xl"
        role="img"
        aria-label="Citizen reports flowing to agencies"
      >
        <defs>
          <style>{`
            @keyframes urp-flow {
              from { stroke-dashoffset: 24; }
              to { stroke-dashoffset: 0; }
            }
            @keyframes urp-pulse {
              0%, 100% { opacity: 0.45; r: 18; }
              50% { opacity: 0.85; r: 22; }
            }
            .urp-flow-line {
              stroke-dasharray: 6 6;
              animation: urp-flow 1.2s linear infinite;
            }
            .urp-pulse {
              animation: urp-pulse 2.4s ease-in-out infinite;
            }
          `}</style>
        </defs>

        {targets.map((t, i) => (
          <path
            key={nodes[i].id}
            d={`M ${source.x} ${source.y + 28} C ${source.x} ${source.y + 100}, ${t.x} ${t.y - 80}, ${t.x} ${t.y - 28}`}
            fill="none"
            stroke={nodes[i].color}
            strokeWidth={1.5}
            opacity={0.55}
            className="urp-flow-line"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}

        <circle
          cx={source.x}
          cy={source.y}
          r={20}
          fill="oklch(0.52 0.14 235)"
          className="urp-pulse"
        />
        <circle cx={source.x} cy={source.y} r={14} fill="oklch(0.22 0.04 240)" />
        <text
          x={source.x}
          y={source.y + 4}
          textAnchor="middle"
          fill="white"
          fontSize="10"
          fontWeight="600"
        >
          Reports
        </text>
        <text
          x={source.x}
          y={source.y + 48}
          textAnchor="middle"
          fill="currentColor"
          fontSize="12"
          opacity={0.7}
        >
          Citizen channel
        </text>

        {nodes.map((n, i) => {
          const t = targets[i];
          return (
            <g key={n.id}>
              <circle
                cx={t.x}
                cy={t.y}
                r={26}
                fill="none"
                stroke={n.color}
                strokeWidth={1.5}
                opacity={0.35}
                className="urp-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
              <circle cx={t.x} cy={t.y} r={22} fill={n.color} />
              <text
                x={t.x}
                y={t.y + 4}
                textAnchor="middle"
                fill="white"
                fontSize="11"
                fontWeight="600"
              >
                {n.label}
              </text>
              <rect
                x={t.x - 14}
                y={t.y + 30}
                width={28}
                height={18}
                rx={9}
                fill={n.color}
                opacity={0.15}
              />
              <text
                x={t.x}
                y={t.y + 43}
                textAnchor="middle"
                fill={n.color}
                fontSize="12"
                fontWeight="700"
              >
                {n.count}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
