import type { CardPayload } from "../lib/types";
import { getDisplayedArchetype } from "../lib/cardIdentity";

interface CardArtProps {
  card: CardPayload;
  width?: number;
  height?: number;
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

// LAYER 1 - Card Frame

interface FrameProps {
  width: number;
  height: number;
  rarity: string;
  frameSeed: string;
  uid: string;
}

function CardFrame({ width, height, rarity, frameSeed, uid }: FrameProps) {
  const w = width;
  const h = height;

  if (rarity === "Legendary") {
    // Cyberpunk neon-tube border — electric cyan outer tube, hot-pink inner tube,
    // corner circuit junction plates, seed-driven tick marks and glow nodes.
    const cr = 6; // corner radius for neon tubes
    const circuitTicks = Array.from({ length: 18 }, (_, i) => {
      const side   = i % 4;
      const pos    = 0.1 + seededVal(frameSeed, i * 7)     * 0.8;
      const tickLen= 3   + seededVal(frameSeed, i * 7 + 1) * 5;
      const isCyan = seededVal(frameSeed, i * 7 + 2) > 0.45;
      let x1: number, y1: number, x2: number, y2: number;
      if (side === 0)      { x1 = pos * w;  y1 = 1;     x2 = x1;           y2 = 1 + tickLen; }
      else if (side === 1) { x1 = w - 1;    y1 = pos * h; x2 = w - 1 - tickLen; y2 = y1; }
      else if (side === 2) { x1 = pos * w;  y1 = h - 1; x2 = x1;           y2 = h - 1 - tickLen; }
      else                 { x1 = 1;        y1 = pos * h; x2 = 1 + tickLen; y2 = y1; }
      return { x1, y1, x2, y2, color: isCyan ? "#00eeff" : "#ff00cc" };
    });
    const glowNodes = Array.from({ length: 10 }, (_, i) => {
      const side = i % 4;
      const pos  = 0.15 + seededVal(frameSeed, 200 + i * 4) * 0.7;
      const r    = 1.2  + seededVal(frameSeed, 200 + i * 4 + 1) * 2;
      const isCyan = seededVal(frameSeed, 200 + i * 4 + 2) > 0.5;
      let x: number, y: number;
      if (side === 0)      { x = pos * w; y = 2; }
      else if (side === 1) { x = w - 2;   y = pos * h; }
      else if (side === 2) { x = pos * w; y = h - 2; }
      else                 { x = 2;       y = pos * h; }
      return { x, y, r, color: isCyan ? "#00eeff" : "#ff44ff" };
    });
    return (
      <>
        <defs>
          <filter id={`${uid}_lgCyberGlow`} x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`${uid}_lgTightGlow`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Outer neon tube — electric cyan */}
        <rect x={1} y={1} width={w - 2} height={h - 2} rx={cr}
          fill="none" stroke="#00eeff" strokeWidth="2.5" strokeOpacity="0.95"
          filter={`url(#${uid}_lgCyberGlow)`} />
        {/* Inner tube — hot pink / magenta */}
        <rect x={5} y={5} width={w - 10} height={h - 10} rx={Math.max(1, cr - 3)}
          fill="none" stroke="#ff00cc" strokeWidth="1" strokeOpacity="0.85"
          filter={`url(#${uid}_lgTightGlow)`} />
        {/* Corner circuit junction plates */}
        {[
          { x: 1,      y: 1 },      { x: w - 12, y: 1 },
          { x: 1,      y: h - 12 }, { x: w - 12, y: h - 12 },
        ].map((c, i) => (
          <g key={i} filter={`url(#${uid}_lgTightGlow)`}>
            <rect x={c.x} y={c.y} width={11} height={11} rx={1}
              fill="none" stroke="#00eeff" strokeWidth="1.2" strokeOpacity="0.9" />
            <rect x={c.x + 3.5} y={c.y + 3.5} width={4} height={4}
              fill="#ff00cc" fillOpacity="0.85" />
          </g>
        ))}
        {/* Seed-driven circuit tick marks along the border */}
        {circuitTicks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.color} strokeWidth="0.9" strokeOpacity="0.9"
            filter={`url(#${uid}_lgTightGlow)`} />
        ))}
        {/* Neon glow nodes at circuit junctions */}
        {glowNodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={n.r}
            fill={n.color} fillOpacity="0.9"
            filter={`url(#${uid}_lgTightGlow)`} />
        ))}
      </>
    );
  }

  if (rarity === "Rare") {
    const gemCorners = [
      { x: 3, y: 3 }, { x: w - 9, y: 3 }, { x: 3, y: h - 9 }, { x: w - 9, y: h - 9 },
    ];
    return (
      <>
        <defs>
          <filter id={`${uid}_rareGlow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect x={1} y={1} width={w - 2} height={h - 2} rx={4}
          fill="none" stroke="#66aaff" strokeWidth="2" filter={`url(#${uid}_rareGlow)`} />
        <rect x={3} y={3} width={w - 6} height={h - 6} rx={3}
          fill="none" stroke="#4488ff" strokeWidth="0.8" strokeOpacity="0.6" />
        <rect x={5} y={5} width={w - 10} height={h - 10} rx={2}
          fill="none" stroke="#88aaff" strokeWidth="0.4" strokeOpacity="0.35" />
        {gemCorners.map((c, i) => (
          <polygon key={i}
            points={`${c.x + 3},${c.y} ${c.x + 6},${c.y + 2} ${c.x + 6},${c.y + 5} ${c.x + 3},${c.y + 6} ${c.x},${c.y + 5} ${c.x},${c.y + 2}`}
            fill="#4488ff" fillOpacity="0.4" stroke="#88ccff" strokeWidth="0.6" />
        ))}
        {Array.from({ length: 5 }, (_, i) => {
          const xPos = (i + 1) / 6 * w;
          return (
            <line key={i} x1={xPos} y1={1} x2={xPos} y2={4}
              stroke="#88ccff" strokeWidth="0.8"
              strokeOpacity={0.3 + seededVal(frameSeed, i) * 0.5} />
          );
        })}
      </>
    );
  }

  if (rarity === "Master") {
    return (
      <>
        <defs>
          <filter id={`${uid}_masterGlow`} x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect x={2} y={2} width={w - 4} height={h - 4} rx={4}
          fill="none" stroke="#cc44ff" strokeWidth="1.5" filter={`url(#${uid}_masterGlow)`} />
        <rect x={4.5} y={4.5} width={w - 9} height={h - 9} rx={3}
          fill="none" stroke="#dd88ff" strokeWidth="0.6" strokeOpacity="0.5" />
        {[{ x: 2, y: 2 }, { x: w - 8, y: 2 }, { x: 2, y: h - 8 }, { x: w - 8, y: h - 8 }].map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={6} height={6} rx={1}
            fill="#cc44ff" fillOpacity="0.3" stroke="#dd88ff" strokeWidth="0.7" />
        ))}
      </>
    );
  }

  if (rarity === "Apprentice") {
    return (
      <>
        <defs>
          <linearGradient id={`${uid}_appGrad`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#44ddaa" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#44aadd" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <rect x={2} y={2} width={w - 4} height={h - 4} rx={3}
          fill="none" stroke={`url(#${uid}_appGrad)`} strokeWidth="1.2" />
        {[{ cx: 6, cy: 6 }, { cx: w - 6, cy: 6 }, { cx: 6, cy: h - 6 }, { cx: w - 6, cy: h - 6 }].map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy} r={2.5}
            fill="none" stroke="#44ddaa" strokeWidth="0.8" strokeOpacity="0.6" />
        ))}
      </>
    );
  }

  if (rarity === "Punch Skater") {
    // Blood-spatter dots constrained to left/right side edges using frameSeed.
    const spatters = Array.from({ length: 24 }, (_, i) => {
      const side = seededVal(frameSeed, i * 6) > 0.5 ? 1 : 3;
      const pos  = seededVal(frameSeed, i * 6 + 1);
      const off  = seededVal(frameSeed, i * 6 + 2) * 16 + 1;
      const r    = 0.5 + seededVal(frameSeed, i * 6 + 3) * 3.2;
      const op   = 0.3  + seededVal(frameSeed, i * 6 + 4) * 0.6;
      const dark = seededVal(frameSeed, i * 6 + 5) > 0.55;
      let px: number, py: number;
      if (side === 1) { px = w - off; py = pos * h; }
      else            { px = off;     py = pos * h; }
      return { x: px, y: py, r, op, color: dark ? "#5a0808" : "#8b1a1a" };
    });
    // Two seeded, full-width wraps across top and bottom edges for the band-aid look.
    // Opacity is high (0.92–1.0) so the bandage obscures the background like a real
    // bandage wrapped around a playing card.
    const edgeWraps = [
      {
        cy: 1.8,
        ang: (seededVal(frameSeed, 400) - 0.5) * 6,
        thickness: 4.2 + seededVal(frameSeed, 401) * 1.8,
        opacity: 0.92 + seededVal(frameSeed, 402) * 0.08,
      },
      {
        cy: h - 1.8,
        ang: (seededVal(frameSeed, 410) - 0.5) * 6,
        thickness: 4.2 + seededVal(frameSeed, 411) * 1.8,
        opacity: 0.92 + seededVal(frameSeed, 412) * 0.08,
      },
    ];
    const FRAY_LEFT_BASE_X = -2;
    const FRAY_RIGHT_BASE_X = w - 3;
    const FRAY_X_JITTER = 5;
    const FRAY_TOP_BASE_Y = 2;
    const FRAY_BOTTOM_BASE_Y = h - 2;
    const FRAY_Y_JITTER = 3.5;
    const FRAY_MIN_LENGTH = 2.5;
    const FRAY_LENGTH_RANGE = 3;
    const FRAY_LEFT_X_DIRECTION = -1;
    const FRAY_RIGHT_X_DIRECTION = 1;
    const FRAY_TOP_Y_DIRECTION = -1;
    const FRAY_BOTTOM_Y_DIRECTION = 1;
    const frays = Array.from({ length: 8 }, (_, i) => {
      const isTop = i < 4;
      const side = i % 2 === 0 ? "left" : "right";
      const baseY = isTop ? FRAY_TOP_BASE_Y : FRAY_BOTTOM_BASE_Y;
      const x = side === "left"
        ? FRAY_LEFT_BASE_X + seededVal(frameSeed, 500 + i * 3) * FRAY_X_JITTER
        : FRAY_RIGHT_BASE_X + seededVal(frameSeed, 500 + i * 3) * FRAY_X_JITTER;
      const y = baseY + (seededVal(frameSeed, 501 + i * 3) - 0.5) * FRAY_Y_JITTER;
      const len = FRAY_MIN_LENGTH + seededVal(frameSeed, 502 + i * 3) * FRAY_LENGTH_RANGE;
      const xDirection = side === "left" ? FRAY_LEFT_X_DIRECTION : FRAY_RIGHT_X_DIRECTION;
      const yDirection = isTop ? FRAY_TOP_Y_DIRECTION : FRAY_BOTTOM_Y_DIRECTION;
      return { x, y, len, xDirection, yDirection };
    });
    return (
      <>
        <rect x={0.6} y={0.6} width={w - 1.2} height={h - 1.2} rx={1.2}
          fill="none" stroke="#c8b89a" strokeWidth="1.1" strokeOpacity="0.78" />
        {edgeWraps.map((b, i) => (
          <rect key={i}
            x={-1.5} y={b.cy - b.thickness / 2}
            width={w + 3} height={b.thickness} rx={1}
            fill="#e8d8b0" fillOpacity={b.opacity}
            stroke="#c8b89a" strokeWidth="0.5"
            transform={`rotate(${b.ang},${w / 2},${b.cy})`} />
        ))}
        {frays.map((f, i) => (
          <line
            key={`fray-${i}`}
            x1={f.x}
            y1={f.y}
            x2={f.x + f.len * f.xDirection}
            y2={f.y + f.yDirection}
            stroke="#d8c8a1"
            strokeOpacity="0.45"
            strokeWidth="0.5"
            strokeLinecap="round"
          />
        ))}
        {spatters.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r}
            fill={s.color} fillOpacity={s.op} />
        ))}
      </>
    );
  }

  return null;
}

