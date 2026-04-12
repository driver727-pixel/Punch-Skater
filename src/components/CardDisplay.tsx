import { useState, useEffect } from "react";
import { PUNCH_SKATER_RARITY, type CardPayload } from "../lib/types";
import { CardArt } from "./CardArt";
import { StatBar } from "./StatBar";
import { ShareModal } from "./ShareModal";
import { CardViewer3D } from "./CardViewer3D";
import { PrintModal } from "./PrintModal";
import { HIGH_RARITY_TIERS } from "../lib/generator";
import { getDisplayedArchetype, isSecretFactionCard } from "../lib/cardIdentity";
import { BOARD_TYPE_OPTIONS, DRIVETRAIN_OPTIONS, MOTOR_OPTIONS, WHEEL_OPTIONS, BATTERY_OPTIONS } from "../lib/boardBuilder";
import { SkateboardStatsPanel } from "./SkateboardStatsPanel";
import { computeCardWorth } from "../lib/battle";
import { CARD_STAT_LABELS } from "../lib/statLabels";

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
  /** When true, the 3D-viewer and Print buttons (and their modals) are suppressed so a parent
   *  component can render them in a different location. */
  hideToolButtons?: boolean;
  /** When true, hides the entire card-actions button row (Edit, 3D, Print, Share, Remove, Save)
   *  so a parent component can render all action buttons outside the card. */
  hideAllActions?: boolean;
  /** When provided, renders inline edit controls for name, age, and bio/flavor text. */
  onUpdate?: (updates: { name?: string; age?: string; flavorText?: string }) => void;
  /** Called when a composite image layer fails to load (e.g. expired fal.ai URL). */
  onLayerError?: (layer: "background" | "character" | "frame") => void;
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
  /** Called when one of the composite image layers fails to load (e.g. expired URL). */
  onLayerError?: (layer: "background" | "character" | "frame") => void;
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
  onLayerError,
}: CompositeArtProps) {
  const hasAnyLayer =
    backgroundImageUrl || characterImageUrl || frameImageUrl ||
    layerLoading?.background || layerLoading?.character || layerLoading?.frame;
  const isPunchSkaterFrame = card.prompts.rarity === PUNCH_SKATER_RARITY && !!frameImageUrl;
  const backgroundLayerClassName = isPunchSkaterFrame
    ? "card-art-layer card-art-layer--background card-art-layer--background-inset"
    : "card-art-layer card-art-layer--background";

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
          className={backgroundLayerClassName}
          onError={() => onLayerError?.("background")}
        />
      ) : layerLoading?.background ? (
        <div className="card-art-layer card-art-layer--background card-art-layer--loading">
          <img src="/assets/loading.apng" alt="Loading…" className="card-art-loading-gif" />
        </div>
      ) : null}

      {/* Layer 2 – Character (courier portrait, feathered-mask composited) */}
      {characterImageUrl ? (
        <img
          src={characterImageUrl}
          alt="character"
          className="card-art-layer card-art-layer--character"
          style={characterBlend !== undefined ? { opacity: characterBlend } : undefined}
          onError={() => onLayerError?.("character")}
        />
      ) : layerLoading?.character ? (
        <div className="card-art-layer card-art-layer--character card-art-layer--loading">
          <img src="/assets/loading.apng" alt="Loading…" className="card-art-loading-gif" />
        </div>
      ) : null}

      {/* Layer 3 – Frame (ornate rarity border, multiply-blended) */}
      {frameImageUrl ? (
        <img
          src={frameImageUrl}
          alt="frame"
          className="card-art-layer card-art-layer--frame"
          onError={() => onLayerError?.("frame")}
        />
      ) : layerLoading?.frame ? (
        <div className="card-art-layer card-art-layer--frame card-art-layer--loading">
          <img src="/assets/loading.apng" alt="Loading…" className="card-art-loading-gif" />
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
  hideToolButtons = false,
  hideAllActions = false,
  onUpdate,
  onLayerError,
}: CardDisplayProps) {
  const [sharing, setSharing] = useState(false);
  const [viewing3D, setViewing3D] = useState(false);
  const [printing, setPrinting] = useState(false);
  // false = show conlang (default for high-rarity), true = show English translation
  const [showEnglish, setShowEnglish] = useState(false);

  // ── Inline editable name, age & bio ──────────────────────────────────────
  const [localName, setLocalName] = useState(card.identity.name);
  const [localAge, setLocalAge] = useState(card.identity.age ?? "");
  const [localBio, setLocalBio] = useState(card.flavorText);
  const [editingName, setEditingName] = useState(false);
  const [editingAge, setEditingAge] = useState(false);
  const [editingBio, setEditingBio] = useState(false);

  // Sync local state when the card identity changes (e.g. a new card is forged)
  useEffect(() => {
    setLocalName(card.identity.name);
    setLocalAge(card.identity.age ?? "");
    setLocalBio(card.flavorText);
    setEditingName(false);
    setEditingAge(false);
    setEditingBio(false);
  }, [card.id, card.identity.name, card.identity.age, card.flavorText]);

  const commitName = () => {
    setEditingName(false);
    const trimmed = localName.trim() || card.identity.name;
    setLocalName(trimmed);
    if (trimmed !== card.identity.name) onUpdate?.({ name: trimmed });
  };

  const commitAge = () => {
    setEditingAge(false);
    const trimmed = localAge.trim();
    setLocalAge(trimmed);
    if (trimmed !== (card.identity.age ?? "")) onUpdate?.({ age: trimmed });
  };

  const commitBio = () => {
    setEditingBio(false);
    const trimmed = localBio.trim() || card.flavorText;
    setLocalBio(trimmed);
    if (trimmed !== card.flavorText) onUpdate?.({ flavorText: trimmed });
  };
  // ─────────────────────────────────────────────────────────────────────────

  const rarityColor = RARITY_COLORS[card.prompts.rarity] || "#aaaaaa";
  const accent = card.visuals.accentColor || "#00ff88";
  const displayedArchetype = getDisplayedArchetype(card);
  const secretFactionCard = isSecretFactionCard(card);

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
    : localBio;

  // Prefer layer URLs from props; fall back to card-stored URLs; then legacy imageUrl
  const resolvedBackground = backgroundImageUrl ?? card.backgroundImageUrl;
  const resolvedCharacter  = characterImageUrl  ?? card.characterImageUrl;
  const resolvedFrame      = frameImageUrl      ?? card.frameImageUrl;
  const resolvedImageUrl   = imageUrl           ?? card.imageUrl;

  const hasLayeredImages = resolvedBackground || resolvedCharacter || resolvedFrame;
  const resolvedLayerLoading = layerLoading ?? { background: false, character: false, frame: false };

  if (compact) {
    return (
      <div className="card-compact">
        {imageLoading && !hasLayeredImages ? (
          <div className="card-art-skeleton">
            <img src="/assets/loading.apng" alt="Loading…" className="card-art-loading-gif" />
          </div>
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
            onLayerError={onLayerError}
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
          <span className="card-archetype">{displayedArchetype}</span>
          {secretFactionCard && (
            <span className="card-secret-badge">{card.discovery?.logoMark ?? card.discovery?.revealedFaction}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card-full" style={{ "--accent": accent } as React.CSSProperties}>
      {/* ── Top Half: Character image, name, and bio ── */}
      <div className="card-half">
        <div className="card-header">
          <span className="card-serial">{card.identity.serialNumber}</span>
          <span className="card-rarity" style={{ color: rarityColor }}>{card.prompts.rarity.toUpperCase()}</span>
        </div>
        {secretFactionCard && (
          <div className="card-secret-brand">
            <span>{card.discovery?.logoMark ?? card.discovery?.revealedFaction}</span>
          </div>
        )}

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
            onLayerError={onLayerError}
          />
        ) : imageLoading ? (
          <div className="card-art-skeleton card-art-skeleton--full">
            <img src="/assets/loading.apng" alt="Loading…" className="card-art-loading-gif" />
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
          {onUpdate && editingName ? (
            <input
              className="card-edit-input"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitName(); }
                if (e.key === "Escape") { setLocalName(card.identity.name); setEditingName(false); }
              }}
              autoFocus
              maxLength={40}
            />
          ) : (
            <h2
              className={`card-name${onUpdate ? " card-name--editable" : ""}`}
              onClick={() => { if (onUpdate) { setEditingName(true); } }}
              title={onUpdate ? "Click to rename" : undefined}
            >
              {localName}
              {onUpdate && <span className="card-edit-hint">✎</span>}
            </h2>
          )}

          {/* Age field — shown when a value exists or when the card is editable */}
          {(localAge || onUpdate) && (
            onUpdate && editingAge ? (
              <input
                className="card-edit-input card-age-input"
                value={localAge}
                placeholder="Age"
                onChange={(e) => setLocalAge(e.target.value)}
                onBlur={commitAge}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitAge(); }
                  if (e.key === "Escape") { setLocalAge(card.identity.age ?? ""); setEditingAge(false); }
                }}
                autoFocus
                maxLength={20}
              />
            ) : (
              <p
                className={`card-age${onUpdate ? " card-age--editable" : ""}`}
                onClick={() => { if (onUpdate) setEditingAge(true); }}
                title={onUpdate ? "Click to set age" : undefined}
              >
                {localAge || <span className="card-age-placeholder">Age</span>}
                {onUpdate && <span className="card-edit-hint">✎</span>}
              </p>
            )
          )}

          {/* Bio field — shown directly under name/age */}
          {(localBio || onUpdate) && (
            onUpdate && !hasConlangLore && editingBio ? (
              <textarea
                className="card-edit-textarea card-bio-textarea"
                value={localBio}
                onChange={(e) => setLocalBio(e.target.value)}
                onBlur={commitBio}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setLocalBio(card.flavorText); setEditingBio(false); }
                }}
                autoFocus
                rows={3}
                maxLength={200}
              />
            ) : (
              <p
                className={`card-bio${onUpdate && !hasConlangLore ? " card-bio--editable" : ""}`}
                onClick={() => { if (onUpdate && !hasConlangLore) setEditingBio(true); }}
                title={onUpdate && !hasConlangLore ? "Click to edit bio" : undefined}
              >
                {localBio}
                {onUpdate && !hasConlangLore && <span className="card-edit-hint">✎</span>}
              </p>
            )
          )}

          {card.conlang?.catchphrase && (
            <p className="card-catchphrase">
              &ldquo;{card.conlang.catchphrase}&rdquo;
            </p>
          )}
          <div className="card-subline">
            <span>{displayedArchetype}</span>
            <span className="sep">·</span>
            <span>{card.prompts.style}</span>
          </div>
          <div className="card-subline">
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

        <div className="stat-flavor">
          {hasConlangLore && !showEnglish ? (
            <em className="stat-flavor-text conlang-text">
              &ldquo;{displayFlavorText}&rdquo;
            </em>
          ) : localBio && !onUpdate ? (
            <em className="stat-flavor-text">
              &ldquo;{localBio}&rdquo;
            </em>
          ) : null}
        </div>
      </div>

      {/* ── Bottom Half: Skateboard image and stats ── */}
      <div className="card-half">
        {/* Board loadout section — only shown if a board config is attached */}
        {card.board && (
          <div className="card-board">
            <span className="card-board__label">BOARD</span>
            {card.boardImageUrl ? (
              <img
                src={card.boardImageUrl}
                alt="Electric skateboard"
                className="card-board__generated-img"
              />
            ) : (
              <div className="card-board__placeholder">🛹</div>
            )}
            <div className="card-board__rows">
              <BoardRow
                icon={BOARD_TYPE_OPTIONS.find((o) => o.value === card.board!.boardType)?.icon ?? "🛹"}
                label="TYPE"
                value={card.board.boardType}
              />
              <BoardRow
                icon={DRIVETRAIN_OPTIONS.find((o) => o.value === card.board!.drivetrain)?.icon ?? "⚙️"}
                label="DRIVE"
                value={DRIVETRAIN_OPTIONS.find((o) => o.value === card.board!.drivetrain)?.label ?? card.board.drivetrain}
              />
              {card.board.motor && (
                <BoardRow
                  icon={MOTOR_OPTIONS.find((o) => o.value === card.board!.motor)?.icon ?? "⚡"}
                  label="MOTOR"
                  value={MOTOR_OPTIONS.find((o) => o.value === card.board!.motor)?.label ?? card.board.motor}
                />
              )}
              <BoardRow
                icon={WHEEL_OPTIONS.find((o) => o.value === card.board!.wheels)?.icon ?? "⚫"}
                label="WHEELS"
                value={card.board.wheels}
              />
              <BoardRow
                icon={BATTERY_OPTIONS.find((o) => o.value === card.board!.battery)?.icon ?? "🔋"}
                label="BATTERY"
                value={BATTERY_OPTIONS.find((o) => o.value === card.board!.battery)?.label ?? card.board.battery}
              />
            </div>
            {card.boardLoadout && (
              <SkateboardStatsPanel loadout={card.boardLoadout} />
            )}
          </div>
        )}

        <div className="card-stats">
          <StatBar label={CARD_STAT_LABELS.speed.label}   value={card.stats.speed}   color={accent} tooltip={CARD_STAT_LABELS.speed.tooltip} />
          <StatBar label={CARD_STAT_LABELS.stealth.label} value={card.stats.stealth} color={accent} tooltip={CARD_STAT_LABELS.stealth.tooltip} />
          <StatBar label={CARD_STAT_LABELS.tech.label}    value={card.stats.tech}    color={accent} tooltip={CARD_STAT_LABELS.tech.tooltip} />
          <StatBar label={CARD_STAT_LABELS.grit.label}    value={card.stats.grit}    color={accent} tooltip={CARD_STAT_LABELS.grit.tooltip} />
          <StatBar label={CARD_STAT_LABELS.rep.label}     value={card.stats.rep}     color={accent} tooltip={CARD_STAT_LABELS.rep.tooltip} />
          <div className="card-worth">
            <span className="card-worth-label">Worth</span>
            <span className="card-worth-value" style={{ color: accent }}>${computeCardWorth(card).toFixed(2)} Ozzies</span>
          </div>
          <div className="stat-active">
            <span className="stat-label" title="Active ability">Active</span>
            <div className="stat-active-body">
              <span className="stat-active-name">{card.traits.activeAbility.name}</span>
              <p className={`stat-active-desc${hasConlangLore && !showEnglish ? " conlang-text" : ""}`}>
                {activeAbilityDesc}
              </p>
            </div>
          </div>
        </div>

        <div className="card-personality">
          {card.traits.personalityTags.map((t) => (
            <span key={t} className="tag" style={{ borderColor: accent }}>{t}</span>
          ))}
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

        {!hideAllActions && (
        <div className="card-actions">
          {onSave && (
            <button
              className="btn-primary btn-sm"
              onClick={onSave}
              disabled={isSaved}
            >
              {saveLabel ?? (isSaved ? "✓ Saved" : "Save to Collection")}
            </button>
          )}
          {onEdit && (
            <button className="btn-outline btn-sm" onClick={onEdit}>
              ✎ Edit
            </button>
          )}
          {!hideToolButtons && (
            <>
              <button className="btn-outline btn-3d btn-sm" onClick={() => setViewing3D(true)} title="View card in 3D">
                ◈ 3D
              </button>
              <button className="btn-outline btn-sm" onClick={() => setPrinting(true)} title="Print this card">
                🖨 Print
              </button>
            </>
          )}
          {showShare && (
            <button className="btn-outline btn-sm" onClick={() => setSharing(true)}>
              ↗ Share
            </button>
          )}
          {onRemove && (
            <button className="btn-danger btn-sm" onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
        )}
      </div>

      {sharing && <ShareModal card={card} onClose={() => setSharing(false)} />}
      {!hideToolButtons && viewing3D && (
        <CardViewer3D
          card={card}
          backgroundImageUrl={resolvedBackground}
          characterImageUrl={resolvedCharacter}
          frameImageUrl={resolvedFrame}
          characterBlend={characterBlend}
          onClose={() => setViewing3D(false)}
        />
      )}
      {!hideToolButtons && printing && (
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

// ── Board row helper (used inside card-board section) ─────────────────────────

function BoardRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="card-board__row">
      <span className="card-board__icon">{icon}</span>
      <span className="card-board__key">{label}</span>
      <span className="card-board__val">{value}</span>
    </div>
  );
}
