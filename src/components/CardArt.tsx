import type { CardPayload } from "../lib/types";

interface CardArtProps {
  card: CardPayload;
  width?: number;
  height?: number;
}

const DISTRICT_COLORS: Record<string, string> = {
  "Neon District": "#ff00aa",
  "The Sprawl": "#ff6600",
  "Chrome Heights": "#88ccff",
  "Undercity": "#aa44ff",
  "Corporate Core": "#00ccff",
};

const RARITY_STARS: Record<string, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Legendary: 4,
};

function CityscapeBackground({ width, height, districtColor }: { width: number; height: number; districtColor: string }) {
  const buildings = [
    { x: 0, w: 30, h: 80 },
    { x: 28, w: 20, h: 60 },
    { x: 46, w: 35, h: 100 },
    { x: 79, w: 25, h: 70 },
    { x: 102, w: 40, h: 90 },
    { x: 140, w: 22, h: 55 },
    { x: 160, w: 38, h: 95 },
  ];

  return (
    <>
      {/* Sky gradient */}
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#050510" />
          <stop offset="100%" stopColor="#0a0a2f" />
        </linearGradient>
        <linearGradient id="glowGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={districtColor} stopOpacity="0.4" />
          <stop offset="100%" stopColor={districtColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill="url(#skyGrad)" />
      {/* Horizon glow */}
      <rect x={0} y={height * 0.45} width={width} height={height * 0.2} fill="url(#glowGrad)" />
      {/* Buildings silhouette */}
      {buildings.map((b, i) => (
        <g key={i}>
          <rect
            x={b.x}
            y={height * 0.55 - b.h}
            width={b.w}
            height={b.h}
            fill="#0d0d1a"
            stroke={districtColor}
            strokeWidth="0.5"
            strokeOpacity="0.6"
          />
          {/* Window lights */}
          {Array.from({ length: Math.floor(b.h / 12) }).map((_, wi) => (
            <rect
              key={wi}
              x={b.x + 4}
              y={height * 0.55 - b.h + 8 + wi * 12}
              width={4}
              height={3}
              fill={districtColor}
              fillOpacity={Math.random() > 0.4 ? 0.8 : 0.1}
            />
          ))}
        </g>
      ))}
      {/* Ground */}
      <rect x={0} y={height * 0.55} width={width} height={height * 0.45} fill="#080812" />
      {/* Street lines */}
      <line x1={0} y1={height * 0.7} x2={width} y2={height * 0.7} stroke={districtColor} strokeWidth="0.5" strokeOpacity="0.3" />
      <line x1={0} y1={height * 0.8} x2={width} y2={height * 0.8} stroke={districtColor} strokeWidth="0.5" strokeOpacity="0.2" />
    </>
  );
}

function CourierFigure({ cx, cy, accentColor }: { cx: number; cy: number; accentColor: string }) {
  return (
    <g>
      {/* Board */}
      <rect x={cx - 28} y={cy + 28} width={56} height={8} rx={4} fill="#1a1a2e" stroke={accentColor} strokeWidth="1.5" />
      {/* Wheels */}
      <circle cx={cx - 18} cy={cy + 40} r={6} fill="#111" stroke={accentColor} strokeWidth="1.5" />
      <circle cx={cx + 18} cy={cy + 40} r={6} fill="#111" stroke={accentColor} strokeWidth="1.5" />
      {/* Wheel glow */}
      <circle cx={cx - 18} cy={cy + 40} r={3} fill={accentColor} fillOpacity="0.7" />
      <circle cx={cx + 18} cy={cy + 40} r={3} fill={accentColor} fillOpacity="0.7" />
      {/* Body / torso */}
      <rect x={cx - 12} y={cy - 10} width={24} height={30} rx={4} fill="#1e1e3a" stroke={accentColor} strokeWidth="1" />
      {/* Jacket stripe */}
      <line x1={cx} y1={cy - 10} x2={cx} y2={cy + 20} stroke={accentColor} strokeWidth="2" strokeOpacity="0.7" />
      {/* Legs */}
      <rect x={cx - 10} y={cy + 18} width={8} height={14} rx={2} fill="#14142a" />
      <rect x={cx + 2} y={cy + 18} width={8} height={14} rx={2} fill="#14142a" />
      {/* Head */}
      <circle cx={cx} cy={cy - 18} r={11} fill="#1e1e3a" stroke={accentColor} strokeWidth="1.5" />
      {/* Visor */}
      <path d={`M${cx - 8},${cy - 22} Q${cx},${cy - 28} ${cx + 8},${cy - 22}`} fill={accentColor} fillOpacity="0.5" />
      <rect x={cx - 8} y={cy - 22} width={16} height={5} rx={2} fill={accentColor} fillOpacity="0.6" />
      {/* Arm extended */}
      <rect x={cx + 10} y={cy - 5} width={14} height={6} rx={3} fill="#1e1e3a" stroke={accentColor} strokeWidth="1" transform={`rotate(-20,${cx + 10},${cy - 2})`} />
      {/* Glow under board */}
      <ellipse cx={cx} cy={cy + 43} rx={22} ry={4} fill={accentColor} fillOpacity="0.25" />
    </g>
  );
}

export function CardArt({ card, width = 200, height = 140 }: CardArtProps) {
  const accent = card.visuals.accentColor || "#00ff88";
  const districtColor = DISTRICT_COLORS[card.prompts.district] || accent;
  const stars = RARITY_STARS[card.prompts.rarity] || 1;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
      aria-label={`Card art for ${card.identity.name}`}
    >
      <CityscapeBackground width={width} height={height} districtColor={districtColor} />
      <CourierFigure cx={width / 2} cy={height * 0.55} accentColor={accent} />
      {/* Rarity stars */}
      {Array.from({ length: stars }).map((_, i) => (
        <polygon
          key={i}
          points="0,-5 1.5,-1.5 5,-1.5 2.5,1 3.5,5 0,2.5 -3.5,5 -2.5,1 -5,-1.5 -1.5,-1.5"
          fill={accent}
          transform={`translate(${width / 2 - (stars - 1) * 7 + i * 14}, 12)`}
        />
      ))}
      {/* District label */}
      <text
        x={width - 4}
        y={height - 4}
        textAnchor="end"
        fontSize="6"
        fill={districtColor}
        fontFamily="monospace"
        fillOpacity="0.8"
      >
        {card.prompts.district}
      </text>
      {/* Archetype badge */}
      <rect x={2} y={2} width={40} height={12} rx={3} fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="0.5" />
      <text x={22} y={11} textAnchor="middle" fontSize="7" fill={accent} fontFamily="monospace">
        {card.prompts.archetype.toUpperCase()}
      </text>
    </svg>
  );
}
