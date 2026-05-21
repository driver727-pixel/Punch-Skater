/**
 * CyberpunkD4Dice.tsx
 *
 * Animated 4-sided (d4) pyramid dice for Joustur Skatur, rendered in
 * cyberpunk neon art style using inline SVG and CSS 3D transforms.
 *
 * Behaviour:
 *   – Idle / result shown : static die face, clickable to roll.
 *   – rolling=true        : fast tumbling animation; face numbers cycle rapidly.
 *   – rolling transitions false + result arrives: bounce-land animation, holds result.
 */

import { useEffect, useRef, useState } from "react";

interface CyberpunkD4DiceProps {
  /** True while the roll API request is in-flight. */
  rolling: boolean;
  /** The roll result (1–4) returned by the server; null if not yet rolled. */
  result: number | null;
  /** Triggered when the player clicks the die. */
  onRoll: () => void;
  /** Disables the button externally (e.g. not the active player). */
  disabled?: boolean;
}

// Distinct neon colour per face to reinforce the cyberpunk theme.
const FACE_COLORS: Record<number, string> = {
  1: "#00ff88",  // neon green   – accent
  2: "#00ccff",  // cyan         – accent2
  3: "#cc44ff",  // purple
  4: "#ff6622",  // orange       – electric
};

export function CyberpunkD4Dice({
  rolling,
  result,
  onRoll,
  disabled = false,
}: CyberpunkD4DiceProps) {
  // The face number shown on the die surface.
  const [displayFace, setDisplayFace] = useState<number>(1);
  // True for a short window after rolling ends, to play the landing animation.
  const [landed, setLanded] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRollingRef = useRef(rolling);

  useEffect(() => {
    if (rolling) {
      setLanded(false);
      // Rapidly cycle through faces to simulate tumbling.
      intervalRef.current = setInterval(() => {
        setDisplayFace((f) => (f % 4) + 1);
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (result !== null) {
        setDisplayFace(result);
        // Only play the land animation when transitioning out of rolling.
        if (prevRollingRef.current) {
          setLanded(true);
          const t = setTimeout(() => setLanded(false), 650);
          return () => clearTimeout(t);
        }
      }
    }
    prevRollingRef.current = rolling;
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [rolling, result]);

  const faceColor = FACE_COLORS[displayFace] ?? "#00ff88";

  const isClickable = !disabled && !rolling && result === null;

  const ariaLabel = rolling
    ? "Rolling USB Shards…"
    : result !== null
      ? `Rolled ${result} USB Shards — pick a rider`
      : "Roll USB Shards";

  const labelText = rolling
    ? "Rolling…"
    : result !== null
      ? `USB Shards: ${result}`
      : "Roll USB Shards";

  return (
    <div
      className={[
        "d4-dice",
        rolling   ? "d4-dice--rolling" : "",
        landed    ? "d4-dice--landed"  : "",
        result !== null && !rolling ? "d4-dice--result" : "",
      ].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        className="d4-dice__trigger"
        onClick={isClickable ? onRoll : undefined}
        disabled={!isClickable}
        aria-label={ariaLabel}
        title={isClickable ? "Click to roll the USB Shards" : undefined}
      >
        {/* ── 3-D scene container ──────────────────────────────────────── */}
        <div className="d4-dice__scene">
          <div className="d4-dice__shape">
            <svg
              viewBox="0 0 120 120"
              className="d4-dice__svg"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                {/* Neon soft glow */}
                <filter id="d4f-edge-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* Stronger glow for the face number */}
                <filter id="d4f-number-glow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* ── Back-left face (shaded dark) ─────────────────────── */}
              <polygon
                points="60,8 12,104 60,58"
                fill="rgba(0,0,18,0.88)"
                stroke="#00ccff"
                strokeWidth="1.5"
                strokeLinejoin="round"
                filter="url(#d4f-edge-glow)"
              />

              {/* ── Back-right face (slightly lit) ──────────────────── */}
              <polygon
                points="60,8 108,104 60,58"
                fill="rgba(0,204,255,0.06)"
                stroke="#00ccff"
                strokeWidth="1.5"
                strokeLinejoin="round"
                filter="url(#d4f-edge-glow)"
              />

              {/* ── Front face (facing viewer, neon-coloured) ─────────── */}
              <polygon
                points="60,8 12,104 108,104"
                fill={`${faceColor}1a`}
                stroke={faceColor}
                strokeWidth="2.5"
                strokeLinejoin="round"
                filter="url(#d4f-edge-glow)"
              />

              {/* ── Internal edges leading to hidden apex ─────────────── */}
              <line x1="60" y1="58" x2="60" y2="8"   stroke="#00ccff" strokeWidth="0.8" opacity="0.4" />
              <line x1="60" y1="58" x2="12" y2="104" stroke="#00ccff" strokeWidth="0.8" opacity="0.4" />
              <line x1="60" y1="58" x2="108" y2="104" stroke="#00ccff" strokeWidth="0.8" opacity="0.4" />

              {/* ── Cyberpunk circuit-node vertices ───────────────────── */}
              <circle cx="60"  cy="8"   r="3.5" fill="#00ccff" filter="url(#d4f-edge-glow)" />
              <circle cx="12"  cy="104" r="3.5" fill="#00ccff" filter="url(#d4f-edge-glow)" />
              <circle cx="108" cy="104" r="3.5" fill="#00ccff" filter="url(#d4f-edge-glow)" />
              {/* Hidden apex node */}
              <circle cx="60" cy="58" r="2.5" fill="#cc44ff" opacity="0.7" />

              {/* ── Scanline marks across front face (HUD aesthetic) ──── */}
              <line x1="36" y1="52" x2="84"  y2="52" stroke={faceColor} strokeWidth="0.6" opacity="0.22" />
              <line x1="30" y1="63" x2="90"  y2="63" stroke={faceColor} strokeWidth="0.6" opacity="0.16" />
              <line x1="24" y1="74" x2="96"  y2="74" stroke={faceColor} strokeWidth="0.6" opacity="0.11" />

              {/* ── Face number ───────────────────────────────────────── */}
              <text
                x="60"
                y="92"
                textAnchor="middle"
                fill={faceColor}
                fontSize="30"
                fontFamily="'Courier New', Courier, monospace"
                fontWeight="bold"
                filter="url(#d4f-number-glow)"
              >
                {displayFace}
              </text>

              {/* ── Small "USB SHARD" label at the base ───────────────── */}
              <text
                x="60"
                y="113"
                textAnchor="middle"
                fill="#00ccff"
                fontSize="7"
                fontFamily="'Courier New', Courier, monospace"
                letterSpacing="2"
                opacity="0.55"
              >
                USB SHARD
              </text>
            </svg>
          </div>
        </div>

        {/* ── Text label below the die ─────────────────────────────────── */}
        <span className="d4-dice__label" aria-hidden="true">
          {labelText}
        </span>
      </button>
    </div>
  );
}
