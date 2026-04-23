import { memo, useState, useEffect } from "react";
import type { CardPayload } from "../lib/types";
import { CardArt } from "./CardArt";
import { FrameOverlay } from "./FrameOverlay";
import { StatBar } from "./StatBar";
import { ShareModal } from "./ShareModal";
import { CardViewer3D } from "./CardViewer3D";
import { PrintModal } from "./PrintModal";
import { getDisplayedArchetype } from "../lib/cardIdentity";
import { BOARD_TYPE_OPTIONS, DRIVETRAIN_OPTIONS, MOTOR_OPTIONS, WHEEL_OPTIONS, BATTERY_OPTIONS } from "../lib/boardBuilder";
import { SkateboardStatsPanel } from "./SkateboardStatsPanel";
import { computeCardWorth } from "../lib/battle";
import { CARD_STAT_LABELS } from "../lib/statLabels";
import { getFrameBlendMode, shouldInsetBackgroundForFrame, shouldRenderSvgFrame } from "../services/staticAssets";

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

function shallowEqualObject(
  previous: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): boolean {
  if (previous === next) return true;
  if (!previous || !next) return false;

  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) return false;
  const nextKeySet = new Set(nextKeys);

  return previousKeys.every((key) => nextKeySet.has(key) && previous[key] === next[key]);
}

function areCardsEqual(previous: CardPayload, next: CardPayload): boolean {
  if (previous === next) return true;

  return (
    previous.id === next.id &&
    previous.version === next.version &&
    previous.seed === next.seed &&
    previous.frameSeed === next.frameSeed &&
    previous.backgroundSeed === next.backgroundSeed &&
    previous.characterSeed === next.characterSeed &&
    previous.createdAt === next.createdAt &&
    previous.backgroundImageUrl === next.backgroundImageUrl &&
    previous.characterImageUrl === next.characterImageUrl &&
    previous.frameImageUrl === next.frameImageUrl &&
    shallowEqualObject(previous.prompts as unknown as Record<string, unknown>, next.prompts as unknown as Record<string, unknown>) &&
    shallowEqualObject(previous.identity as unknown as Record<string, unknown>, next.identity as unknown as Record<string, unknown>) &&
    shallowEqualObject(previous.class as unknown as Record<string, unknown>, next.class as unknown as Record<string, unknown>) &&
    shallowEqualObject(previous.role as unknown as Record<string, unknown>, next.role as unknown as Record<string, unknown>) &&
    shallowEqualObject(previous.stats as unknown as Record<string, unknown>, next.stats as unknown as Record<string, unknown>) &&
    shallowEqualObject(previous.visuals as unknown as Record<string, unknown>, next.visuals as unknown as Record<string, unknown>) &&
    shallowEqualObject(previous.front as unknown as Record<string, unknown>, next.front as unknown as Record<string, unknown>) &&
    shallowEqualObject(previous.back as unknown as Record<string, unknown>, next.back as unknown as Record<string, unknown>) &&
    shallowEqualObject(previous.maintenance as unknown as Record<string, unknown>, next.maintenance as unknown as Record<string, unknown>) &&
    previous.board.imageUrl === next.board.imageUrl &&
    previous.board.tuned === next.board.tuned
  );
}

function areLayerLoadingEqual(previous?: LayerLoading, next?: LayerLoading): boolean {
  if (previous === next) return true;
  if (!previous || !next) return false;
  return (
    previous.background === next.background &&
    previous.character === next.character &&
    previous.frame === next.frame
  );
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
  const backgroundLayerClassName = shouldInsetBackgroundForFrame(card.prompts.rarity, frameImageUrl)
    ? "card-art-layer card-art-layer--background card-art-layer--background-inset"
    : "card-art-layer card-art-layer--background";
  const showSvgFrame = shouldRenderSvgFrame(card.prompts.rarity, frameImageUrl);
  const frameLayerStyle = frameImageUrl
    ? { mixBlendMode: getFrameBlendMode(card.prompts.rarity, frameImageUrl) }
    : undefined;

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
          <img src="/assets/loading_2.gif" alt="Loading…" className="card-art-loading-gif" />
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
          <img src="/assets/loading_2.gif" alt="Loading…" className="card-art-loading-gif" />
        </div>
      ) : null}

      {/* Layer 3 – Frame (ornate rarity border, screen-blended AI image — used for Punch Skater) */}
      {frameImageUrl && !showSvgFrame ? (
        <img
          src={frameImageUrl}
          alt="frame"
          className="card-art-layer card-art-layer--frame"
          style={frameLayerStyle}
          onError={() => onLayerError?.("frame")}
        />
      ) : layerLoading?.frame ? (
        <div className="card-art-layer card-art-layer--frame card-art-layer--loading">
          <img src="/assets/loading_2.gif" alt="Loading…" className="card-art-loading-gif" />
        </div>
      ) : null}

      {/* Layer 4 – SVG neon border overlay for the four redesigned rarity frames */}
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

// ── Main component ─────────────────────────────────────────────────────────────

