import type { CardPayload } from "../lib/types";
import { CardArt } from "./CardArt";

interface CardThumbnailProps {
  card: CardPayload;
  width?: number;
  height?: number;
}

/**
 * Renders a card thumbnail using saved AI composite layer images when available,
 * falling back to the SVG CardArt when no layer images have been stored.
 */
export function CardThumbnail({ card, width = 160, height = 112 }: CardThumbnailProps) {
  const { backgroundImageUrl, characterImageUrl, frameImageUrl } = card;
  const hasLayers = backgroundImageUrl || characterImageUrl || frameImageUrl;

  if (!hasLayers) {
    return <CardArt card={card} width={width} height={height} />;
  }

  return (
    <div className="card-art-composite" style={{ width, height }}>
      {backgroundImageUrl && (
        <img
          src={backgroundImageUrl}
          alt="background"
          className="card-art-layer card-art-layer--background"
        />
      )}
      {characterImageUrl && (
        <img
          src={characterImageUrl}
          alt="character"
          className="card-art-layer card-art-layer--character"
        />
      )}
      {frameImageUrl && (
        <img
          src={frameImageUrl}
          alt="frame"
          className="card-art-layer card-art-layer--frame"
        />
      )}
    </div>
  );
}