// LAYER 2 - Background

interface BackgroundProps {
  width: number;
  height: number;
  district: string;
  backgroundSeed: string;
  uid: string;
}

function AirawayBackground({ width: w, height: h, backgroundSeed: seed, uid }: BackgroundProps) {
  const horizon = h * 0.52;
  const clouds = Array.from({ length: 8 }, (_, i) => ({
    cx: seededVal(seed, i * 4)     * w,
    cy: seededVal(seed, i * 4 + 1) * horizon * 0.9 + h * 0.05,
    rx: 14 + seededVal(seed, i * 4 + 2) * 20,
    ry: 6  + seededVal(seed, i * 4 + 3) * 8,
  }));
  const floatingBuildings = [
    { x: 10, y: horizon - 55, w: 20, h: 40 },
    { x: 50, y: horizon - 70, w: 30, h: 55 },
    { x: 105, y: horizon - 60, w: 25, h: 45 },
    { x: 160, y: horizon - 65, w: 28, h: 50 },
  ];
  const birds = Array.from({ length: 6 }, (_, i) => ({
    x: seededVal(seed, 200 + i * 2) * w,
    y: seededVal(seed, 201 + i * 2) * horizon * 0.6 + h * 0.04,
  }));
  return (
    <>
      <defs>
        <linearGradient id={`${uid}_airSky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#87ceeb" />
          <stop offset="60%"  stopColor="#b0e0f8" />
          <stop offset="100%" stopColor="#d4f1ff" />
        </linearGradient>
        <linearGradient id={`${uid}_airGround`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#e8f8ff" />
          <stop offset="100%" stopColor="#c8eeff" />
        </linearGradient>
        <filter id={`${uid}_softGlow`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width={w} height={h} fill={`url(#${uid}_airSky)`} />
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <line key={i}
            x1={w * 0.75} y1={h * 0.12}
            x2={w * 0.75 + Math.cos(angle) * 18} y2={h * 0.12 + Math.sin(angle) * 18}
            stroke="#ffe066" strokeWidth="0.6" strokeOpacity="0.35" />
        );
      })}
      <circle cx={w * 0.75} cy={h * 0.12} r={7} fill="#ffe066" fillOpacity="0.85"
        filter={`url(#${uid}_softGlow)`} />
      {clouds.map((c, i) => (
        <ellipse key={i} cx={c.cx} cy={c.cy} rx={c.rx} ry={c.ry}
          fill="white" fillOpacity={0.55 + seededVal(seed, 100 + i) * 0.3} />
      ))}
      {floatingBuildings.map((b, i) => (
        <g key={i}>
          <ellipse cx={b.x + b.w / 2} cy={b.y + b.h + 4} rx={b.w * 0.8} ry={5}
            fill="white" fillOpacity="0.7" />
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={2}
            fill="#d8eeff" stroke="#8bbfdd" strokeWidth="0.8" strokeOpacity="0.7" />
          {Array.from({ length: Math.floor(b.h / 10) }, (_, wi) => (
            <rect key={wi} x={b.x + 4} y={b.y + 5 + wi * 10} width={4} height={3} rx={0.5}
              fill="#aaddff"
              fillOpacity={seededVal(seed, i * 30 + wi + 300) > 0.4 ? 0.8 : 0.15} />
          ))}
          {i < floatingBuildings.length - 1 && (
            <line x1={b.x + b.w} y1={b.y + 10}
              x2={floatingBuildings[i + 1].x} y2={floatingBuildings[i + 1].y + 10}
              stroke="#8bbfdd" strokeWidth="0.5" strokeOpacity="0.5" strokeDasharray="2,2" />
          )}
        </g>
      ))}
      <rect x={0} y={horizon} width={w} height={h - horizon} fill={`url(#${uid}_airGround)`} />
      {Array.from({ length: 5 }, (_, i) => (
        <ellipse key={i}
          cx={(i + 0.5) / 5 * w + seededVal(seed, 500 + i) * 10} cy={horizon + 4}
          rx={20 + seededVal(seed, 510 + i) * 15} ry={8}
          fill="white" fillOpacity={0.55 + seededVal(seed, 520 + i) * 0.3} />
      ))}
      {birds.map((b, i) => (
        <g key={i} transform={`translate(${b.x},${b.y})`}>
          <path d="M0,0 Q2,-2 4,0 Q6,-2 8,0"
            fill="none" stroke="#446688" strokeWidth="0.7" strokeOpacity="0.6" />
        </g>
      ))}
    </>
  );
}