function CardDisplayComponent({
  card,
  compact = false,
  onSave,
  onRemove,
  onEdit,
  isSaved,
  showShare = false,
  saveLabel,
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

  // ── Inline editable name, age & bio ──────────────────────────────────────
  const [localName, setLocalName] = useState(card.identity.name);
  const [localAge, setLocalAge] = useState(card.identity.age ?? "");
  const [localBio, setLocalBio] = useState(card.front.flavorText ?? "");
  const [editingName, setEditingName] = useState(false);
  const [editingAge, setEditingAge] = useState(false);
  const [editingBio, setEditingBio] = useState(false);

  useEffect(() => {
    setLocalName(card.identity.name);
    setLocalAge(card.identity.age ?? "");
    setLocalBio(card.front.flavorText ?? "");
    setEditingName(false);
    setEditingAge(false);
    setEditingBio(false);
  }, [card.id, card.identity.name, card.identity.age, card.front.flavorText]);

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
    const trimmed = localBio.trim() || (card.front.flavorText ?? "");
    setLocalBio(trimmed);
    if (trimmed !== (card.front.flavorText ?? "")) onUpdate?.({ flavorText: trimmed });
  };

  const openMetadataEditor = () => {
    if (!onUpdate) return;
    setEditingName(true);
    setEditingAge(false);
    setEditingBio(false);
  };
  // ─────────────────────────────────────────────────────────────────────────

  const rarityColor = RARITY_COLORS[card.class.rarity] || "#aaaaaa";
  const accent = card.visuals.accentColor || "#00ff88";
  const displayedArchetype = getDisplayedArchetype(card);

  const resolvedBackground = backgroundImageUrl ?? card.backgroundImageUrl;
  const resolvedCharacter  = characterImageUrl  ?? card.characterImageUrl;
  const resolvedFrame      = frameImageUrl      ?? card.frameImageUrl;

  const hasLayeredImages = resolvedBackground || resolvedCharacter || resolvedFrame;
  const resolvedLayerLoading = layerLoading ?? { background: false, character: false, frame: false };

  if (compact) {
    return (
      <div className="card-compact">
        {imageLoading && !hasLayeredImages ? (
          <div className="card-art-skeleton">
            <img src="/assets/loading_2.gif" alt="Loading…" className="card-art-loading-gif" />
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
        ) : (
          <CardArt card={card} width={160} height={112} />
        )}
        <div className="card-compact-info">
          <span className="card-name">{card.identity.name}</span>
          <span className="card-rarity" style={{ color: rarityColor }}>{card.class.badgeLabel}</span>
          <span className="card-archetype">{displayedArchetype}</span>
          {card.board.tuned && <span className="card-compact-badge">⚡ Tuned</span>}
          {card.maintenance.state !== "active" && (
            <span className="card-compact-status">{card.maintenance.state.replace("_", " ")}</span>
          )}
        </div>
      </div>
    );
  }

  const bt = BOARD_TYPE_OPTIONS.find((o) => o.value === card.board.config.boardType);
  const dr = DRIVETRAIN_OPTIONS.find((o) => o.value === card.board.config.drivetrain);
  const mt = MOTOR_OPTIONS.find((o) => o.value === card.board.config.motor);
  const wh = WHEEL_OPTIONS.find((o) => o.value === card.board.config.wheels);
  const ba = BATTERY_OPTIONS.find((o) => o.value === card.board.config.battery);

  return (
    <div className="card-stack-shell">
      <div className="card-stack">
        <div className="card-full card-full--front" style={{ "--accent": accent } as React.CSSProperties}>
          <div className="card-header">
            <span className="card-serial">{card.identity.serialNumber}</span>
            <span className="card-rarity" style={{ color: rarityColor }}>{card.class.badgeLabel.toUpperCase()}</span>
          </div>

          {(layerLoading?.background || layerLoading?.character || layerLoading?.frame) && (
            <LayerStatusBadges loading={resolvedLayerLoading} />
          )}

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
              <img src="/assets/loading_2.gif" alt="Loading…" className="card-art-loading-gif" />
            </div>
          ) : (
            <CardArt card={card} width={200} height={140} />
          )}

          <div className="card-identity">
            {onUpdate && (
              <button
                type="button"
                className="card-meta-edit-button"
                onClick={openMetadataEditor}
              >
                ✎ Edit Bio / Name / Age
              </button>
            )}
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

            {(localBio || onUpdate) && (
              onUpdate && editingBio ? (
                <textarea
                  className="card-edit-textarea card-bio-textarea"
                  value={localBio}
                  onChange={(e) => setLocalBio(e.target.value)}
                  onBlur={commitBio}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setLocalBio(card.front.flavorText ?? ""); setEditingBio(false); }
                  }}
                  autoFocus
                  rows={3}
                  maxLength={200}
                />
              ) : (
                <p
                  className={`card-bio${onUpdate ? " card-bio--editable" : ""}`}
                  onClick={() => { if (onUpdate) setEditingBio(true); }}
                  title={onUpdate ? "Click to edit bio" : undefined}
                >
                  {localBio}
                  {onUpdate && <span className="card-edit-hint">✎</span>}
                </p>
              )
            )}

            <div className="card-subline">
              <span>{card.class.badgeLabel}</span>
              <span className="sep">·</span>
              <span>{displayedArchetype}</span>
              {card.board.tuned && (
                <>
                  <span className="sep">·</span>
                  <span className="card-tuned-badge">⚡ Tuned</span>
                </>
              )}
            </div>
            <div className="card-subline">
              <span style={{ opacity: 0.6 }}>{card.prompts.district}</span>
              <span className="sep">·</span>
              <span style={{ opacity: 0.6 }}>{card.identity.crew}</span>
            </div>
          </div>

          <div className="stat-flavor">
            {localBio && !onUpdate ? (
              <em className="stat-flavor-text">
                &ldquo;{localBio}&rdquo;
              </em>
            ) : null}
          </div>
        </div>

        <div className="card-full card-full--back" style={{ "--accent": accent } as React.CSSProperties}>
          <div className="card-header">
            <span className="card-serial">BACKSIDE</span>
            <span className="card-rarity" style={{ color: rarityColor }}>{card.class.badgeLabel.toUpperCase()}</span>
          </div>

          <div className="card-board">
            <span className="card-board__label">BOARD</span>
            {card.board.imageUrl ? (
              <img
                src={card.board.imageUrl}
                alt="Electric skateboard"
                className="card-board__generated-img"
              />
            ) : (
              <div className="card-board__placeholder">🛹</div>
            )}
            <div className="card-board__rows">
              <BoardRow icon={bt?.icon ?? "🛹"}  label="TYPE"    value={bt?.label ?? card.board.components.boardType} />
              <BoardRow icon={dr?.icon ?? "⚙️"}  label="DRIVE"   value={dr?.label ?? card.board.components.drivetrain} />
              <BoardRow icon={mt?.icon ?? "⚡"}   label="MOTOR"   value={mt?.label ?? card.board.components.motor} />
              <BoardRow icon={wh?.icon ?? "⚫"}   label="WHEELS"  value={wh?.label ?? card.board.components.wheels} />
              <BoardRow icon={ba?.icon ?? "🔋"}   label="BATTERY" value={ba?.label ?? card.board.components.battery} />
            </div>
            {card.board.loadout && (
              <SkateboardStatsPanel loadout={card.board.loadout} />
            )}
          </div>

          <div className="card-stats">
            <StatBar label={CARD_STAT_LABELS.speed.label}   value={card.stats.speed}   color={accent} tooltip={CARD_STAT_LABELS.speed.tooltip} />
            <StatBar label={CARD_STAT_LABELS.range.label}   value={card.stats.range}   color={accent} tooltip={CARD_STAT_LABELS.range.tooltip} />
            <StatBar label={CARD_STAT_LABELS.stealth.label} value={card.stats.stealth} color={accent} tooltip={CARD_STAT_LABELS.stealth.tooltip} />
            <StatBar label={CARD_STAT_LABELS.grit.label}    value={card.stats.grit}    color={accent} tooltip={CARD_STAT_LABELS.grit.tooltip} />
            <div className="card-worth">
              <span className="card-worth-label">Worth</span>
              <span className="card-worth-value" style={{ color: accent }}>{computeCardWorth(card)} pts</span>
            </div>
          </div>

          <div className="card-traits">
            <div className="trait">
              <span className="trait-label">PASSIVE</span>
              <span className="trait-name">{card.role.passiveName}</span>
              <p className="trait-desc">{card.role.passiveDescription}</p>
            </div>
          </div>

          <div className="card-maintenance">
            <span className="maint-label">MAINTENANCE</span>
            <span className="maint-state">{card.maintenance.state.replace("_", " ")}</span>
            <span className="maint-charge">{card.maintenance.chargePct}%</span>
          </div>
        </div>
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

function areCardDisplayPropsEqual(previous: CardDisplayProps, next: CardDisplayProps): boolean {
  return (
    areCardsEqual(previous.card, next.card) &&
    previous.compact === next.compact &&
    previous.onSave === next.onSave &&
    previous.onRemove === next.onRemove &&
    previous.onEdit === next.onEdit &&
    previous.isSaved === next.isSaved &&
    previous.showShare === next.showShare &&
    previous.saveLabel === next.saveLabel &&
    previous.imageLoading === next.imageLoading &&
    previous.backgroundImageUrl === next.backgroundImageUrl &&
    previous.characterImageUrl === next.characterImageUrl &&
    previous.frameImageUrl === next.frameImageUrl &&
    areLayerLoadingEqual(previous.layerLoading, next.layerLoading) &&
    previous.characterBlend === next.characterBlend &&
    previous.hideToolButtons === next.hideToolButtons &&
    previous.hideAllActions === next.hideAllActions &&
    previous.onUpdate === next.onUpdate &&
    previous.onLayerError === next.onLayerError
  );
}

export const CardDisplay = memo(CardDisplayComponent, areCardDisplayPropsEqual);
CardDisplay.displayName = "CardDisplay";

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
