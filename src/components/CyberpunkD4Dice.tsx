/**
 * CyberpunkD4Dice.tsx
 *
 * Animated tetrahedral dice (d4) for Joustur Skatur™, rendered in
 * cyberpunk neon art style using inline SVG and CSS 3D transforms.
 *
 * Each die is a triangular pyramid with 2 marked (white) corners and 2 unmarked
 * corners. After rolling, you count the dice with a marked corner facing up
 * to get your roll total. Three dice → range 0–3. Roll of 0 = move 4 tiles.
 *
 * Behaviour:
 *   – Idle / result shown : static dice, clickable to roll.
 *   – rolling=true        : fast tumbling animation; marks cycle rapidly.
 *   – rolling → false + result arrives: bounce-land, holds result.
 */

import { useEffect, useRef, useState } from "react";

interface CyberpunkD4DiceProps {
  /** True while the roll API request is in-flight. */
  rolling: boolean;
  /** The roll result (0–3) returned by the server; null if not yet rolled. */
  result: number | null;
  /** Individual dice results array (each 0 or 1); null if not yet rolled. */
  dice?: number[] | null;
  /** Triggered when the player clicks the dice. */
  onRoll: () => void;
  /** Disables the button externally (e.g. not the active player). */
  disabled?: boolean;
  /** If true, dice are shown in a non-interactive display mode (opponent view). */
  displayOnly?: boolean;
}

/** Single tetrahedral die SVG — shows marked (white dot) or unmarked top corner. */
function TetrahedralDie({ marked, rolling: isRolling }: { marked: boolean; rolling: boolean }) {
  const markedColor = "#ffffff";
  const unmarkedColor = "rgba(0,0,18,0.6)";
  const edgeColor = "#00ccff";

  return (
    <svg
      viewBox="0 0 80 80"
      className="d4-dice__svg"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <filter id="d4f-edge-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="d4f-mark-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Back-left face */}
      <polygon
        points="40,6 8,72 40,42"
        fill="rgba(0,0,18,0.88)"
        stroke={edgeColor}
        strokeWidth="1.2"
        strokeLinejoin="round"
        filter="url(#d4f-edge-glow)"
      />

      {/* Back-right face */}
      <polygon
        points="40,6 72,72 40,42"
        fill="rgba(0,204,255,0.06)"
        stroke={edgeColor}
        strokeWidth="1.2"
        strokeLinejoin="round"
        filter="url(#d4f-edge-glow)"
      />

      {/* Front face */}
      <polygon
        points="40,6 8,72 72,72"
        fill={marked ? "rgba(255,255,255,0.08)" : "rgba(0,204,255,0.03)"}
        stroke={marked ? markedColor : edgeColor}
        strokeWidth={marked ? "2" : "1.5"}
        strokeLinejoin="round"
        filter="url(#d4f-edge-glow)"
      />

      {/* Internal edges to hidden apex */}
      <line x1="40" y1="42" x2="40" y2="6"  stroke={edgeColor} strokeWidth="0.6" opacity="0.35" />
      <line x1="40" y1="42" x2="8"  y2="72" stroke={edgeColor} strokeWidth="0.6" opacity="0.35" />
      <line x1="40" y1="42" x2="72" y2="72" stroke={edgeColor} strokeWidth="0.6" opacity="0.35" />

      {/* Top corner — marked or unmarked */}
      <circle
        cx="40"
        cy="6"
        r={marked ? "5" : "3"}
        fill={marked ? markedColor : unmarkedColor}
        stroke={marked ? markedColor : edgeColor}
        strokeWidth={marked ? "1" : "0.5"}
        filter={marked ? "url(#d4f-mark-glow)" : "url(#d4f-edge-glow)"}
        opacity={isRolling ? 0.7 : 1}
      />

      {/* Bottom corners (always shown as circuit nodes) */}
      <circle cx="8"  cy="72" r="2.5" fill={edgeColor} filter="url(#d4f-edge-glow)" />
      <circle cx="72" cy="72" r="2.5" fill={edgeColor} filter="url(#d4f-edge-glow)" />

      {/* Hidden apex node */}
      <circle cx="40" cy="42" r="2" fill="#cc44ff" opacity="0.6" />

      {/* Scanline marks (HUD aesthetic) */}
      <line x1="24" y1="38" x2="56" y2="38" stroke={edgeColor} strokeWidth="0.4" opacity="0.15" />
      <line x1="20" y1="48" x2="60" y2="48" stroke={edgeColor} strokeWidth="0.4" opacity="0.1" />
    </svg>
  );
}

export function CyberpunkD4Dice({
  rolling,
  result,
  dice,
  onRoll,
  disabled = false,
  displayOnly = false,
}: CyberpunkD4DiceProps) {
  // Individual die states for animation
  const [displayDice, setDisplayDice] = useState<number[]>([0, 0, 0]);
  const [landed, setLanded] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRollingRef = useRef(rolling);

  useEffect(() => {
    if (rolling) {
      setLanded(false);
      // Rapidly cycle through random dice states to simulate tumbling.
      intervalRef.current = setInterval(() => {
        setDisplayDice([
          Math.random() > 0.5 ? 1 : 0,
          Math.random() > 0.5 ? 1 : 0,
          Math.random() > 0.5 ? 1 : 0,
        ]);
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (dice && dice.length === 3) {
        setDisplayDice(dice);
        if (prevRollingRef.current) {
          setLanded(true);
          const t = setTimeout(() => setLanded(false), 650);
          return () => clearTimeout(t);
        }
      } else if (result !== null) {
        // Fallback: derive display from total if individual dice not available.
        const derived = [0, 0, 0];
        for (let i = 0; i < Math.min(result, 3); i++) derived[i] = 1;
        setDisplayDice(derived);
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
  }, [rolling, result, dice]);

  const canRoll = !disabled && !rolling && result === null && !displayOnly;

  const effectiveResult = result === 0 ? 4 : result;

  const ariaLabel = rolling
    ? "Rolling dice…"
    : result !== null
      ? `Rolled ${effectiveResult} — ${result === 0 ? "zero marks, move 4!" : `${result} marked`}`
      : "Roll Dice";

  const labelText = rolling
    ? "Rolling…"
    : result !== null
      ? result === 0
        ? "🎯 Zero — Move 4!"
        : `Dice: ${effectiveResult}`
      : "Roll Dice";

  return (
    <div
      className={[
        "d4-dice",
        rolling   ? "d4-dice--rolling" : "",
        landed    ? "d4-dice--landed"  : "",
        result !== null && !rolling ? "d4-dice--result" : "",
        displayOnly ? "d4-dice--display-only" : "",
      ].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        className="d4-dice__trigger"
        onClick={canRoll ? onRoll : undefined}
        disabled={disabled || rolling || displayOnly}
        aria-label={ariaLabel}
        title={canRoll ? "Click to roll the dice" : undefined}
      >
        {/* ── 3-D scene container with 3 dice ────────────────────────── */}
        <div className="d4-dice__scene d4-dice__scene--triple">
          {displayDice.map((marked, i) => (
            <div className="d4-dice__shape" key={`die-${i}`}>
              <TetrahedralDie marked={marked === 1} rolling={rolling} />
            </div>
          ))}
        </div>

        {/* ── Text label below the dice ───────────────────────────────── */}
        <span className="d4-dice__label" aria-hidden="true">
          {labelText}
        </span>
      </button>
    </div>
  );
}
