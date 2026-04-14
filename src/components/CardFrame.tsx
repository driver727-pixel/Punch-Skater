import { memo } from "react";
import type { Rarity } from "../lib/types";

export const FRAME_RENDER_WIDTH = 750;
export const FRAME_RENDER_HEIGHT = 1050;

export const STANDARD_FRAME_RARITIES = [
  "Apprentice",
  "Master",
  "Rare",
  "Legendary",
] as const satisfies readonly Exclude<Rarity, "Punch Skater">[];

export const FRAME_PREVIEW_RARITIES = [
  "Punch Skater",
  ...STANDARD_FRAME_RARITIES,
] as const satisfies readonly Rarity[];

interface FrameProps {
  width: number;
  height: number;
  rarity: Rarity;
  frameSeed: string;
  uid: string;
}

function seededVal(seed: string, idx: number): number {
  let h = idx * 2654435761;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 2246822519);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  return ((h >>> 0) % 1000) / 1000;
}

function chamferedRectPath(inset: number, chamfer: number) {
  const x1 = inset;
  const y1 = inset;
  const x2 = FRAME_RENDER_WIDTH - inset;
  const y2 = FRAME_RENDER_HEIGHT - inset;
  return [
    `M ${x1 + chamfer} ${y1}`,
    `H ${x2 - chamfer}`,
    `L ${x2} ${y1 + chamfer}`,
    `V ${y2 - chamfer}`,
    `L ${x2 - chamfer} ${y2}`,
    `H ${x1 + chamfer}`,
    `L ${x1} ${y2 - chamfer}`,
    `V ${y1 + chamfer}`,
    "Z",
  ].join(" ");
}

const CORNER_TRANSFORMS = [
  { key: "tl", transform: "translate(48 48)" },
  { key: "tr", transform: `translate(${FRAME_RENDER_WIDTH - 48} 48) scale(-1 1)` },
  { key: "bl", transform: `translate(48 ${FRAME_RENDER_HEIGHT - 48}) scale(1 -1)` },
  { key: "br", transform: `translate(${FRAME_RENDER_WIDTH - 48} ${FRAME_RENDER_HEIGHT - 48}) scale(-1 -1)` },
] as const;

