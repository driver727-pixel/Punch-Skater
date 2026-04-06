import { useState } from "react";
import type { CardPayload } from "../lib/types";
import { CardArt } from "./CardArt";
import { StatBar } from "./StatBar";
import { ShareModal } from "./ShareModal";
import { CardViewer3D } from "./CardViewer3D";
import { PrintModal } from "./PrintModal";
import { HIGH_RARITY_TIERS } from "../lib/generator";

interface LayerLoading {
  background: boolean;
  character:  boolean;
  frame:      boolean;
}

interface CardDisplayProps {
  card: CardPayload;
  compact?: boolean;
  onSave?: () => void;
  onRemove?: () => void;
  onEdit?: () => void;
  isSaved?: boolean;
  showShare?: boolean;
  saveLabel?: string;
  /** URL of the AI-generated illustration (legacy single-image). */
  imageUrl?: string;
  /** When true, shows a loading skeleton while the AI image is being fetched. */
  imageLoading?: boolean;
  /** Background layer URL (district scene, no characters). */
  backgroundImageUrl?: string;
  /** Character layer URL (courier portrait on white background). */
  characterImageUrl?: string;
  /** Frame layer URL (ornate playing-card border based on rarity). */
  frameImageUrl?: string;
  /** Per-layer loading states — shows targeted skeletons for each layer. */
  layerLoading?: LayerLoading;
  /** 0–1 opacity of the character layer (1 = fully opaque). Passed through to CompositeArt. */
  characterBlend?: number;
}

const RARITY_COLORS: Record<string, string> = {
  "Punch Skater": "#aa9988",
  Apprentice:     "#44ddaa",
  Master:         "#cc44ff",
  Rare:           "#4488ff",
  Legendary:      "#ffaa00",
};

// ── Layer status badge helper ──────────────────────────────────────────────────

function LayerStatusBadges({ loading }: { loading: LayerLoading }) {
  const badges = [
    { key: "background", label: "BG",   loading: loading.background },
    { key: "character",  label: "CHAR", loading: loading.character  },
    { key: "frame",      label: "FRAME", loading: loading.frame      },
  ].filter((b) => b.loading);

  if (badges.length === 0) return null;

  return (
    <div className="layer-status-badges">
      {badges.map((b) => (
        <span key={b.key} className="layer-status-badge layer-status-badge--loading">
          ✨ {b.label}
        </span>
      ))}
    </div>
  );
}

// ── Composite art renderer ─────────────────────────────────────────────────────

interface CompositeArtProps {
  card: CardPayload;
  backgroundImageUrl?: string;
  characterImageUrl?: string;
  frameImageUrl?: string;
  layerLoading?: LayerLoading;
  /** 0–1 opacity applied to the character layer (1 = fully opaque). */
  characterBlend?: number;
  /** Width hint for the SVG fallback only */
  width?: number;
  height?: number;
  fullSize?: boolean;
}