function NightshadeBackground({ width: w, height: h, backgroundSeed: seed, uid }: BackgroundProps) {
  const horizon = h * 0.55;
  const midBuildings = [
    { x: 5, w: 25, h: 70 }, { x: 55, w: 30, h: 85 },
    { x: 110, w: 28, h: 75 }, { x: 168, w: 32, h: 80 },
  ];
  const fgBuildings = [
    { x: 0, w: 30, h: 80 }, { x: 28, w: 20, h: 60 }, { x: 46, w: 35, h: 100 },
    { x: 79, w: 25, h: 70 }, { x: 102, w: 40, h: 90 }, { x: 140, w: 22, h: 55 },
    { x: 160, w: 38, h: 95 },
  ];
  const stars = Array.from({ length: 14 }, (_, i) => ({
    x: seededVal(seed, i * 3) * w, y: seededVal(seed, i * 3 + 1) * horizon * 0.7,
    r: seededVal(seed, i * 3 + 2) > 0.7 ? 1.2 : 0.6,
  }));
  const rain = Array.from({ length: 10 }, (_, i) => ({
    x: seededVal(seed, 100 + i * 2) * w, y: seededVal(seed, 100 + i * 2 + 1) * horizon,
    len: 4 + seededVal(seed, 200 + i) * 6,
  }));
  const moonX = w * (0.75 + seededVal(seed, 300) * 0.15);
  const moonY = h  * (0.05 + seededVal(seed, 301) * 0.08);
  return (
    <>
      <defs>
        <linearGradient id={`${uid}_nsSky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#020208" />
          <stop offset="55%"  stopColor="#070718" />
          <stop offset="100%" stopColor="#0d0d2f" />
        </linearGradient>
        <linearGradient id={`${uid}_nsGlow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#ff00aa" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ff00aa" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}_nsGround`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#0a0a18" />
          <stop offset="100%" stopColor="#050510" />
        </linearGradient>
        <filter id={`${uid}_nsGrain`} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
          <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blended" />
          <feComposite in="blended" in2="SourceGraphic" operator="in" />
        </filter>
        <pattern id={`${uid}_nsScan`} x="0" y="0" width={w} height="2" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width={w} height="1" fill="black" fillOpacity="0.08" />
          <rect x="0" y="1" width={w} height="1" fill="black" fillOpacity="0" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill={`url(#${uid}_nsSky)`} />
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white"
          fillOpacity={0.4 + seededVal(seed, 400 + i) * 0.5} />
      ))}
      <circle cx={moonX} cy={moonY} r={5} fill="#d0d8f0" fillOpacity="0.6" />
      <circle cx={moonX + 2} cy={moonY - 1} r={4} fill="#0d0d2f" fillOpacity="0.75" />
      {rain.map((r, i) => (
        <line key={i} x1={r.x} y1={r.y} x2={r.x + 1} y2={r.y + r.len}
          stroke="white" strokeWidth="0.4"
          strokeOpacity={0.08 + seededVal(seed, 500 + i) * 0.1} />
      ))}
      <rect x={0} y={horizon * 0.8} width={w} height={h * 0.2} fill={`url(#${uid}_nsGlow)`} />
      {midBuildings.map((b, i) => (
        <g key={`ns-mg-${i}`}>
          <rect x={b.x} y={horizon - b.h} width={b.w} height={b.h}
            fill="#0c0c1e" stroke="#ff00aa" strokeWidth="0.75" strokeOpacity="0.5" />
          {Array.from({ length: Math.floor(b.h / 10) }, (_, wi) => (
            <rect key={wi} x={b.x + 4} y={horizon - b.h + 6 + wi * 10} width={5} height={3}
              fill="#ff00aa"
              fillOpacity={seededVal(seed, i * 50 + wi) > 0.45 ? 0.75 : 0.07} />
          ))}
          {seededVal(seed, 600 + i) > 0.5 && (
            <rect x={b.x + 3} y={horizon - b.h - 6} width={b.w - 6} height={5} rx={1}
              fill="#ff00aa" fillOpacity="0.3" stroke="#ff00aa" strokeWidth="0.5" />
          )}
          {b.h > 70 && (
            <>
              <line x1={b.x + b.w / 2} y1={horizon - b.h} x2={b.x + b.w / 2} y2={horizon - b.h - 10}
                stroke="#666" strokeWidth="0.75" />
              <circle cx={b.x + b.w / 2} cy={horizon - b.h - 11} r={1.5}
                fill="#ff2222" fillOpacity="0.9" />
            </>
          )}
        </g>
      ))}
      {fgBuildings.map((b, i) => (
        <g key={`ns-fg-${i}`}>
          <rect x={b.x} y={horizon - b.h} width={b.w} height={b.h}
            fill="#0d0d1a" stroke="#ff00aa" strokeWidth="0.5" strokeOpacity="0.6" />
          {Array.from({ length: Math.floor(b.h / 12) }, (_, wi) => (
            <rect key={wi} x={b.x + 4} y={horizon - b.h + 8 + wi * 12} width={4} height={3}
              fill="#ff00aa"
              fillOpacity={seededVal(seed, i * 80 + wi + 1000) > 0.4 ? 0.8 : 0.08} />
          ))}
          {b.h >= 90 && (
            <>
              <line x1={b.x + b.w / 2} y1={horizon - b.h} x2={b.x + b.w / 2} y2={horizon - b.h - 8}
                stroke="#555" strokeWidth="0.6" />
              <circle cx={b.x + b.w / 2} cy={horizon - b.h - 9} r={1.2}
                fill="#ff3333" fillOpacity="0.85" />
            </>
          )}
        </g>
      ))}
      <rect x={0} y={horizon} width={w} height={h - horizon} fill={`url(#${uid}_nsGround)`} />
      {[0.18, 0.38, 0.62, 0.82].map((t, i) => (
        <line key={i} x1={t * w} y1={h} x2={w / 2} y2={horizon}
          stroke="#ff00aa" strokeWidth="0.5" strokeOpacity={0.15 + i * 0.05} />
      ))}
      <line x1={0} y1={h * 0.72} x2={w} y2={h * 0.72}
        stroke="#ff00aa" strokeWidth="0.5" strokeOpacity="0.25" />
      <line x1={0} y1={h * 0.85} x2={w} y2={h * 0.85}
        stroke="#ff00aa" strokeWidth="0.4" strokeOpacity="0.15" />
      {fgBuildings.slice(0, 4).map((b, i) =>
        Array.from({ length: Math.min(2, Math.floor(b.h / 12)) }, (_, wi) =>
          seededVal(seed, i * 80 + wi + 1000) > 0.4 ? (
            <circle key={`ns-ref-${i}-${wi}`} cx={b.x + 6} cy={horizon + (wi + 1) * 8} r={2}
              fill="#ff00aa" fillOpacity={0.12 - wi * 0.03} />
          ) : null
        )
      )}
      <rect width={w} height={h} fill={`url(#${uid}_nsScan)`} />
      <rect width={w} height={h} fill="transparent" filter={`url(#${uid}_nsGrain)`} opacity="0.06" />
    </>
  );
}

function BatteryvilleBackground({ width: w, height: h, backgroundSeed: seed, uid }: BackgroundProps) {
  const horizon = h * 0.5;
  const stars = Array.from({ length: 18 }, (_, i) => ({
    x: seededVal(seed, i * 3) * w, y: seededVal(seed, i * 3 + 1) * horizon * 0.85,
    r: seededVal(seed, i * 3 + 2) > 0.65 ? 1.4 : 0.7,
    op: 0.4 + seededVal(seed, 100 + i) * 0.55,
  }));
  const panels = Array.from({ length: 6 }, (_, i) => ({
    x: 10 + i * 28 + seededVal(seed, 200 + i) * 8,
    y: horizon + 15 + seededVal(seed, 210 + i) * 10,
  }));
  const turbines = [
    { x: w * 0.18, topY: horizon - 35 },
    { x: w * 0.55, topY: horizon - 45 },
    { x: w * 0.85, topY: horizon - 38 },
  ];
  const cabins = [
    { x: 20, y: horizon - 14, w: 24, h: 14 },
    { x: 80, y: horizon - 18, w: 30, h: 18 },
    { x: 145, y: horizon - 12, w: 22, h: 12 },
  ];
  return (
    <>
      <defs>
        <linearGradient id={`${uid}_bvSky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#0a0a1e" />
          <stop offset="50%"  stopColor="#1a0e2a" />
          <stop offset="100%" stopColor="#2a1a0a" />
        </linearGradient>
        <linearGradient id={`${uid}_bvGround`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#3a2a0a" />
          <stop offset="100%" stopColor="#2a1a05" />
        </linearGradient>
        <linearGradient id={`${uid}_bvHorizon`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#ff6600" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff6600" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${uid}_bvSky)`} />
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" fillOpacity={s.op} />
      ))}
      <circle cx={w * 0.2} cy={h * 0.1} r={6} fill="#e8e0c8" fillOpacity="0.7" />
      <circle cx={w * 0.2 + 2.5} cy={h * 0.1 - 1} r={4.5} fill="#0a0a1e" fillOpacity="0.8" />
      <rect x={0} y={horizon * 0.75} width={w} height={h * 0.25} fill={`url(#${uid}_bvHorizon)`} />
      {turbines.map((t, i) => (
        <g key={i}>
          <line x1={t.x} y1={horizon} x2={t.x} y2={t.topY} stroke="#887744" strokeWidth="1.5" />
          {[0, 120, 240].map((deg, bi) => {
            const rad = (deg + seededVal(seed, 300 + i * 3 + bi) * 30) * Math.PI / 180;
            return (
              <line key={bi} x1={t.x} y1={t.topY}
                x2={t.x + Math.cos(rad) * 12} y2={t.topY + Math.sin(rad) * 12}
                stroke="#aaaaaa" strokeWidth="1" strokeOpacity="0.75" />
            );
          })}
          <circle cx={t.x} cy={t.topY} r={2} fill="#cccccc" fillOpacity="0.8" />
        </g>
      ))}
      {cabins.map((c, i) => (
        <g key={i}>
          <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={1}
            fill="#4a3010" stroke="#887744" strokeWidth="0.7" strokeOpacity="0.8" />
          <polygon
            points={`${c.x - 2},${c.y} ${c.x + c.w / 2},${c.y - c.h * 0.6} ${c.x + c.w + 2},${c.y}`}
            fill="#5a3818" stroke="#887744" strokeWidth="0.6" strokeOpacity="0.7" />
          <rect x={c.x + c.w * 0.3} y={c.y + 3} width={c.w * 0.3} height={c.h * 0.4} rx={1}
            fill="#ffcc44" fillOpacity={seededVal(seed, 400 + i) > 0.3 ? 0.5 : 0.05} />
        </g>
      ))}
      <rect x={0} y={horizon} width={w} height={h - horizon} fill={`url(#${uid}_bvGround)`} />
      {panels.map((p, i) => (
        <g key={i}>
          <rect x={p.x} y={p.y} width={16} height={8} rx={1}
            fill="#223344" stroke="#44aacc" strokeWidth="0.6"
            transform={`rotate(-15,${p.x + 8},${p.y + 4})`} />
          <line x1={p.x + 8} y1={p.y} x2={p.x + 8} y2={p.y + 8}
            stroke="#44aacc" strokeWidth="0.3" strokeOpacity="0.5"
            transform={`rotate(-15,${p.x + 8},${p.y + 4})`} />
          <line x1={p.x + 8} y1={p.y + 5} x2={p.x + 8} y2={p.y + 13}
            stroke="#887744" strokeWidth="0.8" />
        </g>
      ))}
      <circle cx={w * 0.5} cy={horizon + 8} r={4} fill="#ff6600" fillOpacity="0.25" />
      <circle cx={w * 0.5} cy={horizon + 8} r={2} fill="#ffaa00" fillOpacity="0.5" />
    </>
  );
}