function ApprenticeFrame({ uid }: { uid: string }) {
  const sideTicks = [166, 256, 346, 704, 794, 884];
  return (
    <>
      <defs>
        <linearGradient id={`${uid}_appOuter`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5ef2c7" />
          <stop offset="100%" stopColor="#51bdf4" />
        </linearGradient>
        <linearGradient id={`${uid}_appInner`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d8fff2" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#7fe4ff" stopOpacity="0.75" />
        </linearGradient>
        <filter id={`${uid}_appGlow`} x="-18%" y="-18%" width="136%" height="136%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect x="18" y="18" width="714" height="1014" rx="34"
        fill="none" stroke={`url(#${uid}_appOuter)`} strokeWidth="12" filter={`url(#${uid}_appGlow)`} />
      <rect x="40" y="40" width="670" height="970" rx="28"
        fill="none" stroke={`url(#${uid}_appInner)`} strokeWidth="4" />
      <rect x="58" y="58" width="634" height="934" rx="24"
        fill="none" stroke="#7df6d7" strokeWidth="2" strokeOpacity="0.55" />

      {CORNER_TRANSFORMS.map((corner) => (
        <g key={corner.key} transform={corner.transform}>
          <path d="M 0 112 C 0 44 44 0 112 0" fill="none"
            stroke="#5ef2c7" strokeWidth="12" strokeLinecap="round" />
          <path d="M 20 92 C 20 50 50 20 92 20" fill="none"
            stroke="#dffff5" strokeWidth="3" strokeOpacity="0.85" />
          <circle cx="42" cy="42" r="10" fill="#0e1520" stroke="#7cf3dc" strokeWidth="3" />
          <path d="M 74 18 L 92 18 L 92 36" fill="none"
            stroke="#51bdf4" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 18 74 L 18 92 L 36 92" fill="none"
            stroke="#51bdf4" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}

      {[0.24, 0.5, 0.76].map((t) => (
        <g key={`app-top-${t}`}>
          <path
            d={`M ${FRAME_RENDER_WIDTH * t - 44} 54 L ${FRAME_RENDER_WIDTH * t - 14} 34 L ${FRAME_RENDER_WIDTH * t + 14} 34 L ${FRAME_RENDER_WIDTH * t + 44} 54`}
            fill="none"
            stroke="#7ff6e1"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={`M ${FRAME_RENDER_WIDTH * t - 44} ${FRAME_RENDER_HEIGHT - 54} L ${FRAME_RENDER_WIDTH * t - 14} ${FRAME_RENDER_HEIGHT - 34} L ${FRAME_RENDER_WIDTH * t + 14} ${FRAME_RENDER_HEIGHT - 34} L ${FRAME_RENDER_WIDTH * t + 44} ${FRAME_RENDER_HEIGHT - 54}`}
            fill="none"
            stroke="#7ff6e1"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}

      {sideTicks.map((y) => (
        <g key={`app-side-${y}`}>
          <path d={`M 32 ${y - 24} L 50 ${y} L 32 ${y + 24}`} fill="none"
            stroke="#6fe6ea" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M ${FRAME_RENDER_WIDTH - 32} ${y - 24} L ${FRAME_RENDER_WIDTH - 50} ${y} L ${FRAME_RENDER_WIDTH - 32} ${y + 24}`}
            fill="none" stroke="#6fe6ea" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}

      <path d="M 296 30 H 454" fill="none" stroke="#d6fff8" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.8" />
      <path d={`M 296 ${FRAME_RENDER_HEIGHT - 30} H 454`} fill="none" stroke="#d6fff8" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.8" />
    </>
  );
}

function MasterFrame({ uid }: { uid: string }) {
  const runeY = [150, 240, 330, 720, 810, 900];
  return (
    <>
      <defs>
        <linearGradient id={`${uid}_masterOuter`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff7cf9" />
          <stop offset="50%" stopColor="#c766ff" />
          <stop offset="100%" stopColor="#7e4dff" />
        </linearGradient>
        <linearGradient id={`${uid}_masterInner`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd4ff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#9ba4ff" stopOpacity="0.75" />
        </linearGradient>
        <filter id={`${uid}_masterGlow`} x="-24%" y="-24%" width="148%" height="148%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect x="22" y="22" width="706" height="1006" rx="30"
        fill="none" stroke={`url(#${uid}_masterOuter)`} strokeWidth="14" filter={`url(#${uid}_masterGlow)`} />
      <rect x="46" y="46" width="658" height="958" rx="24"
        fill="none" stroke={`url(#${uid}_masterInner)`} strokeWidth="4" />
      <path d={chamferedRectPath(66, 30)}
        fill="none" stroke="#cc7cff" strokeWidth="3" strokeOpacity="0.75" />
      <path d={chamferedRectPath(88, 24)}
        fill="none" stroke="#6a53ff" strokeWidth="2.5" strokeOpacity="0.45" />

      {CORNER_TRANSFORMS.map((corner) => (
        <g key={corner.key} transform={corner.transform}>
          <path d="M 0 120 L 0 58 L 58 0 L 120 0"
            fill="none" stroke="#ff86ff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 22 94 L 22 64 L 64 22 L 94 22"
            fill="none" stroke="#d5cbff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <polygon points="58,10 88,40 58,70 28,40"
            fill="#28163d" stroke="#ff9dff" strokeWidth="4" />
          <polygon points="58,22 76,40 58,58 40,40"
            fill="#ff78ff" fillOpacity="0.7" />
        </g>
      ))}

      {[375, 525].map((y) => (
        <g key={`master-mid-${y}`}>
          <polygon points={`375,${y - 34} 409,${y} 375,${y + 34} 341,${y}`}
            fill="none" stroke="#ff9aff" strokeWidth="5" filter={`url(#${uid}_masterGlow)`} />
        </g>
      ))}

      {[0.27, 0.5, 0.73].map((t) => (
        <g key={`master-cap-${t}`}>
          <rect x={FRAME_RENDER_WIDTH * t - 52} y="34" width="104" height="18" rx="8"
            fill="#26163a" stroke="#ff8aff" strokeWidth="4" />
          <rect x={FRAME_RENDER_WIDTH * t - 34} y={FRAME_RENDER_HEIGHT - 52} width="68" height="18" rx="8"
            fill="#26163a" stroke="#8a76ff" strokeWidth="4" />
        </g>
      ))}

      {runeY.map((y) => (
        <g key={`master-rune-${y}`}>
          <path d={`M 30 ${y - 26} H 52 M 30 ${y} H 58 M 30 ${y + 26} H 52`}
            fill="none" stroke="#f5a5ff" strokeWidth="4" strokeLinecap="round" />
          <path d={`M ${FRAME_RENDER_WIDTH - 30} ${y - 26} H ${FRAME_RENDER_WIDTH - 52} M ${FRAME_RENDER_WIDTH - 30} ${y} H ${FRAME_RENDER_WIDTH - 58} M ${FRAME_RENDER_WIDTH - 30} ${y + 26} H ${FRAME_RENDER_WIDTH - 52}`}
            fill="none" stroke="#f5a5ff" strokeWidth="4" strokeLinecap="round" />
        </g>
      ))}
    </>
  );
}

function RareFrame({ uid }: { uid: string }) {
  const shardY = [176, 300, 432, 618, 750, 882];
  return (
    <>
      <defs>
        <linearGradient id={`${uid}_rareOuter`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8fe2ff" />
          <stop offset="50%" stopColor="#55a9ff" />
          <stop offset="100%" stopColor="#2e53ff" />
        </linearGradient>
        <linearGradient id={`${uid}_rareInner`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d6f7ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#8cb6ff" stopOpacity="0.7" />
        </linearGradient>
        <filter id={`${uid}_rareGlow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <path d={chamferedRectPath(20, 52)}
        fill="none" stroke={`url(#${uid}_rareOuter)`} strokeWidth="14" filter={`url(#${uid}_rareGlow)`} />
      <path d={chamferedRectPath(46, 40)}
        fill="none" stroke={`url(#${uid}_rareInner)`} strokeWidth="4" />
      <path d={chamferedRectPath(64, 28)}
        fill="none" stroke="#95d9ff" strokeWidth="2.5" strokeOpacity="0.6" />

      {CORNER_TRANSFORMS.map((corner) => (
        <g key={corner.key} transform={corner.transform}>
          <polygon points="0,70 70,0 124,0 124,54 54,124 0,124"
            fill="none" stroke="#7bd6ff" strokeWidth="9" strokeLinejoin="round" />
          <polygon points="26,74 74,26 98,26 98,50 50,98 26,98"
            fill="#10264f" stroke="#d8f7ff" strokeWidth="3" strokeLinejoin="round" />
          <polygon points="62,30 94,62 62,94 30,62"
            fill="#68adff" fillOpacity="0.5" stroke="#c7eeff" strokeWidth="3" />
        </g>
      ))}

      {[0.22, 0.5, 0.78].map((t) => (
        <g key={`rare-top-${t}`}>
          <polygon points={`${FRAME_RENDER_WIDTH * t - 34},36 ${FRAME_RENDER_WIDTH * t},18 ${FRAME_RENDER_WIDTH * t + 34},36 ${FRAME_RENDER_WIDTH * t},54`}
            fill="#15316b" stroke="#95dfff" strokeWidth="4" />
          <polygon points={`${FRAME_RENDER_WIDTH * t - 20},${FRAME_RENDER_HEIGHT - 36} ${FRAME_RENDER_WIDTH * t},${FRAME_RENDER_HEIGHT - 18} ${FRAME_RENDER_WIDTH * t + 20},${FRAME_RENDER_HEIGHT - 36} ${FRAME_RENDER_WIDTH * t},${FRAME_RENDER_HEIGHT - 54}`}
            fill="#15316b" stroke="#95dfff" strokeWidth="4" />
        </g>
      ))}

      {shardY.map((y) => (
        <g key={`rare-shard-${y}`}>
          <polygon points={`22,${y - 32} 44,${y - 10} 44,${y + 10} 22,${y + 32}`}
            fill="#18386f" stroke="#8edfff" strokeWidth="4" />
          <polygon points={`${FRAME_RENDER_WIDTH - 22},${y - 32} ${FRAME_RENDER_WIDTH - 44},${y - 10} ${FRAME_RENDER_WIDTH - 44},${y + 10} ${FRAME_RENDER_WIDTH - 22},${y + 32}`}
            fill="#18386f" stroke="#8edfff" strokeWidth="4" />
        </g>
      ))}

      <path d="M 130 74 H 620" fill="none" stroke="#c8f6ff" strokeWidth="3" strokeOpacity="0.8" />
      <path d={`M 130 ${FRAME_RENDER_HEIGHT - 74} H 620`} fill="none" stroke="#c8f6ff" strokeWidth="3" strokeOpacity="0.8" />
    </>
  );
}

function LegendaryFrame({ uid }: { uid: string }) {
  const filigreeX = [170, 260, 375, 490, 580];
  return (
    <>
      <defs>
        <linearGradient id={`${uid}_legendOuter`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff3bf" />
          <stop offset="38%" stopColor="#ffca55" />
          <stop offset="70%" stopColor="#ff9c1b" />
          <stop offset="100%" stopColor="#ffef9d" />
        </linearGradient>
        <linearGradient id={`${uid}_legendInner`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6cf" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffb93b" stopOpacity="0.75" />
        </linearGradient>
        <filter id={`${uid}_legendGlow`} x="-26%" y="-26%" width="152%" height="152%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect x="18" y="18" width="714" height="1014" rx="40"
        fill="none" stroke={`url(#${uid}_legendOuter)`} strokeWidth="18" filter={`url(#${uid}_legendGlow)`} />
      <rect x="46" y="46" width="658" height="958" rx="30"
        fill="none" stroke={`url(#${uid}_legendInner)`} strokeWidth="5" />
      <rect x="66" y="66" width="618" height="918" rx="24"
        fill="none" stroke="#ffe09e" strokeWidth="2.5" strokeOpacity="0.65" />

      {CORNER_TRANSFORMS.map((corner) => (
        <g key={corner.key} transform={corner.transform}>
          <path d="M 0 130 C 0 54 54 0 130 0"
            fill="none" stroke="#ffbf3d" strokeWidth="14" strokeLinecap="round" />
          <path d="M 20 110 C 20 58 58 20 110 20"
            fill="none" stroke="#fff0b2" strokeWidth="4" strokeLinecap="round" />
          <path d="M 16 94 C 56 82 82 56 94 16"
            fill="none" stroke="#ffda78" strokeWidth="4" strokeLinecap="round" />
          <circle cx="56" cy="56" r="14" fill="#3a2300" stroke="#ffe8a0" strokeWidth="4" />
          <circle cx="56" cy="56" r="5" fill="#ffdd73" />
        </g>
      ))}

      <g filter={`url(#${uid}_legendGlow)`}>
        <path d="M 275 30 L 320 52 H 430 L 475 30"
          fill="none" stroke="#ffd464" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M 300 ${FRAME_RENDER_HEIGHT - 30} L 336 ${FRAME_RENDER_HEIGHT - 52} H 414 L 450 ${FRAME_RENDER_HEIGHT - 30}`}
          fill="none" stroke="#ffd464" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {[240, 810].map((y) => (
        <g key={`legend-medal-${y}`}>
          <circle cx="44" cy={y} r="17" fill="#472b00" stroke="#ffe18a" strokeWidth="4" />
          <circle cx={FRAME_RENDER_WIDTH - 44} cy={y} r="17" fill="#472b00" stroke="#ffe18a" strokeWidth="4" />
          <circle cx="44" cy={y} r="6" fill="#ffd36a" />
          <circle cx={FRAME_RENDER_WIDTH - 44} cy={y} r="6" fill="#ffd36a" />
        </g>
      ))}

      {filigreeX.map((x) => (
        <g key={`legend-filigree-${x}`}>
          <path d={`M ${x - 28} 52 Q ${x} 24 ${x + 28} 52`}
            fill="none" stroke="#ffe297" strokeWidth="3.5" strokeLinecap="round" />
          <path d={`M ${x - 22} ${FRAME_RENDER_HEIGHT - 52} Q ${x} ${FRAME_RENDER_HEIGHT - 24} ${x + 22} ${FRAME_RENDER_HEIGHT - 52}`}
            fill="none" stroke="#ffe297" strokeWidth="3.5" strokeLinecap="round" />
        </g>
      ))}
    </>
  );
}

function PunchSkaterFrame({ frameSeed }: { frameSeed: string }) {
  const w = FRAME_RENDER_WIDTH;
  const h = FRAME_RENDER_HEIGHT;
  const spatters = Array.from({ length: 24 }, (_, i) => {
    const side = seededVal(frameSeed, i * 6) > 0.5 ? 1 : 3;
    const pos = seededVal(frameSeed, i * 6 + 1);
    const off = seededVal(frameSeed, i * 6 + 2) * 60 + 12;
    const r = 4 + seededVal(frameSeed, i * 6 + 3) * 18;
    const op = 0.3 + seededVal(frameSeed, i * 6 + 4) * 0.6;
    const dark = seededVal(frameSeed, i * 6 + 5) > 0.55;
    let px: number;
    let py: number;
    if (side === 1) {
      px = w - off;
      py = pos * h;
    } else {
      px = off;
      py = pos * h;
    }
    return { x: px, y: py, r, op, color: dark ? "#5a0808" : "#8b1a1a" };
  });
  const edgeWraps = [
    {
      cy: 18,
      ang: (seededVal(frameSeed, 400) - 0.5) * 6,
      thickness: 24 + seededVal(frameSeed, 401) * 10,
      opacity: 0.92 + seededVal(frameSeed, 402) * 0.08,
    },
    {
      cy: h - 18,
      ang: (seededVal(frameSeed, 410) - 0.5) * 6,
      thickness: 24 + seededVal(frameSeed, 411) * 10,
      opacity: 0.92 + seededVal(frameSeed, 412) * 0.08,
    },
  ];
  const frays = Array.from({ length: 8 }, (_, i) => {
    const isTop = i < 4;
    const side = i % 2 === 0 ? "left" : "right";
    const baseY = isTop ? 18 : h - 18;
    const x = side === "left"
      ? -8 + seededVal(frameSeed, 500 + i * 3) * 24
      : w - 12 + seededVal(frameSeed, 500 + i * 3) * 24;
    const y = baseY + (seededVal(frameSeed, 501 + i * 3) - 0.5) * 18;
    const len = 18 + seededVal(frameSeed, 502 + i * 3) * 18;
    const xDirection = side === "left" ? -1 : 1;
    const yDirection = isTop ? -1 : 1;
    return { x, y, len, xDirection, yDirection };
  });
  return (
    <>
      <rect x={4} y={4} width={w - 8} height={h - 8} rx={10}
        fill="none" stroke="#c8b89a" strokeWidth="6" strokeOpacity="0.78" />
      {edgeWraps.map((bandage, i) => (
        <rect key={i}
          x={-14} y={bandage.cy - bandage.thickness / 2}
          width={w + 28} height={bandage.thickness} rx={6}
          fill="#e8d8b0" fillOpacity={bandage.opacity}
          stroke="#c8b89a" strokeWidth="3"
          transform={`rotate(${bandage.ang},${w / 2},${bandage.cy})`} />
      ))}
      {frays.map((fray, i) => (
        <line
          key={`fray-${i}`}
          x1={fray.x}
          y1={fray.y}
          x2={fray.x + fray.len * fray.xDirection}
          y2={fray.y + fray.yDirection * 6}
          stroke="#d8c8a1"
          strokeOpacity="0.45"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
      {spatters.map((spatter, i) => (
        <circle key={i} cx={spatter.x} cy={spatter.y} r={spatter.r}
          fill={spatter.color} fillOpacity={spatter.op} />
      ))}
    </>
  );
}

function CardFrameComponent({ width, height, rarity, frameSeed, uid }: FrameProps) {
  const scaleX = width / FRAME_RENDER_WIDTH;
  const scaleY = height / FRAME_RENDER_HEIGHT;

  return (
    <g transform={`scale(${scaleX} ${scaleY})`}>
      {rarity === "Apprentice" && <ApprenticeFrame uid={uid} />}
      {rarity === "Master" && <MasterFrame uid={uid} />}
      {rarity === "Rare" && <RareFrame uid={uid} />}
      {rarity === "Legendary" && <LegendaryFrame uid={uid} />}
      {rarity === "Punch Skater" && <PunchSkaterFrame frameSeed={frameSeed} />}
    </g>
  );
}

function areCardFramePropsEqual(previous: FrameProps, next: FrameProps): boolean {
  return (
    previous.width === next.width &&
    previous.height === next.height &&
    previous.rarity === next.rarity &&
    previous.frameSeed === next.frameSeed &&
    previous.uid === next.uid
  );
}

export const CardFrame = memo(CardFrameComponent, areCardFramePropsEqual);
CardFrame.displayName = "CardFrame";
