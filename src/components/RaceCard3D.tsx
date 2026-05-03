/**
 * RaceCard3D — a non-interactive CSS 3D card rendered over the race track canvas.
 *
 * The parent (RaceTrack) computes the card's position and orientation each tick
 * from the precomputed race timeline and passes them as props. This component is
 * purely presentational: it owns no animation state of its own.
 *
 * The card shows `imageUrl` when available and falls back to a colored placeholder
 * whose hue matches the racer's lane (challenger = pink, defender = cyan). A small
 * name badge is shown at the base of the card.
 *
 * 3D depth is achieved through CSS `perspective` on the parent container combined
 * with `rotateX/Y/Z` transforms applied here — the same mechanism as CardViewer3D,
 * without the interactive drag/spin logic.
 */
import type { RaceCardSnapshot } from "../lib/types";

interface RaceCard3DProps {
  card: RaceCardSnapshot;
  /** Horizontal position as a percentage of the canvas-inner container width (0–100). */
  leftPct: number;
  /** Vertical position as a percentage of the canvas-inner container height (0–100). */
  topPct: number;
  /**
   * Track tangent angle in degrees. The card is rotated so its face looks in the
   * direction of travel (rotateZ = angleDeg + 90 to convert from tangent to card
   * orientation, matching the canvas drawCard's `ctx.rotate(angle + Math.PI/2)`).
   */
  angleDeg: number;
  /** Forward lean in degrees (rotateX). Positive = top of card tilts away from viewer. */
  tiltX: number;
  /** Side wobble in degrees (rotateY). Driven by instantaneous speed. */
  tiltY: number;
  /** Visual variant that controls the glow color. */
  variant: "challenger" | "defender";
}

export function RaceCard3D({
  card,
  leftPct,
  topPct,
  angleDeg,
  tiltX,
  tiltY,
  variant,
}: RaceCard3DProps) {
  // rotateZ aligns the card face to the direction of travel.
  // Adding 90° converts the tangent vector angle to card-face orientation,
  // mirroring the canvas renderer's `ctx.rotate(angle + Math.PI/2)`.
  const transform = `rotateZ(${(angleDeg + 90).toFixed(2)}deg) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;

  return (
    <div
      className={`race-card-3d race-card-3d--${variant}`}
      aria-hidden="true"
      style={{
        left: `${leftPct.toFixed(3)}%`,
        top: `${topPct.toFixed(3)}%`,
        transform,
      }}
    >
      {card.imageUrl ? (
        <img
          className="race-card-3d-image"
          src={card.imageUrl}
          alt=""
          draggable={false}
        />
      ) : (
        <div className="race-card-3d-placeholder" />
      )}
      <span className="race-card-3d-label">{card.name.slice(0, 8)}</span>
    </div>
  );
}
