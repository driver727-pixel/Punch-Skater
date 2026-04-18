import type { CardPayload } from "../lib/types";
import { CardArt } from "./CardArt";
import { FrameOverlay } from "./FrameOverlay";
import { getFrameBlendMode, shouldInsetBackgroundForFrame, shouldRenderSvgFrame } from "../services/staticAssets";

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
  const showSvgFrame = shouldRenderSvgFrame(card.prompts.rarity, frameImageUrl);
  const hasLayers = backgroundImageUrl || characterImageUrl || frameImageUrl;
  const backgroundLayerClassName = shouldInsetBackgroundForFrame(card.prompts.rarity, frameImageUrl)
    ? "card-art-layer card-art-layer--background card-art-layer--background-inset"
    : "card-art-layer card-art-layer--background";
  const frameLayerStyle = frameImageUrl
    ? { mixBlendMode: getFrameBlendMode(card.prompts.rarity, frameImageUrl) }
    : undefined;

  if (!hasLayers) {
    return <CardArt card={card} width={width} height={height} />;
  }

  return (
    <div className="card-art-composite" style={{ width, height }}>
      {backgroundImageUrl && (
        <img
          src={backgroundImageUrl}
          alt="background"
          className={backgroundLayerClassName}
        />
      )}
      {characterImageUrl && (
        <img
          src={characterImageUrl}
          alt="character"
          className="card-art-layer card-art-layer--character"
        />
      )}
      {frameImageUrl && !showSvgFrame && (
        <img
          src={frameImageUrl}
          alt="frame"
          className="card-art-layer card-art-layer--frame"
          style={frameLayerStyle}
        />
      )}
      {showSvgFrame && (
        <FrameOverlay
          rarity={card.prompts.rarity}
          frameSeed={card.frameSeed}
          className="card-art-layer card-art-layer--svg-frame"
        />
      )}
    </div>
  );
}