function CardBackground(props: BackgroundProps) {
  if (props.district === "Airaway")      return <AirawayBackground {...props} />;
  if (props.district === "Batteryville") return <BatteryvilleBackground {...props} />;
  return <NightshadeBackground {...props} />;
}

// LAYER 3 - Character

interface CharacterProps {
  cx: number;
  cy: number;
  accentColor: string;
  archetype: string;
  style: string;
  vibe: string;
  storagePackStyle: string;
  characterSeed: string;
}

function CharacterHead({ cx, cy, accentColor, archetype }: {
  cx: number; cy: number; accentColor: string; archetype: string;
}) {
  const baseHead = (
    <circle cx={cx} cy={cy - 18} r={11} fill="#1e1e3a" stroke={accentColor} strokeWidth="1.5" />
  );

  if (archetype === "The Knights Technarchy") {
    return (
      <>
        {baseHead}
        <path d={`M${cx - 11},${cy - 18} A11,11 0 0,1 ${cx + 11},${cy - 18}`}
          fill="#0a0a1a" fillOpacity="0.85" stroke={accentColor} strokeWidth="1" />
        <rect x={cx - 9} y={cy - 25} width={18} height={9} rx={3}
          fill="#0a0a1a" stroke={accentColor} strokeWidth="0.8" />
        <rect x={cx - 7} y={cy - 21} width={14} height={2.5} rx={1}
          fill={accentColor} fillOpacity="0.6" />
        <line x1={cx - 9} y1={cy - 25} x2={cx + 9} y2={cy - 25}
          stroke={accentColor} strokeWidth="0.6" strokeOpacity="0.5" />
      </>
    );
  }

  if (archetype === "Qu111s") {
    return (
      <>
        {baseHead}
        {[-3, 0, 3].map((dx, i) => (
          <rect key={i} x={cx + dx - 1.5} y={cy - 33 + i} width={3} height={16 - i * 2} rx={1.5}
            fill={i === 1 ? accentColor : "#ff2244"} fillOpacity={0.9 - i * 0.15} />
        ))}
        {[-8, -4, 0, 4, 8].map((dx, i) => (
          <polygon key={i}
            points={`${cx + dx},${cy - 8} ${cx + dx - 2},${cy - 4} ${cx + dx + 2},${cy - 4}`}
            fill="#333" stroke={accentColor} strokeWidth="0.5" />
        ))}
        <rect x={cx - 9} y={cy - 22} width={8} height={5} rx={2}
          fill={accentColor} fillOpacity="0.5" stroke={accentColor} strokeWidth="0.8" />
        <rect x={cx + 1} y={cy - 22} width={8} height={5} rx={2}
          fill={accentColor} fillOpacity="0.5" stroke={accentColor} strokeWidth="0.8" />
        <line x1={cx - 1} y1={cy - 20} x2={cx + 1} y2={cy - 20}
          stroke={accentColor} strokeWidth="0.8" />
      </>
    );
  }

  if (archetype === "Iron Curtains") {
    return (
      <>
        {baseHead}
        <path d={`M${cx - 10},${cy - 24} Q${cx},${cy - 32} ${cx + 12},${cy - 22}`}
          fill="#4a5a2a" stroke="#6a7a3a" strokeWidth="0.8" />
        <rect x={cx - 7} y={cy - 12} width={14} height={4} rx={2}
          fill="#2a1a0a" fillOpacity="0.4" />
        <path d={`M${cx - 5},${cy - 7} Q${cx},${cy - 5} ${cx + 5},${cy - 7}`}
          fill="none" stroke={accentColor} strokeWidth="0.7" strokeOpacity="0.6" />
        <rect x={cx - 7} y={cy - 21} width={4} height={2.5} rx={1}
          fill={accentColor} fillOpacity="0.55" />
        <rect x={cx + 3} y={cy - 21} width={4} height={2.5} rx={1}
          fill={accentColor} fillOpacity="0.55" />
      </>
    );
  }

  if (archetype === "D4rk $pider") {
    return (
      <>
        {baseHead}
        {[-6, -2, 2, 6].map((dx, i) => (
          <path key={i}
            d={`M${cx + dx},${cy - 28} Q${cx + dx + 2},${cy - 33} ${cx + dx + 4},${cy - 28}`}
            fill="#333355" stroke={accentColor} strokeWidth="0.5" strokeOpacity="0.4" />
        ))}
        <rect x={cx - 11} y={cy - 24} width={22} height={9} rx={3}
          fill="#111133" stroke={accentColor} strokeWidth="1" />
        <circle cx={cx - 5} cy={cy - 20} r={3.5}
          fill={accentColor} fillOpacity="0.3" stroke={accentColor} strokeWidth="0.8" />
        <circle cx={cx + 5} cy={cy - 20} r={3.5}
          fill={accentColor} fillOpacity="0.3" stroke={accentColor} strokeWidth="0.8" />
        <line x1={cx - 11} y1={cy - 27} x2={cx + 11} y2={cy - 27}
          stroke={accentColor} strokeWidth="1" strokeOpacity="0.5" />
        <line x1={cx + 9} y1={cy - 27} x2={cx + 12} y2={cy - 32}
          stroke={accentColor} strokeWidth="0.7" />
        <circle cx={cx + 12} cy={cy - 32} r={1} fill={accentColor} fillOpacity="0.8" />
      </>
    );
  }

  if (archetype === "The Asclepians") {
    return (
      <>
        {baseHead}
        <rect x={cx - 8} y={cy - 36} width={16} height={14} rx={4}
          fill="#f0f0f0" fillOpacity="0.85" stroke="#cccccc" strokeWidth="0.8" />
        <ellipse cx={cx} cy={cy - 36} rx={9} ry={5} fill="#f8f8f8" fillOpacity="0.9" />
        <rect x={cx - 10} y={cy - 24} width={20} height={5} rx={1}
          fill={accentColor} fillOpacity="0.55" stroke={accentColor} strokeWidth="0.6" />
        <circle cx={cx + 10} cy={cy - 22} r={2.5} fill={accentColor} fillOpacity="0.5" />
        <rect x={cx - 7} y={cy - 21} width={4} height={3} rx={1}
          fill={accentColor} fillOpacity="0.6" />
        <rect x={cx + 3} y={cy - 21} width={4} height={3} rx={1}
          fill={accentColor} fillOpacity="0.6" />
      </>
    );
  }

  if (archetype === "The Mesopotamian Society") {
    return (
      <>
        {baseHead}
        <path d={`M${cx - 12},${cy - 22} Q${cx},${cy - 34} ${cx + 12},${cy - 22}`}
          fill="#8b6914" stroke="#c8970a" strokeWidth="0.8" />
        <rect x={cx - 9} y={cy - 24} width={18} height={4} rx={1}
          fill="#6b4f10" stroke="#c8970a" strokeWidth="0.6" />
        <circle cx={cx - 6} cy={cy - 20} r={2.5}
          fill={accentColor} fillOpacity="0.45" stroke={accentColor} strokeWidth="0.6" />
        <circle cx={cx + 6} cy={cy - 20} r={2.5}
          fill={accentColor} fillOpacity="0.45" stroke={accentColor} strokeWidth="0.6" />
      </>
    );
  }

  if (archetype === "Hermes' Squirmies") {
    return (
      <>
        {baseHead}
        <rect x={cx - 10} y={cy - 28} width={20} height={10} rx={3}
          fill="#ff8800" fillOpacity="0.8" stroke="#ffaa00" strokeWidth="0.8" />
        <rect x={cx - 8} y={cy - 22} width={16} height={3} rx={1}
          fill="#ffaa00" fillOpacity="0.5" />
        <circle cx={cx - 6} cy={cy - 21} r={2} fill={accentColor} fillOpacity="0.6" />
        <circle cx={cx + 6} cy={cy - 21} r={2} fill={accentColor} fillOpacity="0.6" />
      </>
    );
  }

  if (archetype === "UCPS") {
    return (
      <>
        {baseHead}
        <path d={`M${cx - 12},${cy - 20} Q${cx},${cy - 30} ${cx + 12},${cy - 20}`}
          fill="#224488" stroke="#4466cc" strokeWidth="0.8" />
        <rect x={cx - 8} y={cy - 23} width={16} height={3} rx={1}
          fill="#4466cc" fillOpacity="0.5" />
        <rect x={cx - 6} y={cy - 21} width={4} height={2.5} rx={1}
          fill={accentColor} fillOpacity="0.55" />
        <rect x={cx + 2} y={cy - 21} width={4} height={2.5} rx={1}
          fill={accentColor} fillOpacity="0.55" />
      </>
    );
  }

  if (archetype === "The Team") {
    return (
      <>
        {baseHead}
        <rect x={cx - 10} y={cy - 30} width={20} height={12} rx={4}
          fill={accentColor} fillOpacity="0.5" stroke={accentColor} strokeWidth="0.9" />
        <ellipse cx={cx} cy={cy - 30} rx={9} ry={4}
          fill={accentColor} fillOpacity="0.35" />
        <circle cx={cx - 5} cy={cy - 21} r={2.5}
          fill={accentColor} fillOpacity="0.4" stroke={accentColor} strokeWidth="0.7" />
        <circle cx={cx + 5} cy={cy - 21} r={2.5}
          fill={accentColor} fillOpacity="0.4" stroke={accentColor} strokeWidth="0.7" />
      </>
    );
  }

  return baseHead;
}

