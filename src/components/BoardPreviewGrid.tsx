/**
 * BoardPreviewGrid.tsx
 *
 * Displays a grid of real product photos for the five selected board
 * components (Deck, Drivetrain, Motor, Wheels, Battery).
 *
 * Images are loaded from per-category folders:
 *   /assets/boards/deck/<BoardType>.png
 *   /assets/boards/drivetrain/<Drivetrain>.png
 *   /assets/boards/motor/<MotorType>.png
 *   /assets/boards/wheels/<WheelType>.png
 *   /assets/boards/battery/<BatteryType>.png
 *
 * If an image has not been uploaded yet, a placeholder with the component
 * icon and label is shown instead.
 */

import { useState, useCallback } from "react";
import type { BoardComponentImageUrls } from "../lib/boardBuilder";

interface BoardPreviewGridProps {
  urls: BoardComponentImageUrls;
  /** Labels shown on placeholder tiles when an image is missing. */
  labels?: { deck?: string; drivetrain?: string; motor?: string; wheels?: string; battery?: string };
  /** Extra CSS class applied to the outer container. */
  className?: string;
}

interface TileProps {
  src: string;
  alt: string;
  label: string;
  icon: string;
  slot: string;
}

function Tile({ src, alt, label, icon, slot }: TileProps) {
  const [failed, setFailed] = useState(false);

  const handleError = useCallback(() => setFailed(true), []);

  return (
    <div className="board-preview-grid__tile">
      <div className="board-preview-grid__media">
        {failed ? (
          <div className="board-preview-grid__placeholder">
            <span className="board-preview-grid__placeholder-icon">{icon}</span>
            <span className="board-preview-grid__placeholder-label">Image unavailable</span>
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            className="board-preview-grid__img"
            onError={handleError}
          />
        )}
      </div>
      <div className="board-preview-grid__caption">
        <span className="board-preview-grid__slot">{slot}</span>
        <span className="board-preview-grid__value">{label}</span>
      </div>
    </div>
  );
}

export function BoardPreviewGrid({ urls, labels, className }: BoardPreviewGridProps) {
  return (
    <div className={`board-preview-grid${className ? ` ${className}` : ""}`}>
      <div className="board-preview-grid__cell board-preview-grid__cell--deck">
        <Tile
          src={urls.deckUrl}
          alt={labels?.deck ?? "Deck"}
          label={labels?.deck ?? "Deck"}
          icon="🛹"
          slot="Deck"
        />
      </div>
      <div className="board-preview-grid__cell board-preview-grid__cell--drivetrain">
        <Tile
          src={urls.drivetrainUrl}
          alt={labels?.drivetrain ?? "Drivetrain"}
          label={labels?.drivetrain ?? "Drivetrain"}
          icon="⚙️"
          slot="Drivetrain"
        />
      </div>
      <div className="board-preview-grid__cell board-preview-grid__cell--motor">
        <Tile
          src={urls.motorUrl}
          alt={labels?.motor ?? "Motor"}
          label={labels?.motor ?? "Motor"}
          icon="⚡"
          slot="Motor"
        />
      </div>
      <div className="board-preview-grid__cell board-preview-grid__cell--wheels">
        <Tile
          src={urls.wheelsUrl}
          alt={labels?.wheels ?? "Wheels"}
          label={labels?.wheels ?? "Wheels"}
          icon="🟡"
          slot="Wheels"
        />
      </div>
      <div className="board-preview-grid__cell board-preview-grid__cell--battery">
        <Tile
          src={urls.batteryUrl}
          alt={labels?.battery ?? "Battery"}
          label={labels?.battery ?? "Battery"}
          icon="🔋"
          slot="Battery"
        />
      </div>
    </div>
  );
}
