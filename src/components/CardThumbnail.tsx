import { useState } from "react";
import type { CardPayload } from "../lib/types";
import { CardArt } from "./CardArt";
import { FrameOverlay } from "./FrameOverlay";
import {
  getFrameBlendMode,
  getStaticFrameBackUrl,
  shouldInsetBackgroundForFrame,
  shouldRenderSvgFrame,
} from "../services/staticAssets";
import { resolveBoardPoseScene } from "../lib/boardPoseScenes";
import {
  buildBoardPlacementStyle,
  buildCharacterPlacementStyle,
  CHARACTER_LAYER_Z_INDEX,
  getBoardLayerZIndex,
} from "../lib/boardPlacement";

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
  const [boardImageFailed, setBoardImageFailed] = useState(false);
  const { backgroundImageUrl, characterImageUrl, frameImageUrl } = card;
  const showSvgFrame = shouldRenderSvgFrame(card.prompts.rarity, frameImageUrl);
  const hasBackFrame = getStaticFrameBackUrl(card.prompts.rarity) != null;
  const hasLayers = backgroundImageUrl || characterImageUrl || frameImageUrl;
  const backgroundLayerClassName = shouldInsetBackgroundForFrame(card.prompts.rarity, frameImageUrl)
    ? "card-art-layer card-art-layer--background card-art-layer--background-inset"
    : "card-art-layer card-art-layer--background";
  const frameLayerStyle = frameImageUrl
    ? { mixBlendMode: getFrameBlendMode(card.prompts.rarity, frameImageUrl) }
    : undefined;
  const frameLayerClassName = hasBackFrame
    ? "card-art-layer card-art-layer--frame card-art-layer--frame-wrap"
    : "card-art-layer card-art-layer--frame";
  const boardPoseScene = resolveBoardPoseScene(card.characterSeed);
  const showExactBoardLayer = Boolean(card.board.imageUrl && (backgroundImageUrl || characterImageUrl));
  const boardPlacementStyle = {
    ...buildBoardPlacementStyle(boardPoseScene.key, card.board.placement),
    zIndex: getBoardLayerZIndex(card.board.layerOrder),
  };
  const characterPlacementStyle = {
    ...buildCharacterPlacementStyle(card.characterPlacement),
    zIndex: CHARACTER_LAYER_Z_INDEX,
  };

  if (!hasLayers) {
    return <CardArt card={card} width={width} height={height} />;
  }

  return (
    <div className={`card-art-composite${hasBackFrame ? " card-art-composite--wrap-frame" : ""}`} style={{ width, height }}>
      {backgroundImageUrl && (
        <img
          src={backgroundImageUrl}
          alt="background"
          className={backgroundLayerClassName}
        />
      )}
      {showExactBoardLayer && card.board.imageUrl && !boardImageFailed && (
        <img
          src={card.board.imageUrl}
          alt="exact generated skateboard"
          className="card-art-layer card-art-layer--board-exact"
          style={boardPlacementStyle}
          onError={() => setBoardImageFailed(true)}
        />
      )}
      {characterImageUrl && (
        <img
          src={characterImageUrl}
          alt="character"
          className="card-art-layer card-art-layer--character"
          style={characterPlacementStyle}
        />
      )}
      {frameImageUrl && !showSvgFrame && (
        <img
          src={frameImageUrl}
          alt="frame"
          className={frameLayerClassName}
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