function CharacterBody({ cx, cy, accentColor, style }: {
  cx: number; cy: number; accentColor: string; style: string;
}) {
  if (style === "Corporate") {
    return (
      <>
        <rect x={cx - 12} y={cy - 10} width={24} height={30} rx={3}
          fill="#1a1a2e" stroke={accentColor} strokeWidth="1" />
        <polygon points={`${cx},${cy - 10} ${cx - 8},${cy} ${cx},${cy - 2}`}
          fill="#111122" stroke={accentColor} strokeWidth="0.6" strokeOpacity="0.7" />
        <polygon points={`${cx},${cy - 10} ${cx + 8},${cy} ${cx},${cy - 2}`}
          fill="#111122" stroke={accentColor} strokeWidth="0.6" strokeOpacity="0.7" />
        <polygon points={`${cx - 2},${cy - 8} ${cx + 2},${cy - 8} ${cx + 1},${cy + 10} ${cx - 1},${cy + 10}`}
          fill={accentColor} fillOpacity="0.7" />
        <rect x={cx - 4} y={cy - 10} width={8} height={4} rx={1}
          fill="#e8e8e8" fillOpacity="0.6" />
        <rect x={cx - 16} y={cy - 10} width={8} height={6} rx={2}
          fill="#1a1a2e" stroke={accentColor} strokeWidth="0.8" />
        <rect x={cx + 8}  y={cy - 10} width={8} height={6} rx={2}
          fill="#1a1a2e" stroke={accentColor} strokeWidth="0.8" />
      </>
    );
  }
  if (style === "Street") {
    return (
      <>
        <rect x={cx - 13} y={cy - 10} width={26} height={30} rx={5}
          fill="#222244" stroke={accentColor} strokeWidth="1" />
        <path d={`M${cx - 10},${cy - 10} Q${cx},${cy - 18} ${cx + 10},${cy - 10}`}
          fill="#2a2a55" stroke={accentColor} strokeWidth="0.8" strokeOpacity="0.6" />
        <rect x={cx - 8} y={cy + 8} width={16} height={8} rx={2}
          fill="#1a1a33" stroke={accentColor} strokeWidth="0.5" strokeOpacity="0.5" />
        <rect x={cx - 10} y={cy + 18} width={8} height={14} rx={2} fill="#1a1a3a" />
        <rect x={cx + 2}  y={cy + 18} width={8} height={14} rx={2} fill="#1a1a3a" />
        <line x1={cx - 9} y1={cy + 22} x2={cx - 4} y2={cy + 22}
          stroke={accentColor} strokeWidth="0.6" strokeOpacity="0.4" />
        <line x1={cx + 3} y1={cy + 25} x2={cx + 8} y2={cy + 25}
          stroke={accentColor} strokeWidth="0.6" strokeOpacity="0.4" />
      </>
    );
  }
  if (style === "Off-grid") {
    return (
      <>
        <rect x={cx - 12} y={cy - 10} width={24} height={28} rx={3}
          fill="#3a3010" stroke={accentColor} strokeWidth="1" />
        <rect x={cx - 10} y={cy - 4} width={7} height={6} rx={1}
          fill="#2a2208" stroke={accentColor} strokeWidth="0.5" strokeOpacity="0.7" />
        <rect x={cx + 3} y={cy - 4} width={7} height={6} rx={1}
          fill="#2a2208" stroke={accentColor} strokeWidth="0.5" strokeOpacity="0.7" />
        <line x1={cx - 12} y1={cy + 5} x2={cx + 12} y2={cy + 5}
          stroke={accentColor} strokeWidth="0.8" strokeOpacity="0.5" />
        <rect x={cx - 11} y={cy + 18} width={9} height={14} rx={2} fill="#3a3010" />
        <rect x={cx + 2}  y={cy + 18} width={9} height={14} rx={2} fill="#3a3010" />
        <rect x={cx - 11} y={cy + 22} width={7} height={5} rx={1}
          fill="#2a2208" stroke={accentColor} strokeWidth="0.4" strokeOpacity="0.5" />
      </>
    );
  }
  if (style === "Union") {
    return (
      <>
        <rect x={cx - 12} y={cy - 10} width={24} height={28} rx={3}
          fill="#ff8800" fillOpacity="0.75" stroke={accentColor} strokeWidth="1" />
        <line x1={cx - 12} y1={cy}     x2={cx + 12} y2={cy}
          stroke="#ffff88" strokeWidth="2" strokeOpacity="0.6" />
        <line x1={cx - 12} y1={cy + 8} x2={cx + 12} y2={cy + 8}
          stroke="#ffff88" strokeWidth="2" strokeOpacity="0.6" />
        <rect x={cx - 10} y={cy - 10} width={20} height={18} rx={2}
          fill="#2255aa" fillOpacity="0.4" />
        <rect x={cx - 9} y={cy - 8} width={8} height={6} rx={1}
          fill="#222255" stroke={accentColor} strokeWidth="0.5" strokeOpacity="0.7" />
        <rect x={cx - 10} y={cy + 18} width={8} height={14} rx={2} fill="#333355" />
        <rect x={cx + 2}  y={cy + 18} width={8} height={14} rx={2} fill="#333355" />
      </>
    );
  }
  if (style === "Olympic") {
    return (
      <>
        <rect x={cx - 13} y={cy - 10} width={26} height={30} rx={4}
          fill={accentColor} fillOpacity="0.4" stroke={accentColor} strokeWidth="1.2" />
        <rect x={cx - 11} y={cy - 8} width={22} height={4} rx={1}
          fill={accentColor} fillOpacity="0.6" />
        <rect x={cx - 10} y={cy + 8} width={20} height={5} rx={2}
          fill={accentColor} fillOpacity="0.3" stroke={accentColor} strokeWidth="0.5" />
        <circle cx={cx - 4} cy={cy - 4} r={2.5} fill={accentColor} fillOpacity="0.7" />
        <circle cx={cx + 4} cy={cy - 4} r={2.5} fill={accentColor} fillOpacity="0.7" />
        <rect x={cx - 16} y={cy - 10} width={8} height={6} rx={2}
          fill={accentColor} fillOpacity="0.5" stroke={accentColor} strokeWidth="0.8" />
        <rect x={cx + 8}  y={cy - 10} width={8} height={6} rx={2}
          fill={accentColor} fillOpacity="0.5" stroke={accentColor} strokeWidth="0.8" />
        <rect x={cx - 10} y={cy + 18} width={8} height={14} rx={2} fill="#1a1a2e" />
        <rect x={cx + 2}  y={cy + 18} width={8} height={14} rx={2} fill="#1a1a2e" />
      </>
    );
  }
  if (style === "Ninja") {
    return (
      <>
        <rect x={cx - 11} y={cy - 10} width={22} height={30} rx={3}
          fill="#0a0a1a" stroke={accentColor} strokeWidth="0.8" />
        <line x1={cx - 11} y1={cy + 5} x2={cx + 11} y2={cy + 5}
          stroke={accentColor} strokeWidth="0.5" strokeOpacity="0.4" />
        <rect x={cx - 14} y={cy - 10} width={7} height={5} rx={2}
          fill="#0a0a1a" stroke={accentColor} strokeWidth="0.6" />
        <rect x={cx + 7}  y={cy - 10} width={7} height={5} rx={2}
          fill="#0a0a1a" stroke={accentColor} strokeWidth="0.6" />
        <rect x={cx - 9}  y={cy + 18} width={8} height={14} rx={2} fill="#080810" />
        <rect x={cx + 1}  y={cy + 18} width={8} height={14} rx={2} fill="#080810" />
      </>
    );
  }
  if (style === "Punk Rocker") {
    return (
      <>
        <rect x={cx - 12} y={cy - 10} width={24} height={28} rx={3}
          fill="#1a0a22" stroke={accentColor} strokeWidth="1" />
        {[-8, 0, 8].map((dx, i) => (
          <rect key={i} x={cx + dx - 2} y={cy - 8} width={4} height={4} rx={1}
            fill={accentColor} fillOpacity={0.5 + i * 0.1} />
        ))}
        <line x1={cx - 12} y1={cy + 6} x2={cx + 12} y2={cy + 6}
          stroke={accentColor} strokeWidth="1" strokeOpacity="0.5" />
        <rect x={cx - 10} y={cy + 18} width={8} height={14} rx={2} fill="#1a0a22" />
        <rect x={cx + 2}  y={cy + 18} width={8} height={14} rx={2} fill="#1a0a22" />
      </>
    );
  }
  if (style === "Ex Military") {
    return (
      <>
        <rect x={cx - 12} y={cy - 10} width={24} height={30} rx={3}
          fill="#3a4428" stroke="#5a6438" strokeWidth="1" />
        <rect x={cx - 10} y={cy - 6} width={6} height={5} rx={1} fill="#2a3018" fillOpacity="0.6" />
        <rect x={cx + 4}  y={cy}     width={7} height={4} rx={1} fill="#4a5430" fillOpacity="0.5" />
        <rect x={cx - 11} y={cy + 10} width={22} height={5} rx={1}
          fill="#ccccaa" fillOpacity="0.25" />
        <rect x={cx - 14} y={cy - 10} width={7} height={5} rx={2}
          fill="#3a4428" stroke="#5a6438" strokeWidth="0.7" />
        <rect x={cx + 7}  y={cy - 10} width={7} height={5} rx={2}
          fill="#3a4428" stroke="#5a6438" strokeWidth="0.7" />
        <rect x={cx - 10} y={cy + 18} width={8} height={14} rx={2} fill="#2a3218" />
        <rect x={cx + 2}  y={cy + 18} width={8} height={14} rx={2} fill="#2a3218" />
      </>
    );
  }
  if (style === "Hacker") {
    return (
      <>
        <rect x={cx - 12} y={cy - 10} width={24} height={28} rx={3}
          fill="#111133" stroke={accentColor} strokeWidth="1" />
        {[-8, -2, 4].map((dy, i) => (
          <line key={i} x1={cx - 10} y1={cy + dy} x2={cx + 10} y2={cy + dy}
            stroke={accentColor} strokeWidth="0.5" strokeOpacity={0.3 + i * 0.1} />
        ))}
        <rect x={cx - 8} y={cy - 8} width={16} height={6} rx={2}
          fill={accentColor} fillOpacity="0.2" stroke={accentColor} strokeWidth="0.6" />
        <line x1={cx + 9} y1={cy - 5} x2={cx + 14} y2={cy - 10}
          stroke={accentColor} strokeWidth="0.7" />
        <rect x={cx - 10} y={cy + 18} width={8} height={14} rx={2} fill="#0a0a22" />
        <rect x={cx + 2}  y={cy + 18} width={8} height={14} rx={2} fill="#0a0a22" />
      </>
    );
  }
  if (style === "Chef") {
    return (
      <>
        <rect x={cx - 11} y={cy - 10} width={22} height={30} rx={3}
          fill="#f0f0f0" fillOpacity="0.8" stroke="#cccccc" strokeWidth="1" />
        <line x1={cx - 2} y1={cy - 10} x2={cx - 2} y2={cy + 20}
          stroke="#cccccc" strokeWidth="0.8" strokeOpacity="0.5" />
        <rect x={cx - 9} y={cy - 5} width={4} height={3} rx={1}
          fill={accentColor} fillOpacity="0.5" />
        <rect x={cx - 9} y={cy + 2} width={4} height={3} rx={1}
          fill={accentColor} fillOpacity="0.5" />
        <rect x={cx - 14} y={cy - 10} width={7} height={5} rx={2}
          fill="#f0f0f0" fillOpacity="0.7" stroke="#cccccc" strokeWidth="0.8" />
        <rect x={cx + 7}  y={cy - 10} width={7} height={5} rx={2}
          fill="#f0f0f0" fillOpacity="0.7" stroke="#cccccc" strokeWidth="0.8" />
        <rect x={cx - 10} y={cy + 18} width={8} height={14} rx={2} fill="#d8d8d8" />
        <rect x={cx + 2}  y={cy + 18} width={8} height={14} rx={2} fill="#d8d8d8" />
      </>
    );
  }
  if (style === "Fascist") {
    return (
      <>
        <rect x={cx - 12} y={cy - 10} width={24} height={30} rx={3}
          fill="#6b4e1a" stroke="#a07830" strokeWidth="1" />
        <rect x={cx - 10} y={cy - 6} width={8} height={5} rx={1}
          fill="#8b6914" fillOpacity="0.6" />
        <rect x={cx + 2}  y={cy + 2} width={7} height={4} rx={1}
          fill="#c8970a" fillOpacity="0.4" />
        <rect x={cx - 12} y={cy + 10} width={24} height={3} rx={1}
          fill="#a07830" fillOpacity="0.5" />
        <rect x={cx - 16} y={cy - 10} width={8} height={6} rx={2}
          fill="#6b4e1a" stroke="#a07830" strokeWidth="0.8" />
        <rect x={cx + 8}  y={cy - 10} width={8} height={6} rx={2}
          fill="#6b4e1a" stroke="#a07830" strokeWidth="0.8" />
        <rect x={cx - 10} y={cy + 18} width={8} height={14} rx={2} fill="#5a3e10" />
        <rect x={cx + 2}  y={cy + 18} width={8} height={14} rx={2} fill="#5a3e10" />
      </>
    );
  }
  return (
    <>
      <rect x={cx - 12} y={cy - 10} width={24} height={30} rx={4}
        fill="#1e1e3a" stroke={accentColor} strokeWidth="1" />
      <line x1={cx} y1={cy - 10} x2={cx} y2={cy + 20}
        stroke={accentColor} strokeWidth="2" strokeOpacity="0.7" />
      <rect x={cx - 16} y={cy - 10} width={8} height={6} rx={2}
        fill="#1e1e3a" stroke={accentColor} strokeWidth="0.8" />
      <rect x={cx + 8}  y={cy - 10} width={8} height={6} rx={2}
        fill="#1e1e3a" stroke={accentColor} strokeWidth="0.8" />
      <rect x={cx - 10} y={cy + 18} width={8} height={14} rx={2} fill="#14142a" />
      <rect x={cx + 2}  y={cy + 18} width={8} height={14} rx={2} fill="#14142a" />
    </>
  );
}

