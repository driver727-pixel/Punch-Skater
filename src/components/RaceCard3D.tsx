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
 *
 * Liveliness cues driven by props:
 *   - `speed` controls a motion-trail of ghost cards and a forward "lean" boost.
 *   - `eventKind` colours the trail and triggers a one-shot reaction animation
 *     (a stumble on hazards, a surge on boosts).
 *   - `isLeading` adds a "1st place" pip and a brighter rubber-band glow so the
 *     back-and-forth lead battle stays legible.
 */
import type { RaceCardSnapshot } from "../lib/types";
import type { RaceEventEffectKind } from "../lib/raceEffects";

// Ghost cards sit a short distance behind the lead card so the trail reads as
// motion blur without drifting too far off the track on tight turns.
const TRAIL_OFFSETS_PX = [12, 24];
// Timeline speeds above this threshold are visually fast enough to justify
// rendering the lightweight motion trail ghosts.
const TRAIL_SPEED_THRESHOLD = 0.0008;
// Above this speed the card leans harder into the track for a sense of effort.
const FAST_SPEED_THRESHOLD = 0.0019;

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
  /** Raw timeline speed, used for optional motion-trail ghosts. */
  speed?: number;
  /** Visual variant that controls the glow color. */
  variant: "challenger" | "defender";
  /** Active event this tick (drives reaction animation + trail colour). */
  eventKind?: RaceEventEffectKind | null;
  /** Whether this racer is currently in the lead. */
  isLeading?: boolean;
}

export function RaceCard3D({
  card,
  leftPct,
  topPct,
  angleDeg,
  tiltX,
  tiltY,
  speed = 0,
  variant,
  eventKind = null,
  isLeading = false,
}: RaceCard3DProps) {
  // rotateZ aligns the card face to the direction of travel.
  // Adding 90° converts the tangent vector angle to card-face orientation,
  // mirroring the canvas renderer's `ctx.rotate(angle + Math.PI/2)`.
  // Fast racers lean harder forward for a stronger sense of effort.
  const leanBoost = speed > FAST_SPEED_THRESHOLD ? 6 : 0;
  const transform = `rotateZ(${(angleDeg + 90).toFixed(2)}deg) rotateX(${(tiltX + leanBoost).toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
  const angleRad = (angleDeg * Math.PI) / 180;
  const showTrail = speed > TRAIL_SPEED_THRESHOLD;

  // One-shot reaction animation class keyed off the active event.
  const reactionClass = eventKind === "wipeout" || eventKind === "pothole"
    ? "race-card-3d--stumble"
    : eventKind === "courierHandoff" || eventKind === "copDodge" || eventKind === "comeback"
      ? "race-card-3d--surge"
      : "";
  const trailKindClass = eventKind ? ` race-card-trail--${eventKind}` : "";

  return (
    <>
      {showTrail && TRAIL_OFFSETS_PX.map((distance, index) => (
        <div
          key={distance}
          className={`race-card-3d race-card-3d--${variant} race-card-trail race-card-trail--${index + 1}${trailKindClass}`}
          aria-hidden="true"
          style={{
            left: `calc(${leftPct.toFixed(3)}% - ${(Math.cos(angleRad) * distance).toFixed(2)}px)`,
            top: `calc(${topPct.toFixed(3)}% - ${(Math.sin(angleRad) * distance).toFixed(2)}px)`,
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
        </div>
      ))}
      <div
        className={`race-card-3d race-card-3d--${variant}${isLeading ? " race-card-3d--leading" : ""}${reactionClass ? " " + reactionClass : ""}`}
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
        {isLeading && <span className="race-card-3d-pip" aria-hidden="true">1st</span>}
      </div>
    </>
  );
}