function CompositeArt({
  card,
  backgroundImageUrl,
  characterImageUrl,
  frameImageUrl,
  layerLoading,
  characterBlend,
  width = 200,
  height = 140,
  fullSize = false,
}: CompositeArtProps) {
  const hasAnyLayer =
    backgroundImageUrl || characterImageUrl || frameImageUrl ||
    layerLoading?.background || layerLoading?.character || layerLoading?.frame;

  // No AI layer data at all — render SVG fallback
  if (!hasAnyLayer) {
    return <CardArt card={card} width={width} height={height} />;
  }

  return (
    <div className={`card-art-composite${fullSize ? " card-art-composite--full" : ""}`}>
      {/* Layer 1 – Background (district environment) */}
      {backgroundImageUrl ? (
        <img
          src={backgroundImageUrl}
          alt="background"
          className="card-art-layer card-art-layer--background"
        />
      ) : layerLoading?.background ? (
        <div className="card-art-layer card-art-layer--background card-art-layer--loading">
          <span className="card-art-layer__label">🌆 Background…</span>
        </div>
      ) : null}

      {/* Layer 2 – Character (courier portrait, feathered-mask composited) */}
      {characterImageUrl ? (
        <img
          src={characterImageUrl}
          alt="character"
          className="card-art-layer card-art-layer--character"
          style={characterBlend !== undefined ? { opacity: characterBlend } : undefined}
        />
      ) : layerLoading?.character ? (
        <div className="card-art-layer card-art-layer--character card-art-layer--loading">
          <span className="card-art-layer__label">🛹 Character…</span>
        </div>
      ) : null}

      {/* Layer 3 – Frame (ornate rarity border, multiply-blended) */}
      {frameImageUrl ? (
        <img
          src={frameImageUrl}
          alt="frame"
          className="card-art-layer card-art-layer--frame"
        />
      ) : layerLoading?.frame ? (
        <div className="card-art-layer card-art-layer--frame card-art-layer--loading">
          <span className="card-art-layer__label">🖼 Frame…</span>
        </div>
      ) : null}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CardDisplay({
  card,
  compact = false,
  onSave,
  onRemove,
  onEdit,
  isSaved,
  showShare = false,
  saveLabel,
  imageUrl,
  imageLoading,
  backgroundImageUrl,
  characterImageUrl,
  frameImageUrl,
  layerLoading,
  characterBlend,
}: CardDisplayProps) {
  const [sharing, setSharing] = useState(false);
  const [viewing3D, setViewing3D] = useState(false);
  const [printing, setPrinting] = useState(false);
  // false = show conlang (default for high-rarity), true = show English translation
  const [showEnglish, setShowEnglish] = useState(false);
  const rarityColor = RARITY_COLORS[card.prompts.rarity] || "#aaaaaa";
  const accent = card.visuals.accentColor || "#00ff88";

  // Whether this card has conlang data and is a high-rarity tier
  const hasConlangLore =
    !!card.conlang && HIGH_RARITY_TIERS.has(card.prompts.rarity);

  // Helpers that return the active language string (conlang or English)
  const passiveTraitDesc = hasConlangLore && !showEnglish
    ? card.conlang!.passiveTrait
    : card.traits.passiveTrait.description;
  const activeAbilityDesc = hasConlangLore && !showEnglish
    ? card.conlang!.activeAbility
    : card.traits.activeAbility.description;
  const displayFlavorText = hasConlangLore && !showEnglish
    ? card.conlang!.flavorText
    : card.flavorText;

  // Prefer layer URLs from props; fall back to card-stored URLs; then legacy imageUrl
  const resolvedBackground = backgroundImageUrl ?? card.backgroundImageUrl;
  const resolvedCharacter  = characterImageUrl  ?? card.characterImageUrl;
  const resolvedFrame      = frameImageUrl      ?? card.frameImageUrl;
  const resolvedImageUrl   = imageUrl           ?? card.imageUrl;

  const hasLayeredImages = resolvedBackground || resolvedCharacter || resolvedFrame;
  const resolvedLayerLoading = layerLoading ?? { background: false, character: false, frame: false };

  if (compact) {
    return (
      <div className="card-compact" style={{ borderColor: rarityColor }}>
        {imageLoading && !hasLayeredImages ? (
          <div className="card-art-skeleton" />
        ) : hasLayeredImages || layerLoading ? (
          <CompositeArt
            card={card}
            backgroundImageUrl={resolvedBackground}
            characterImageUrl={resolvedCharacter}
            frameImageUrl={resolvedFrame}
            layerLoading={resolvedLayerLoading}
            characterBlend={characterBlend}
            width={160}
            height={112}
          />
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

      {/* Layer loading status badges */}
      {(layerLoading?.background || layerLoading?.character || layerLoading?.frame) && (
        <LayerStatusBadges loading={resolvedLayerLoading} />
      )}

      {/* Art area — layered composite takes priority over legacy single image */}
      {hasLayeredImages || (layerLoading?.background || layerLoading?.character || layerLoading?.frame) ? (
        <CompositeArt
          card={card}
          backgroundImageUrl={resolvedBackground}
          characterImageUrl={resolvedCharacter}
          frameImageUrl={resolvedFrame}
          layerLoading={resolvedLayerLoading}
          characterBlend={characterBlend}
          fullSize
        />
      ) : imageLoading ? (
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
        {card.conlang?.catchphrase && (
          <p className="card-catchphrase">
            &ldquo;{card.conlang.catchphrase}&rdquo;
          </p>
        )}
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
          {card.conlang && (
            <>
              <span className="sep">·</span>
              <span className="card-lang-badge" title={`Language: ${card.conlang.languageName}`}>
                🌐 {card.conlang.languageCode.toUpperCase()}
              </span>
            </>
          )}
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
        <div className="stat-active">
          <span className="stat-label">ACT</span>
          <div className="stat-active-body">
            <span className="stat-active-name">{card.traits.activeAbility.name}</span>
            <p className={`stat-active-desc${hasConlangLore && !showEnglish ? " conlang-text" : ""}`}>
              {activeAbilityDesc}
            </p>
          </div>
        </div>
        <div className="stat-flavor">
          <em className={`stat-flavor-text${hasConlangLore && !showEnglish ? " conlang-text" : ""}`}>
            &ldquo;{displayFlavorText}&rdquo;
          </em>
        </div>
      </div>

      <div className="card-traits">
        <div className="trait">
          <span className="trait-label">PASSIVE</span>
          <span className="trait-name">{card.traits.passiveTrait.name}</span>
          <p className={`trait-desc${hasConlangLore && !showEnglish ? " conlang-text" : ""}`}>
            {passiveTraitDesc}
          </p>
        </div>
        {hasConlangLore && (
          <div className="conlang-translate-row">
            <button
              className="btn-translate"
              onClick={() => setShowEnglish((v) => !v)}
              title={showEnglish ? "Show conlang lore" : "Translate to English"}
            >
              {showEnglish ? "🌐 Show Lore" : "🔤 Translate"}
            </button>
          </div>
        )}
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
        <button className="btn-outline" onClick={() => setViewing3D(true)} title="View card in 3D">
          ◈ 3D
        </button>
        <button className="btn-outline" onClick={() => setPrinting(true)} title="Print this card">
          🖨 Print
        </button>
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
      {viewing3D && (
        <CardViewer3D
          card={card}
          backgroundImageUrl={resolvedBackground}
          characterImageUrl={resolvedCharacter}
          frameImageUrl={resolvedFrame}
          characterBlend={characterBlend}
          onClose={() => setViewing3D(false)}
        />
      )}
      {printing && (
        <PrintModal
          card={card}
          backgroundImageUrl={resolvedBackground}
          characterImageUrl={resolvedCharacter}
          frameImageUrl={resolvedFrame}
          characterBlend={characterBlend}
          onClose={() => setPrinting(false)}
        />
      )}
    </div>
  );
}
