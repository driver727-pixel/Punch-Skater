import { useState } from "react";
import type { CardPayload } from "../lib/types";
import { CardArt } from "./CardArt";
import { StatBar } from "./StatBar";
import { ShareModal } from "./ShareModal";

interface CardDisplayProps {
  card: CardPayload;
  compact?: boolean;
  onSave?: () => void;
  onRemove?: () => void;
  onEdit?: () => void;
  isSaved?: boolean;
  showShare?: boolean;
  saveLabel?: string;
  /** URL of the AI-generated illustration (overrides card.imageUrl when provided). */
  imageUrl?: string;
  /** When true, shows a loading skeleton while the AI image is being fetched. */
  imageLoading?: boolean;
}

const RARITY_COLORS: Record<string, string> = {
  "Punch Skater": "#aa9988",
  Apprentice:     "#44ddaa",
  Master:         "#cc44ff",
  Rare:           "#4488ff",
  Legendary:      "#ffaa00",
};

export function CardDisplay({ card, compact = false, onSave, onRemove, onEdit, isSaved, showShare = false, saveLabel, imageUrl, imageLoading }: CardDisplayProps) {
  const [sharing, setSharing] = useState(false);
  const rarityColor = RARITY_COLORS[card.prompts.rarity] || "#aaaaaa";
  const accent = card.visuals.accentColor || "#00ff88";

  // Resolve the illustration to display: prop > card field > SVG fallback
  const resolvedImageUrl = imageUrl ?? card.imageUrl;

  if (compact) {
    return (
      <div className="card-compact" style={{ borderColor: rarityColor }}>
        {imageLoading ? (
          <div className="card-art-skeleton" />
        ) : resolvedImageUrl ? (
          <img
            src={resolvedImageUrl}
            alt={`${card.identity.name} illustration`}
            className="card-art-image"
          />
        ) : (
          <CardArt card={card} width={160} height={112} />
        )}
        <div className="card-compact-info">
          <span className="card-name">{card.identity.name}</span>
          <span className="card-rarity" style={{ color: rarityColor }}>{card.prompts.rarity}</span>
          <span className="card-archetype">{card.prompts.archetype}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card-full" style={{ borderColor: rarityColor, "--accent": accent } as React.CSSProperties}>
      <div className="card-header">
        <span className="card-serial">{card.identity.serialNumber}</span>
        <span className="card-rarity" style={{ color: rarityColor }}>{card.prompts.rarity.toUpperCase()}</span>
      </div>

      {imageLoading ? (
        <div className="card-art-skeleton card-art-skeleton--full">
          <span className="card-art-skeleton__label">✨ Generating image…</span>
        </div>
      ) : resolvedImageUrl ? (
        <img
          src={resolvedImageUrl}
          alt={`${card.identity.name} illustration`}
          className="card-art-image card-art-image--full"
        />
      ) : (
        <CardArt card={card} width={200} height={140} />
      )}

      <div className="card-identity">
        <h2 className="card-name">{card.identity.name}</h2>
        <div className="card-subline">
          <span>{card.prompts.archetype}</span>
          <span className="sep">·</span>
          <span>{card.prompts.style}</span>
          <span className="sep">·</span>
          <span>{card.prompts.vibe}</span>
        </div>
        <div className="card-subline">
          <span style={{ opacity: 0.6 }}>{card.identity.manufacturer}</span>
          <span className="sep">·</span>
          <span style={{ opacity: 0.6 }}>{card.prompts.district}</span>
        </div>
      </div>

      <div className="card-personality">
        {card.traits.personalityTags.map((t) => (
          <span key={t} className="tag" style={{ borderColor: accent }}>{t}</span>
        ))}
      </div>

      <div className="card-stats">
        <StatBar label="SPD" value={card.stats.speed}   color={accent} />
        <StatBar label="STL" value={card.stats.stealth} color={accent} />
        <StatBar label="TCH" value={card.stats.tech}    color={accent} />
        <StatBar label="GRT" value={card.stats.grit}    color={accent} />
        <StatBar label="REP" value={card.stats.rep}     color={accent} />
        <StatBar label="STA" value={card.stats.stamina} color={accent} />
      </div>

      <div className="card-traits">
        <div className="trait">
          <span className="trait-label">PASSIVE</span>
          <span className="trait-name">{card.traits.passiveTrait.name}</span>
          <p className="trait-desc">{card.traits.passiveTrait.description}</p>
        </div>
        <div className="trait">
          <span className="trait-label">ACTIVE</span>
          <span className="trait-name">{card.traits.activeAbility.name}</span>
          <p className="trait-desc">{card.traits.activeAbility.description}</p>
        </div>
      </div>

      <div className="card-flavor">
        <em>&ldquo;{card.flavorText}&rdquo;</em>
      </div>

      <div className="card-actions">
        {onSave && (
          <button
            className="btn-primary"
            onClick={onSave}
            disabled={isSaved}
          >
            {saveLabel ?? (isSaved ? "✓ Saved" : "Save to Collection")}
          </button>
        )}
        {onEdit && (
          <button className="btn-outline" onClick={onEdit}>
            ✎ Edit
          </button>
        )}
        {showShare && (
          <button className="btn-outline" onClick={() => setSharing(true)}>
            ↗ Share
          </button>
        )}
        {onRemove && (
          <button className="btn-danger" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      {sharing && <ShareModal card={card} onClose={() => setSharing(false)} />}
    </div>
  );
}