function CharacterBoard({ cx, cy, accentColor, vibe, characterSeed }: {
  cx: number; cy: number; accentColor: string; vibe: string; characterSeed: string;
}) {
  if (vibe === "Grunge") {
    return (
      <>
        <ellipse cx={cx - 16} cy={cy + 22} rx={20} ry={9} fill={accentColor} fillOpacity="0.05" />
        <rect x={cx - 24} y={cy + 34} width={8} height={4} rx={1} fill="#555" stroke="#888" strokeWidth="0.5" />
        <rect x={cx + 16} y={cy + 34} width={8} height={4} rx={1} fill="#555" stroke="#888" strokeWidth="0.5" />
        <rect x={cx - 30} y={cy + 28} width={60} height={10} rx={5}
          fill="#2a1a0a" stroke="#887755" strokeWidth="1.5" />
        {[-10, 0, 10].map((dx, i) => (
          <line key={i} x1={cx + dx} y1={cy + 29} x2={cx + dx + 4} y2={cy + 37}
            stroke="#ffcc88" strokeWidth="0.4" strokeOpacity="0.3" />
        ))}
        <circle cx={cx - 20} cy={cy + 42} r={8} fill="#222" stroke="#887755" strokeWidth="1.5" />
        <circle cx={cx + 20} cy={cy + 42} r={8} fill="#222" stroke="#887755" strokeWidth="1.5" />
        {[0, 1, 2].map(i => {
          const angle = (i / 3) * Math.PI;
          const dx = Math.cos(angle) * 6, dy = Math.sin(angle) * 6;
          return (
            <g key={i}>
              <line x1={cx - 20 - dx} y1={cy + 42 - dy} x2={cx - 20 + dx} y2={cy + 42 + dy}
                stroke="#887755" strokeWidth="0.7" strokeOpacity="0.5" />
              <line x1={cx + 20 - dx} y1={cy + 42 - dy} x2={cx + 20 + dx} y2={cy + 42 + dy}
                stroke="#887755" strokeWidth="0.7" strokeOpacity="0.5" />
            </g>
          );
        })}
        <ellipse cx={cx} cy={cy + 46} rx={26} ry={4} fill={accentColor} fillOpacity="0.15" />
      </>
    );
  }
  if (vibe === "Neon") {
    return (
      <>
        <ellipse cx={cx - 14} cy={cy + 20} rx={18} ry={8} fill={accentColor} fillOpacity="0.08" />
        <rect x={cx - 22} y={cy + 33} width={6} height={3} rx={1} fill="#333" stroke={accentColor} strokeWidth="0.5" />
        <rect x={cx + 16} y={cy + 33} width={6} height={3} rx={1} fill="#333" stroke={accentColor} strokeWidth="0.5" />
        <rect x={cx - 28} y={cy + 28} width={56} height={8} rx={4}
          fill="#0a0a1a" stroke={accentColor} strokeWidth="2" />
        <rect x={cx - 26} y={cy + 34} width={52} height={1} rx={0.5}
          fill={accentColor} fillOpacity="0.7" />
        <circle cx={cx - 18} cy={cy + 40} r={6} fill="#111" stroke={accentColor} strokeWidth="1.5" />
        <circle cx={cx + 18} cy={cy + 40} r={6} fill="#111" stroke={accentColor} strokeWidth="1.5" />
        <circle cx={cx - 18} cy={cy + 40} r={4} fill="none" stroke={accentColor} strokeWidth="0.6" strokeOpacity="0.5" />
        <circle cx={cx + 18} cy={cy + 40} r={4} fill="none" stroke={accentColor} strokeWidth="0.6" strokeOpacity="0.5" />
        <circle cx={cx - 18} cy={cy + 40} r={2.5} fill={accentColor} fillOpacity="0.8" />
        <circle cx={cx + 18} cy={cy + 40} r={2.5} fill={accentColor} fillOpacity="0.8" />
        <ellipse cx={cx} cy={cy + 44} rx={22} ry={3} fill={accentColor} fillOpacity="0.2" />
      </>
    );
  }
  if (vibe === "Chrome") {
    return (
      <>
        <ellipse cx={cx - 12} cy={cy + 20} rx={14} ry={6} fill="#aaccff" fillOpacity="0.06" />
        <rect x={cx - 20} y={cy + 33} width={5} height={2} rx={0.5} fill="#aabbcc" stroke="#88aacc" strokeWidth="0.4" />
        <rect x={cx + 15} y={cy + 33} width={5} height={2} rx={0.5} fill="#aabbcc" stroke="#88aacc" strokeWidth="0.4" />
        <rect x={cx - 26} y={cy + 29} width={52} height={6} rx={3}
          fill="#b0c8e0" stroke="#aaccee" strokeWidth="1.2" />
        <line x1={cx - 20} y1={cy + 31} x2={cx + 20} y2={cy + 31}
          stroke="white" strokeWidth="0.6" strokeOpacity="0.5" />
        <circle cx={cx - 16} cy={cy + 38} r={5} fill="#c0d0e0" stroke="#88aacc" strokeWidth="1" />
        <circle cx={cx + 16} cy={cy + 38} r={5} fill="#c0d0e0" stroke="#88aacc" strokeWidth="1" />
        <circle cx={cx - 16} cy={cy + 38} r={2} fill="#aaccee" fillOpacity="0.8" />
        <circle cx={cx + 16} cy={cy + 38} r={2} fill="#aaccee" fillOpacity="0.8" />
        <ellipse cx={cx} cy={cy + 42} rx={18} ry={2.5} fill="#88aacc" fillOpacity="0.15" />
      </>
    );
  }
  if (vibe === "Plastic") {
    const plasticColors = ["#ff4488", "#44ffaa", "#ffcc00", "#44aaff"];
    const wc = plasticColors[Math.floor(seededVal(characterSeed, 350) * 4)];
    return (
      <>
        <ellipse cx={cx - 12} cy={cy + 20} rx={14} ry={6} fill={wc} fillOpacity="0.05" />
        <rect x={cx - 19} y={cy + 33} width={5} height={2} rx={0.5} fill="#e0e0e0" stroke="#cccccc" strokeWidth="0.4" />
        <rect x={cx + 14} y={cy + 33} width={5} height={2} rx={0.5} fill="#e0e0e0" stroke="#cccccc" strokeWidth="0.4" />
        <rect x={cx - 24} y={cy + 30} width={48} height={5} rx={2.5}
          fill="#f0e8ff" stroke="#ddbbff" strokeWidth="1" />
        <line x1={cx - 22} y1={cy + 32.5} x2={cx + 22} y2={cy + 32.5}
          stroke={wc} strokeWidth="1.2" strokeOpacity="0.7" />
        <circle cx={cx - 14} cy={cy + 37} r={4} fill={wc} stroke="#ffffff" strokeWidth="0.8" fillOpacity="0.85" />
        <circle cx={cx + 14} cy={cy + 37} r={4} fill={wc} stroke="#ffffff" strokeWidth="0.8" fillOpacity="0.85" />
        <circle cx={cx - 14} cy={cy + 37} r={1.5} fill="white" fillOpacity="0.7" />
        <circle cx={cx + 14} cy={cy + 37} r={1.5} fill="white" fillOpacity="0.7" />
        <ellipse cx={cx} cy={cy + 40} rx={16} ry={2} fill={wc} fillOpacity="0.12" />
      </>
    );
  }
  return (
    <>
      <ellipse cx={cx - 14} cy={cy + 20} rx={18} ry={8} fill={accentColor} fillOpacity="0.06" />
      <rect x={cx - 22} y={cy + 33} width={6} height={3} rx={1} fill="#333" stroke={accentColor} strokeWidth="0.5" />
      <rect x={cx + 16} y={cy + 33} width={6} height={3} rx={1} fill="#333" stroke={accentColor} strokeWidth="0.5" />
      <rect x={cx - 28} y={cy + 28} width={56} height={8} rx={4}
        fill="#1a1a2e" stroke={accentColor} strokeWidth="1.5" />
      <circle cx={cx - 18} cy={cy + 40} r={6} fill="#111" stroke={accentColor} strokeWidth="1.5" />
      <circle cx={cx + 18} cy={cy + 40} r={6} fill="#111" stroke={accentColor} strokeWidth="1.5" />
      <circle cx={cx - 18} cy={cy + 40} r={3} fill={accentColor} fillOpacity="0.7" />
      <circle cx={cx + 18} cy={cy + 40} r={3} fill={accentColor} fillOpacity="0.7" />
      <ellipse cx={cx} cy={cy + 43} rx={22} ry={4} fill={accentColor} fillOpacity="0.25" />
    </>
  );
}

