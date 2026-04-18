import { memo } from "react";
import type { Rarity } from "../lib/types";
import { createFrameUid } from "../lib/frameUid";

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

const FRAME_TOP_CONNECTORS = [170, 375, 580] as const;
const FRAME_SIDE_CONNECTORS = [176, 314, 735, 874] as const;
const CORNER_TRANSFORMS = [
  { key: "tl", transform: "translate(54 54)" },
  { key: "tr", transform: `translate(${FRAME_RENDER_WIDTH - 54} 54) scale(-1 1)` },
  { key: "bl", transform: `translate(54 ${FRAME_RENDER_HEIGHT - 54}) scale(1 -1)` },
  { key: "br", transform: `translate(${FRAME_RENDER_WIDTH - 54} ${FRAME_RENDER_HEIGHT - 54}) scale(-1 -1)` },
] as const;

function seededVal(seed: string, idx: number): number {
  let h = idx * 2654435761;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 2246822519);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  return ((h >>> 0) % 1000) / 1000;
}

function buildRustPatches(seed: string) {
  return Array.from({ length: 8 }, (_, index) => {
    const orientation = index < 4 ? "horizontal" : "vertical";
    const along = 0.18 + seededVal(seed, index * 5) * 0.64;
    const offset = 30 + seededVal(seed, index * 5 + 1) * 14;
    const length = 30 + seededVal(seed, index * 5 + 2) * 22;
    const thickness = 7 + seededVal(seed, index * 5 + 3) * 4;
    const angle = (seededVal(seed, index * 5 + 4) - 0.5) * 14;

    if (orientation === "horizontal") {
      const isTop = index % 2 === 0;
      return {
        x: FRAME_RENDER_WIDTH * along - length / 2,
        y: isTop ? offset : FRAME_RENDER_HEIGHT - offset - thickness,
        width: length,
        height: thickness,
        angle,
      };
    }

    const isLeft = index % 2 === 0;
    return {
      x: isLeft ? offset : FRAME_RENDER_WIDTH - offset - thickness,
      y: FRAME_RENDER_HEIGHT * along - length / 2,
      width: thickness,
      height: length,
      angle,
    };
  });
}

function buildEdgeSpecks(seed: string, colorA: string, colorB: string) {
  return Array.from({ length: 24 }, (_, index) => {
    const side = Math.floor(seededVal(seed, index * 6) * 4);
    const along = 0.07 + seededVal(seed, index * 6 + 1) * 0.86;
    const inset = 20 + seededVal(seed, index * 6 + 2) * 22;
    const radius = 1.5 + seededVal(seed, index * 6 + 3) * 5.5;
    const opacity = 0.25 + seededVal(seed, index * 6 + 4) * 0.45;
    const color = seededVal(seed, index * 6 + 5) > 0.55 ? colorA : colorB;

    if (side === 0) return { x: FRAME_RENDER_WIDTH * along, y: inset, radius, opacity, color };
    if (side === 1) return { x: FRAME_RENDER_WIDTH - inset, y: FRAME_RENDER_HEIGHT * along, radius, opacity, color };
    if (side === 2) return { x: FRAME_RENDER_WIDTH * along, y: FRAME_RENDER_HEIGHT - inset, radius, opacity, color };
    return { x: inset, y: FRAME_RENDER_HEIGHT * along, radius, opacity, color };
  });
}

