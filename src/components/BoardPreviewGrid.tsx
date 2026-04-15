/**
 * BoardPreviewGrid.tsx
 *
 * Renders the selected board components as a single layered assembly canvas.
 * Each uploaded transparent PNG is stacked on the same high-contrast backdrop
 * so the chosen parts read as one assembled board instead of five separate
 * slots.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import type { BoardComponentImageUrls } from "../lib/boardBuilder";

interface BoardPreviewGridProps {
  urls: BoardComponentImageUrls;
  /** Labels shown on placeholder tiles when an image is missing. */
  labels?: { deck?: string; drivetrain?: string; motor?: string; wheels?: string; battery?: string };
  /** Extra CSS class applied to the outer container. */
  className?: string;
  /** Solid accent background shown behind transparent board component PNGs. */
  accentColor?: string;
}

interface LayerProps {
  src: string;
  alt: string;
  icon: string;
  slot: string;
  layerClassName: string;
}

function Layer({ src, alt, icon, slot, layerClassName }: LayerProps) {
  const [failed, setFailed] = useState(false);

  const handleError = useCallback(() => setFailed(true), []);
  useEffect(() => setFailed(false), [src]);

  return (
    <>
      {failed ? (
        <div className={`board-preview-grid__placeholder ${layerClassName}`}>
          <span className="board-preview-grid__placeholder-icon">{icon}</span>
          <span className="board-preview-grid__placeholder-slot">{slot}</span>
          <span className="board-preview-grid__placeholder-label">Image unavailable</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={layerClassName}
          onError={handleError}
        />
      )}
    </>
  );
}

export function BoardPreviewGrid({ urls, labels, className, accentColor = "#00ff88" }: BoardPreviewGridProps) {
  const layers = useMemo(() => ([
    {
      key: "wheels",
      src: urls.wheelsUrl,
      alt: labels?.wheels ?? "Wheels",
      label: labels?.wheels ?? "Wheels",
      icon: "🟡",
      slot: "Wheels",
      layerClassName: "board-preview-grid__layer board-preview-grid__layer--wheels",
    },
    {
      key: "deck",
      src: urls.deckUrl,
      alt: labels?.deck ?? "Deck",
      label: labels?.deck ?? "Deck",
      icon: "🛹",
      slot: "Deck",
      layerClassName: "board-preview-grid__layer board-preview-grid__layer--deck",
    },
    {
      key: "battery",
      src: urls.batteryUrl,
      alt: labels?.battery ?? "Battery",
      label: labels?.battery ?? "Battery",
      icon: "🔋",
      slot: "Battery",
      layerClassName: "board-preview-grid__layer board-preview-grid__layer--battery",
    },
    {
      key: "drivetrain",
      src: urls.drivetrainUrl,
      alt: labels?.drivetrain ?? "Drivetrain",
      label: labels?.drivetrain ?? "Drivetrain",
      icon: "⚙️",
      slot: "Drivetrain",
      layerClassName: "board-preview-grid__layer board-preview-grid__layer--drivetrain",
    },
    {
      key: "motor",
      src: urls.motorUrl,
      alt: labels?.motor ?? "Motor",
      label: labels?.motor ?? "Motor",
      icon: "⚡",
      slot: "Motor",
      layerClassName: "board-preview-grid__layer board-preview-grid__layer--motor",
    },
  ]), [labels, urls]);

  return (
    <div
      className={`board-preview-grid${className ? ` ${className}` : ""}`}
      style={{ "--board-preview-accent-bg": accentColor } as CSSProperties}
    >
      <div className="board-preview-grid__canvas" aria-label="Board assembly canvas">
        <div className="board-preview-grid__canvas-glow" aria-hidden="true" />
        {layers.map((layer) => (
          <Layer
            key={layer.key}
            src={layer.src}
            alt={layer.alt}
            icon={layer.icon}
            slot={layer.slot}
            layerClassName={layer.layerClassName}
          />
        ))}
      </div>
      <div className="board-preview-grid__legend" aria-label="Selected board parts">
        {layers.map((layer) => (
          <div key={`${layer.key}-legend`} className="board-preview-grid__legend-copy">
            <span className="board-preview-grid__slot">{layer.slot}</span>
            <span className="board-preview-grid__value">{layer.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
