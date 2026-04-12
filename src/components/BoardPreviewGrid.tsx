/**
 * BoardPreviewGrid.tsx
 *
 * Displays a 2×2 grid of real product photos for the four selected board
 * components (Deck, Drivetrain, Wheels, Battery).
 *
 * Images are loaded from per-category folders:
 *   /assets/boards/deck/<BoardType>.png
 *   /assets/boards/drivetrain/<Drivetrain>.png
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
  labels?: { deck?: string; drivetrain?: string; wheels?: string; battery?: string };
  /** Extra CSS class applied to the outer container. */
  className?: string;
}

interface TileProps {
  src: string;
  alt: string;
  label: string;
  icon: string;
}

function Tile({ src, alt, label, icon }: TileProps) {
  const [failed, setFailed] = useState(false);

  const handleError = useCallback(() => setFailed(true), []);

  if (failed) {
    return (
      <div className="board-preview-grid__placeholder">
        <span className="board-preview-grid__placeholder-icon">{icon}</span>
        <span className="board-preview-grid__placeholder-label">{label}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="board-preview-grid__img"
      onError={handleError}
    />
  );
}

export function BoardPreviewGrid({ urls, labels, className }: BoardPreviewGridProps) {
  return (
    <div className={`board-preview-grid${className ? ` ${className}` : ""}`}>
      <div className="board-preview-grid__cell">
        <Tile
          src={urls.deckUrl}
          alt={labels?.deck ?? "Deck"}
          label={labels?.deck ?? "Deck"}
          icon="🛹"
        />
      </div>
      <div className="board-preview-grid__cell">
        <Tile
          src={urls.drivetrainUrl}
          alt={labels?.drivetrain ?? "Drivetrain"}
          label={labels?.drivetrain ?? "Drivetrain"}
          icon="⚙️"
        />
      </div>
      <div className="board-preview-grid__cell">
        <Tile
          src={urls.wheelsUrl}
          alt={labels?.wheels ?? "Wheels"}
          label={labels?.wheels ?? "Wheels"}
          icon="🟡"
        />
      </div>
      <div className="board-preview-grid__cell">
        <Tile
          src={urls.batteryUrl}
          alt={labels?.battery ?? "Battery"}
          label={labels?.battery ?? "Battery"}
          icon="🔋"
        />
      </div>
    </div>
  );
}