function PunchSkaterFrame({ uid, frameSeed }: { uid: string; frameSeed: string }) {
  const safeUid = createFrameUid(uid, 40);
  const rustPatches = buildRustPatches(frameSeed);
  const specks = buildEdgeSpecks(frameSeed, "#a9632e", "#4d2719");
  const tieBands = [140, 375, 610];

  return (
    <>
      <defs>
        <linearGradient id={`${safeUid}_rustCable`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2f2118" />
          <stop offset="28%" stopColor="#74472a" />
          <stop offset="55%" stopColor="#b36a34" />
          <stop offset="100%" stopColor="#4f2f1e" />
        </linearGradient>
        <linearGradient id={`${safeUid}_rustHighlight`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d9b07e" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#7e502b" stopOpacity="0.18" />
        </linearGradient>
        <filter id={`${safeUid}_rustGlow`} x="-16%" y="-16%" width="132%" height="132%">
          <feGaussianBlur stdDeviation="2.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect
        x="20"
        y="20"
        width="710"
        height="1010"
        rx="44"
        fill="none"
        stroke={`url(#${safeUid}_rustCable)`}
        strokeWidth="8"
        filter={`url(#${safeUid}_rustGlow)`}
      />
      <rect
        x="34"
        y="34"
        width="682"
        height="982"
        rx="36"
        fill="none"
        stroke={`url(#${safeUid}_rustHighlight)`}
        strokeWidth="2.5"
        strokeOpacity="0.95"
      />

      {CORNER_TRANSFORMS.map((corner) => (
        <g key={corner.key} transform={corner.transform}>
          <path
            d="M 0 86 C 0 34 34 0 86 0"
            fill="none"
            stroke="#6d4327"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 10 92 C 16 48 48 16 92 10"
            fill="none"
            stroke="#d5ae76"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeOpacity="0.72"
          />
          <circle cx="22" cy="64" r="7.5" fill="#3a2318" stroke="#8e552c" strokeWidth="2" />
          <circle cx="64" cy="22" r="7.5" fill="#3a2318" stroke="#8e552c" strokeWidth="2" />
        </g>
      ))}

      {tieBands.map((x) => (
        <g key={`rust-tie-top-${x}`}>
          <rect x={x - 14} y="16" width="28" height="18" rx="6" fill="#b48a62" fillOpacity="0.9" />
          <rect x={x - 14} y={FRAME_RENDER_HEIGHT - 34} width="28" height="18" rx="6" fill="#b48a62" fillOpacity="0.9" />
        </g>
      ))}

      {FRAME_SIDE_CONNECTORS.map((y) => (
        <g key={`rust-side-${y}`}>
          <rect x="14" y={y - 12} width="18" height="24" rx="6" fill="#b48a62" fillOpacity="0.88" />
          <rect x={FRAME_RENDER_WIDTH - 32} y={y - 12} width="18" height="24" rx="6" fill="#b48a62" fillOpacity="0.88" />
        </g>
      ))}

      {rustPatches.map((patch, index) => (
        <rect
          key={`patch-${index}`}
          x={patch.x}
          y={patch.y}
          width={patch.width}
          height={patch.height}
          rx={Math.min(patch.width, patch.height) / 2}
          fill="#c9a377"
          fillOpacity="0.82"
          stroke="#8c603a"
          strokeWidth="1.3"
          transform={`rotate(${patch.angle}, ${patch.x + patch.width / 2}, ${patch.y + patch.height / 2})`}
        />
      ))}

      {specks.map((speck, index) => (
        <circle
          key={`speck-${index}`}
          cx={speck.x}
          cy={speck.y}
          r={speck.radius}
          fill={speck.color}
          fillOpacity={speck.opacity}
        />
      ))}
    </>
  );
}

function ApprenticeFrame({ uid }: { uid: string }) {
  const safeUid = createFrameUid(uid, 40);
  return (
    <>
      <defs>
        <linearGradient id={`${safeUid}_clearCable`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e9ffff" stopOpacity="0.78" />
          <stop offset="35%" stopColor="#c8faff" stopOpacity="0.62" />
          <stop offset="100%" stopColor="#77cbe0" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id={`${safeUid}_clearCore`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#b0f4ff" stopOpacity="0.18" />
        </linearGradient>
        <filter id={`${safeUid}_clearGlow`} x="-18%" y="-18%" width="136%" height="136%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect
        x="18"
        y="18"
        width="714"
        height="1014"
        rx="42"
        fill="none"
        stroke={`url(#${safeUid}_clearCable)`}
        strokeWidth="6"
        filter={`url(#${safeUid}_clearGlow)`}
      />
      <rect
        x="30"
        y="30"
        width="690"
        height="990"
        rx="36"
        fill="none"
        stroke={`url(#${safeUid}_clearCore)`}
        strokeWidth="2.5"
      />
      <rect
        x="43"
        y="43"
        width="664"
        height="964"
        rx="30"
        fill="none"
        stroke="#ecffff"
        strokeWidth="1.4"
        strokeOpacity="0.46"
      />

      {CORNER_TRANSFORMS.map((corner) => (
        <g key={corner.key} transform={corner.transform}>
          <path
            d="M 0 88 C 0 36 36 0 88 0"
            fill="none"
            stroke="#d8ffff"
            strokeWidth="6"
            strokeLinecap="round"
            strokeOpacity="0.74"
          />
          <path
            d="M 10 96 C 14 50 50 14 96 10"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeOpacity="0.8"
          />
          <rect x="16" y="58" width="22" height="12" rx="4" fill="#d6ffff" fillOpacity="0.25" stroke="#b0eef9" strokeWidth="1.5" />
          <rect x="58" y="16" width="12" height="22" rx="4" fill="#d6ffff" fillOpacity="0.25" stroke="#b0eef9" strokeWidth="1.5" />
        </g>
      ))}

      {FRAME_TOP_CONNECTORS.map((x) => (
        <g key={`app-top-${x}`}>
          <rect x={x - 26} y="14" width="52" height="18" rx="6" fill="#ebffff" fillOpacity="0.18" stroke="#b7edf9" strokeWidth="1.8" />
          <rect x={x - 26} y={FRAME_RENDER_HEIGHT - 32} width="52" height="18" rx="6" fill="#ebffff" fillOpacity="0.18" stroke="#b7edf9" strokeWidth="1.8" />
        </g>
      ))}

      {FRAME_SIDE_CONNECTORS.map((y) => (
        <g key={`app-side-${y}`}>
          <rect x="14" y={y - 16} width="18" height="32" rx="6" fill="#ebffff" fillOpacity="0.16" stroke="#b7edf9" strokeWidth="1.8" />
          <rect x={FRAME_RENDER_WIDTH - 32} y={y - 16} width="18" height="32" rx="6" fill="#ebffff" fillOpacity="0.16" stroke="#b7edf9" strokeWidth="1.8" />
        </g>
      ))}
    </>
  );
}

function MasterFrame({ uid }: { uid: string }) {
  const safeUid = createFrameUid(uid, 40);
  const collarY = [170, 330, 720, 880];
  return (
    <>
      <defs>
        <linearGradient id={`${safeUid}_copperCable`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6f3617" />
          <stop offset="26%" stopColor="#b56532" />
          <stop offset="52%" stopColor="#f4b176" />
          <stop offset="78%" stopColor="#b5602b" />
          <stop offset="100%" stopColor="#6f3819" />
        </linearGradient>
        <linearGradient id={`${safeUid}_copperHighlight`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff2dd" stopOpacity="0.84" />
          <stop offset="100%" stopColor="#d87f43" stopOpacity="0.2" />
        </linearGradient>
        <filter id={`${safeUid}_copperGlow`} x="-16%" y="-16%" width="132%" height="132%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect
        x="20"
        y="20"
        width="710"
        height="1010"
        rx="44"
        fill="none"
        stroke={`url(#${safeUid}_copperCable)`}
        strokeWidth="7"
        filter={`url(#${safeUid}_copperGlow)`}
      />
      <rect
        x="34"
        y="34"
        width="682"
        height="982"
        rx="36"
        fill="none"
        stroke={`url(#${safeUid}_copperHighlight)`}
        strokeWidth="2.4"
      />
      <rect
        x="48"
        y="48"
        width="654"
        height="954"
        rx="30"
        fill="none"
        stroke="#f2c28e"
        strokeWidth="1.4"
        strokeOpacity="0.4"
      />

      {CORNER_TRANSFORMS.map((corner) => (
        <g key={corner.key} transform={corner.transform}>
          <path
            d="M 0 84 C 0 34 34 0 84 0"
            fill="none"
            stroke="#a75828"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M 8 94 C 16 48 48 16 94 8"
            fill="none"
            stroke="#fff0d3"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeOpacity="0.82"
          />
          <rect x="18" y="58" width="20" height="12" rx="5" fill="#7f451f" stroke="#f0b47b" strokeWidth="1.6" />
          <rect x="58" y="18" width="12" height="20" rx="5" fill="#7f451f" stroke="#f0b47b" strokeWidth="1.6" />
        </g>
      ))}

      {FRAME_TOP_CONNECTORS.map((x) => (
        <g key={`master-top-${x}`}>
          <rect x={x - 24} y="14" width="48" height="18" rx="7" fill="#91512a" stroke="#efb57d" strokeWidth="1.8" />
          <rect x={x - 24} y={FRAME_RENDER_HEIGHT - 32} width="48" height="18" rx="7" fill="#91512a" stroke="#efb57d" strokeWidth="1.8" />
        </g>
      ))}

      {collarY.map((y) => (
        <g key={`master-side-${y}`}>
          <rect x="14" y={y - 15} width="18" height="30" rx="7" fill="#91512a" stroke="#efb57d" strokeWidth="1.8" />
          <rect x={FRAME_RENDER_WIDTH - 32} y={y - 15} width="18" height="30" rx="7" fill="#91512a" stroke="#efb57d" strokeWidth="1.8" />
        </g>
      ))}
    </>
  );
}

function RareFrame({ uid }: { uid: string }) {
  const safeUid = createFrameUid(uid, 40);
  const neonNodes = [
    { x: 144, y: 26, color: "#6ff6ff" },
    { x: 375, y: 26, color: "#7eff73" },
    { x: 606, y: 26, color: "#ff5cff" },
    { x: 144, y: FRAME_RENDER_HEIGHT - 26, color: "#ffae4f" },
    { x: 375, y: FRAME_RENDER_HEIGHT - 26, color: "#6ff6ff" },
    { x: 606, y: FRAME_RENDER_HEIGHT - 26, color: "#ff5cff" },
    { x: 26, y: 212, color: "#6ff6ff" },
    { x: 26, y: 838, color: "#7eff73" },
    { x: FRAME_RENDER_WIDTH - 26, y: 212, color: "#ff5cff" },
    { x: FRAME_RENDER_WIDTH - 26, y: 838, color: "#ffae4f" },
  ];

  return (
    <>
      <defs>
        <linearGradient id={`${safeUid}_silverCable`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7b818b" />
          <stop offset="34%" stopColor="#d7dce3" />
          <stop offset="58%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#8b919d" />
        </linearGradient>
        <linearGradient id={`${safeUid}_silverCore`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.86" />
          <stop offset="100%" stopColor="#c8d0db" stopOpacity="0.24" />
        </linearGradient>
        <filter id={`${safeUid}_silverGlow`} x="-16%" y="-16%" width="132%" height="132%">
          <feGaussianBlur stdDeviation="2.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${safeUid}_neonGlow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect
        x="18"
        y="18"
        width="714"
        height="1014"
        rx="44"
        fill="none"
        stroke={`url(#${safeUid}_silverCable)`}
        strokeWidth="7"
        filter={`url(#${safeUid}_silverGlow)`}
      />
      <rect
        x="34"
        y="34"
        width="682"
        height="982"
        rx="36"
        fill="none"
        stroke={`url(#${safeUid}_silverCore)`}
        strokeWidth="2.4"
      />

      {CORNER_TRANSFORMS.map((corner) => (
        <g key={corner.key} transform={corner.transform}>
          <path
            d="M 0 84 C 0 34 34 0 84 0"
            fill="none"
            stroke="#dfe5ea"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M 8 94 C 16 48 48 16 94 8"
            fill="none"
            stroke="#7ef8ff"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeOpacity="0.72"
            filter={`url(#${safeUid}_neonGlow)`}
          />
        </g>
      ))}

      {neonNodes.map((node, index) => (
        <g key={`rare-node-${index}`} filter={`url(#${safeUid}_neonGlow)`}>
          <circle cx={node.x} cy={node.y} r="7" fill={node.color} fillOpacity="0.9" />
          <circle cx={node.x} cy={node.y} r="3" fill="#ffffff" fillOpacity="0.95" />
        </g>
      ))}

      {FRAME_SIDE_CONNECTORS.map((y) => (
        <g key={`rare-side-${y}`}>
          <rect x="14" y={y - 12} width="18" height="24" rx="6" fill="#757c87" stroke="#eef3f7" strokeWidth="1.7" />
          <rect x={FRAME_RENDER_WIDTH - 32} y={y - 12} width="18" height="24" rx="6" fill="#757c87" stroke="#eef3f7" strokeWidth="1.7" />
        </g>
      ))}
    </>
  );
}

function LegendaryFrame({ uid, frameSeed }: { uid: string; frameSeed: string }) {
  const safeUid = createFrameUid(uid, 40);
  const neonBands = [
    { colorA: "#ff4fd8", colorB: "#7effff", width: 2.4, dashOffset: seededVal(frameSeed, 100) * 36 },
    { colorA: "#7eff73", colorB: "#ffd84f", width: 2.1, dashOffset: seededVal(frameSeed, 101) * 36 },
    { colorA: "#5fa4ff", colorB: "#ff7d4f", width: 1.8, dashOffset: seededVal(frameSeed, 102) * 36 },
  ];

  return (
    <>
      <defs>
        <linearGradient id={`${safeUid}_goldCable`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8a5a00" />
          <stop offset="22%" stopColor="#f2c356" />
          <stop offset="50%" stopColor="#fff0ad" />
          <stop offset="78%" stopColor="#dca12e" />
          <stop offset="100%" stopColor="#8d5c02" />
        </linearGradient>
        <linearGradient id={`${safeUid}_goldCore`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6d1" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffc247" stopOpacity="0.28" />
        </linearGradient>
        <filter id={`${safeUid}_goldGlow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${safeUid}_legendNeonGlow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect
        x="18"
        y="18"
        width="714"
        height="1014"
        rx="46"
        fill="none"
        stroke={`url(#${safeUid}_goldCable)`}
        strokeWidth="8"
        strokeDasharray="10 12"
        filter={`url(#${safeUid}_goldGlow)`}
      />
      <rect
        x="18"
        y="18"
        width="714"
        height="1014"
        rx="46"
        fill="none"
        stroke="#8b5e00"
        strokeWidth="3"
        strokeDasharray="10 12"
        strokeDashoffset="11"
        strokeOpacity="0.78"
      />
      <rect
        x="34"
        y="34"
        width="682"
        height="982"
        rx="38"
        fill="none"
        stroke={`url(#${safeUid}_goldCore)`}
        strokeWidth="2.4"
      />

      {neonBands.map((band, index) => (
        <g key={`legend-band-${index}`} filter={`url(#${safeUid}_legendNeonGlow)`}>
          <linearGradient id={`${safeUid}_legendBand_${index}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={band.colorA} />
            <stop offset="100%" stopColor={band.colorB} />
          </linearGradient>
          <rect
            x={46 + index * 6}
            y={46 + index * 6}
            width={658 - index * 12}
            height={958 - index * 12}
            rx={32 - index * 2}
            fill="none"
            stroke={`url(#${safeUid}_legendBand_${index})`}
            strokeWidth={band.width}
            strokeOpacity="0.72"
            strokeDasharray="18 20"
            strokeDashoffset={band.dashOffset}
          />
        </g>
      ))}

      {CORNER_TRANSFORMS.map((corner) => (
        <g key={corner.key} transform={corner.transform}>
          <path
            d="M 0 92 C 0 38 38 0 92 0"
            fill="none"
            stroke="#f4c652"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M 6 100 C 18 52 52 18 100 6"
            fill="none"
            stroke="#fff1b3"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeOpacity="0.8"
          />
        </g>
      ))}

      {FRAME_TOP_CONNECTORS.map((x) => (
        <g key={`legend-top-${x}`} filter={`url(#${safeUid}_legendNeonGlow)`}>
          <rect x={x - 24} y="14" width="48" height="18" rx="7" fill="#8e6200" stroke="#ffd977" strokeWidth="1.8" />
          <circle cx={x} cy="23" r="4" fill="#ffffff" fillOpacity="0.9" />
          <circle cx={x} cy={FRAME_RENDER_HEIGHT - 23} r="4" fill="#ffffff" fillOpacity="0.9" />
          <rect x={x - 24} y={FRAME_RENDER_HEIGHT - 32} width="48" height="18" rx="7" fill="#8e6200" stroke="#ffd977" strokeWidth="1.8" />
        </g>
      ))}
    </>
  );
}

function CardFrameComponent({ width, height, rarity, frameSeed, uid }: FrameProps) {
  const scaleX = width / FRAME_RENDER_WIDTH;
  const scaleY = height / FRAME_RENDER_HEIGHT;

  return (
    <g transform={`scale(${scaleX} ${scaleY})`}>
      {rarity === "Punch Skater" && <PunchSkaterFrame uid={uid} frameSeed={frameSeed} />}
      {rarity === "Apprentice" && <ApprenticeFrame uid={uid} />}
      {rarity === "Master" && <MasterFrame uid={uid} />}
      {rarity === "Rare" && <RareFrame uid={uid} />}
      {rarity === "Legendary" && <LegendaryFrame uid={uid} frameSeed={frameSeed} />}
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