function StoragePack({ cx, cy, accentColor, packStyle }: {
  cx: number; cy: number; accentColor: string; packStyle: string;
}) {
  if (packStyle === "shopping-bag") {
    return (
      <>
        <rect x={cx + 10} y={cy - 5} width={14} height={6} rx={3}
          fill="#1e1e3a" stroke={accentColor} strokeWidth="1"
          transform={`rotate(-20,${cx + 10},${cy - 2})`} />
        <rect x={cx + 22} y={cy - 2} width={10} height={13} rx={2}
          fill={accentColor} fillOpacity="0.35" stroke={accentColor} strokeWidth="0.8"
          transform={`rotate(-20,${cx + 10},${cy - 2})`} />
        <path d={`M${cx + 24},${cy - 2} Q${cx + 27},${cy - 7} ${cx + 30},${cy - 2}`}
          fill="none" stroke={accentColor} strokeWidth="0.8"
          transform={`rotate(-20,${cx + 10},${cy - 2})`} />
      </>
    );
  }
  if (packStyle === "backpack") {
    return (
      <>
        <rect x={cx - 18} y={cy - 8} width={12} height={20} rx={3}
          fill="#2a2a4a" stroke={accentColor} strokeWidth="0.8" strokeOpacity="0.7" />
        <line x1={cx - 15} y1={cy - 8} x2={cx - 12} y2={cy + 8}
          stroke={accentColor} strokeWidth="0.8" strokeOpacity="0.5" />
        <rect x={cx - 14} y={cy - 10} width={8} height={3} rx={1.5}
          fill={accentColor} fillOpacity="0.4" stroke={accentColor} strokeWidth="0.5" />
        <rect x={cx - 17} y={cy + 4} width={10} height={7} rx={2}
          fill="#222240" stroke={accentColor} strokeWidth="0.5" strokeOpacity="0.6" />
        <rect x={cx + 10} y={cy - 5} width={14} height={6} rx={3}
          fill="#1e1e3a" stroke={accentColor} strokeWidth="1"
          transform={`rotate(-20,${cx + 10},${cy - 2})`} />
        <circle cx={cx + 25} cy={cy - 9} r={4}
          fill="#1e1e3a" stroke={accentColor} strokeWidth="1"
          transform={`rotate(-20,${cx + 10},${cy - 2})`} />
      </>
    );
  }
  if (packStyle === "cardboard-box") {
    return (
      <>
        <rect x={cx - 18} y={cy + 5} width={36} height={6} rx={3}
          fill="#1e1e3a" stroke={accentColor} strokeWidth="0.8" />
        <rect x={cx - 16} y={cy - 8} width={32} height={24} rx={2}
          fill="#c8a860" stroke="#a08040" strokeWidth="1.2" />
        <line x1={cx} y1={cy - 8} x2={cx} y2={cy - 4} stroke="#a08040" strokeWidth="0.8" />
        <line x1={cx - 16} y1={cy - 5} x2={cx + 16} y2={cy - 5}
          stroke="#a08040" strokeWidth="0.8" strokeOpacity="0.7" />
        <rect x={cx - 4} y={cy - 8} width={8} height={24} rx={1}
          fill="#d4b870" fillOpacity="0.4" />
        <line x1={cx - 4} y1={cy - 8} x2={cx - 4} y2={cy + 16}
          stroke="#a08040" strokeWidth="0.4" strokeOpacity="0.5" />
        <line x1={cx + 4} y1={cy - 8} x2={cx + 4} y2={cy + 16}
          stroke="#a08040" strokeWidth="0.4" strokeOpacity="0.5" />
      </>
    );
  }
  if (packStyle === "duffel-bag") {
    return (
      <>
        <line x1={cx - 10} y1={cy - 10} x2={cx + 14} y2={cy + 15}
          stroke={accentColor} strokeWidth="1.2" strokeOpacity="0.6" />
        <rect x={cx + 8} y={cy + 10} width={22} height={14} rx={6}
          fill="#1a2a3a" stroke={accentColor} strokeWidth="1" />
        <line x1={cx + 10} y1={cy + 17} x2={cx + 28} y2={cy + 17}
          stroke={accentColor} strokeWidth="0.8" strokeOpacity="0.6" />
        <path d={`M${cx + 12},${cy + 10} Q${cx + 15},${cy + 6} ${cx + 18},${cy + 10}`}
          fill="none" stroke={accentColor} strokeWidth="0.8" strokeOpacity="0.7" />
        <rect x={cx + 10} y={cy - 5} width={14} height={6} rx={3}
          fill="#1e1e3a" stroke={accentColor} strokeWidth="1"
          transform={`rotate(-20,${cx + 10},${cy - 2})`} />
        <circle cx={cx + 25} cy={cy - 9} r={4}
          fill="#1e1e3a" stroke={accentColor} strokeWidth="1"
          transform={`rotate(-20,${cx + 10},${cy - 2})`} />
      </>
    );
  }
  return (
    <>
      <rect x={cx + 10} y={cy - 5} width={14} height={6} rx={3}
        fill="#1e1e3a" stroke={accentColor} strokeWidth="1"
        transform={`rotate(-20,${cx + 10},${cy - 2})`} />
      <circle cx={cx + 25} cy={cy - 9} r={4}
        fill="#1e1e3a" stroke={accentColor} strokeWidth="1"
        transform={`rotate(-20,${cx + 10},${cy - 2})`} />
    </>
  );
}

