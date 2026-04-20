import type { CardPayload } from "../lib/types";
import { CardArt } from "./CardArt";
import { FrameOverlay } from "./FrameOverlay";
import { StatBar } from "./StatBar";
import { getDisplayedArchetype, getDisplayedCrew } from "../lib/cardIdentity";
import { CARD_STAT_LABELS } from "../lib/statLabels";
import { getFrameBlendMode, shouldInsetBackgroundForFrame, shouldRenderSvgFrame } from "../services/staticAssets";

export interface PrintedCardFaceProps {
  card: CardPayload;
  backgroundImageUrl?: string;
  characterImageUrl?: string;
  frameImageUrl?: string;
  characterBlend?: number;
  fallbackWidth?: number;
  fallbackHeight?: number;
}

const PRINT_RARITY_COLORS: Record<string, string> = {
  "Punch Skater": "#aa9988",
  Apprentice: "#44ddaa",
  Master: "#cc44ff",
  Rare: "#4488ff",
  Legendary: "#ffaa00",
};

export function PrintedCardFrontContent({
  card,
  backgroundImageUrl,
  characterImageUrl,
  frameImageUrl,
  characterBlend,
  fallbackWidth = 189,
  fallbackHeight = 264,
}: PrintedCardFaceProps) {
  const hasAnyLayer = backgroundImageUrl || characterImageUrl || frameImageUrl;
  const backgroundLayerClassName = shouldInsetBackgroundForFrame(card.prompts.rarity, frameImageUrl)
    ? "print-art-layer print-art-layer--bg print-art-layer--bg-inset"
    : "print-art-layer print-art-layer--bg";
  const showSvgFrame = shouldRenderSvgFrame(card.prompts.rarity, frameImageUrl);
  const frameLayerStyle = frameImageUrl
    ? { mixBlendMode: getFrameBlendMode(card.prompts.rarity, frameImageUrl) }
    : undefined;

  return (
    <>
      {hasAnyLayer ? (
        <div className="print-art-composite">
          {backgroundImageUrl && (
            <img src={backgroundImageUrl} alt="background" className={backgroundLayerClassName} />
          )}
          {characterImageUrl && (
            <img
              src={characterImageUrl}
              alt="character"
              className="print-art-layer print-art-layer--char"
              style={characterBlend !== undefined ? { opacity: characterBlend } : undefined}
            />
          )}
          {frameImageUrl && !showSvgFrame && (
            <img src={frameImageUrl} alt="frame" className="print-art-layer print-art-layer--frame" style={frameLayerStyle} />
          )}
          {showSvgFrame && (
            <FrameOverlay
              rarity={card.prompts.rarity}
              frameSeed={card.frameSeed}
              className="print-art-layer print-art-layer--svg-frame"
            />
          )}
        </div>
      ) : (
        <CardArt card={card} width={fallbackWidth} height={fallbackHeight} />
      )}
      <div className="print-front-overlay">
        <span className="print-front-name">{card.identity.name}</span>
        <p className="print-front-bio">&ldquo;{card.flavorText}&rdquo;</p>
      </div>
    </>
  );
}

export function PrintedCardBackContent({ card }: PrintedCardFaceProps) {
  const accent = card.visuals.accentColor || "#00ff88";
  const rarityColor = PRINT_RARITY_COLORS[card.prompts.rarity] || "#aaaaaa";

  return (
    <>
      <div className="print-back-header" style={{ background: rarityColor }}>
        <span className="print-back-name">{card.identity.name}</span>
        <span className="print-back-rarity">{card.prompts.rarity.toUpperCase()}</span>
      </div>

      {card.board && (
        <div className="print-back-board">
          {card.boardImageUrl ? (
            <img src={card.boardImageUrl} alt="Electric skateboard" className="print-back-board-image" />
          ) : (
            <div className="print-back-board-placeholder">🛹</div>
          )}
        </div>
      )}

      <div className="print-back-stats">
        <StatBar label={CARD_STAT_LABELS.speed.label} value={card.stats.speed} color={accent} tooltip={CARD_STAT_LABELS.speed.tooltip} />
        <StatBar label={CARD_STAT_LABELS.stealth.label} value={card.stats.stealth} color={accent} tooltip={CARD_STAT_LABELS.stealth.tooltip} />
        <StatBar label={CARD_STAT_LABELS.tech.label} value={card.stats.tech} color={accent} tooltip={CARD_STAT_LABELS.tech.tooltip} />
        <StatBar label={CARD_STAT_LABELS.grit.label} value={card.stats.grit} color={accent} tooltip={CARD_STAT_LABELS.grit.tooltip} />
        <StatBar label={CARD_STAT_LABELS.rep.label} value={card.stats.rep} color={accent} tooltip={CARD_STAT_LABELS.rep.tooltip} />
      </div>

      <div className="print-back-info">
        {[
          ["ARCHETYPE", getDisplayedArchetype(card)],
          ["STYLE", card.prompts.style],
          ["DISTRICT", card.prompts.district],
          ["CREW", getDisplayedCrew(card)],
        ].map(([label, value]) => (
          <div key={label} className="print-back-row">
            <span className="print-back-row-label">{label}</span>
            <span className="print-back-row-value">{value}</span>
          </div>
        ))}
      </div>

      <div className="print-back-trait">
        <span className="print-back-trait-label">
          PASSIVE · {card.traits.passiveTrait.name}
        </span>
        <p className="print-back-trait-desc">{card.traits.passiveTrait.description}</p>
      </div>

      <div className="print-back-trait">
        <span className="print-back-trait-label">
          ACTIVE · {card.traits.activeAbility.name}
        </span>
        <p className="print-back-trait-desc">{card.traits.activeAbility.description}</p>
      </div>

      <div className="print-back-tags">
        {card.traits.personalityTags.map((tag) => (
          <span key={tag} className="print-back-tag" style={{ borderColor: accent }}>{tag}</span>
        ))}
      </div>

      <div className="print-back-serial">{card.identity.serialNumber}</div>
    </>
  );
}

interface PrintedCardPreviewPairProps extends PrintedCardFaceProps {
  className?: string;
}

export function PrintedCardPreviewPair({
  card,
  backgroundImageUrl,
  characterImageUrl,
  frameImageUrl,
  characterBlend,
  className,
}: PrintedCardPreviewPairProps) {
  const previewClassName = className ? `print-preview-area ${className}` : "print-preview-area";

  return (
    <div className={previewClassName}>
      <div className="print-preview-slot">
        <p className="print-preview-label">Front</p>
        <div className="print-card-wrap">
          <div className="print-card print-card--front">
            <PrintedCardFrontContent
              card={card}
              backgroundImageUrl={backgroundImageUrl}
              characterImageUrl={characterImageUrl}
              frameImageUrl={frameImageUrl}
              characterBlend={characterBlend}
            />
          </div>
        </div>
      </div>

      <div className="print-preview-slot">
        <p className="print-preview-label">Back</p>
        <div className="print-card-wrap">
          <div className="print-card print-card--back">
            <PrintedCardBackContent card={card} />
          </div>
        </div>
      </div>
    </div>
  );
}