function CardCharacter({ cx, cy, accentColor, archetype, style, vibe, storagePackStyle, characterSeed }: CharacterProps) {
  return (
    <g>
      <rect x={cx - 10} y={cy + 18} width={8} height={14} rx={2} fill="#14142a" />
      <rect x={cx + 2}  y={cy + 18} width={8} height={14} rx={2} fill="#14142a" />
      <rect x={cx - 11} y={cy + 23} width={9} height={5} rx={2} fill="#252540" stroke={accentColor} strokeWidth="0.6" />
      <rect x={cx + 2}  y={cy + 23} width={9} height={5} rx={2} fill="#252540" stroke={accentColor} strokeWidth="0.6" />
      <CharacterBoard cx={cx} cy={cy} accentColor={accentColor} vibe={vibe} characterSeed={characterSeed} />
      <CharacterBody cx={cx} cy={cy} accentColor={accentColor} style={style} />
      <StoragePack cx={cx} cy={cy} accentColor={accentColor} packStyle={storagePackStyle} />
      <CharacterHead cx={cx} cy={cy} accentColor={accentColor} archetype={archetype} />
      <ellipse cx={cx} cy={cy + 10} rx={14} ry={20} fill={accentColor} fillOpacity="0.04" />
    </g>
  );
}

const RARITY_STARS: Record<string, number> = {
  "Punch Skater": 1,
  Apprentice: 2,
  Master: 3,
  Rare: 4,
  Legendary: 5,
};

const RARITY_STAR_COLOR: Record<string, string> = {
  "Punch Skater": "#aa9988",
  Apprentice:     "#44ddaa",
  Master:         "#cc44ff",
  Rare:           "#4488ff",
  Legendary:      "#ffaa00",
};

export function CardArt({ card, width = 200, height = 140 }: CardArtProps) {
  const accent    = card.visuals.accentColor || "#00ff88";
  const stars     = RARITY_STARS[card.prompts.rarity] || 1;
  const starColor = RARITY_STAR_COLOR[card.prompts.rarity] || accent;
  const uid       = card.id.replace(/[^a-z0-9]/gi, "").slice(0, 16) || "ca";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
      aria-label={`Card art for ${card.identity.name}`}
    >
      <CardBackground
        width={width}
        height={height}
        district={card.prompts.district}
        backgroundSeed={card.backgroundSeed}
        uid={uid}
      />
      <CardCharacter
        cx={width / 2}
        cy={height * 0.55}
        accentColor={accent}
        archetype={getDisplayedArchetype(card)}
        style={card.prompts.style}
        vibe={card.prompts.vibe}
        storagePackStyle={card.visuals.storagePackStyle}
        characterSeed={card.characterSeed}
      />
      <CardFrame
        width={width}
        height={height}
        rarity={card.prompts.rarity}
        frameSeed={card.frameSeed}
        uid={uid}
      />
      {Array.from({ length: stars }).map((_, i) => (
        <polygon
          key={i}
          points="0,-5 1.5,-1.5 5,-1.5 2.5,1 3.5,5 0,2.5 -3.5,5 -2.5,1 -5,-1.5 -1.5,-1.5"
          fill={starColor}
          fillOpacity={card.prompts.rarity === "Legendary" ? 1 : 0.9}
          transform={`translate(${width / 2 - (stars - 1) * 7 + i * 14}, 12)`}
        />
      ))}
      <text x={width - 4} y={height - 4} textAnchor="end" fontSize="6"
        fill={accent} fontFamily="monospace" fillOpacity="0.8">
        {card.prompts.district}
      </text>
      <rect x={2} y={2} width={44} height={12} rx={3}
        fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="0.5" />
      <text x={24} y={11} textAnchor="middle" fontSize="7" fill={accent} fontFamily="monospace">
        {getDisplayedArchetype(card).toUpperCase()}
      </text>
    </svg>
  );
}
