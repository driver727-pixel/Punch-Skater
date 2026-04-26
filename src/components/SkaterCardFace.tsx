/**
 * SkaterCardFace — the single source of truth for card face rendering.
 *
 * Use this component for the Card Editor, the ◈ 3D view, and the 🖨 Print
 * preview.  Pass `face="front"` or `face="back"` to select which side to
 * render.  All three contexts use exactly the same component and CSS classes;
 * the only difference is the container that wraps them (CardContainer for the
 * Editor/Print preview, viewer3d-card for the 3D CSS-transform view).
 *
 * Internal sizing uses CSS variables (--card-name-size, --card-back-body-size,
 * --stat-font-size, etc.) so a parent container can rescale every element by
 * overriding a single token.  Use buildCardVars() to produce the right token
 * set for each context.
 */

import type { CardPayload } from "../lib/types";
import { CardArt } from "./CardArt";
import { FrameOverlay } from "./FrameOverlay";
import { StatBar } from "./StatBar";
import { getDisplayedArchetype, getDisplayedCrew } from "../lib/cardIdentity";
import { CARD_STAT_LABELS } from "../lib/statLabels";
import stamp360Gif from "../../stamp360.gif";
import {
  getFrameBlendMode,
  getStaticFrameBackUrl,
  shouldInsetBackgroundForFrame,
  shouldRenderSvgFrame,
} from "../services/staticAssets";
import { computeFocalCrop } from "../lib/focalCrop";
import { BOARD_TYPE_OPTIONS, DRIVETRAIN_OPTIONS, MOTOR_OPTIONS, WHEEL_OPTIONS, BATTERY_OPTIONS } from "../lib/boardBuilder";

// ── Rarity colour map used on the card-back header ───────────────────────────

const RARITY_COLORS: Record<string, string> = {
  "Punch Skater": "#aa9988",
  Apprentice: "#44ddaa",
  Master: "#cc44ff",
  Rare: "#4488ff",
  Legendary: "#ffaa00",
};

export interface SkaterCardFaceProps {
  /** The fully generated card to render. */
  card: CardPayload;
  /** Which face to show. */
  face: "front" | "back";
  backgroundImageUrl?: string;
  characterImageUrl?: string;
  frameImageUrl?: string;
  /** Opacity blend for the character layer (0–1). */
  characterBlend?: number;
  /** Fallback art width when no layer images are provided (px). */
  fallbackWidth?: number;
  /** Fallback art height when no layer images are provided (px). */
  fallbackHeight?: number;
  /** When true, name/bio/age (front) and stats (back) become editable inputs. */
  editable?: boolean;
  onNameChange?: (value: string) => void;
  onBioChange?: (value: string) => void;
  onAgeChange?: (value: string) => void;
  onStatChange?: (key: keyof CardPayload["stats"], value: number) => void;
  /**
   * When true, the board image slot on the back face shows a loading spinner
   * instead of the 🛹 placeholder.  Used by the Card Editor while
   * generateGouacheBoard() is in flight.
   */
  boardImageLoading?: boolean;
}

// ── Front face ────────────────────────────────────────────────────────────────

function CardFront({
  card,
  backgroundImageUrl,
  characterImageUrl,
  frameImageUrl,
  characterBlend,
  fallbackWidth = 189,
  fallbackHeight = 264,
  editable = false,
  onNameChange,
  onBioChange,
  onAgeChange,
}: Omit<SkaterCardFaceProps, "face" | "onStatChange">) {
  const hasAnyLayer = backgroundImageUrl || characterImageUrl || frameImageUrl;
  const bgClass = shouldInsetBackgroundForFrame(card.prompts.rarity, frameImageUrl)
    ? "print-art-layer print-art-layer--bg print-art-layer--bg-inset"
    : "print-art-layer print-art-layer--bg";
  const showSvgFrame = shouldRenderSvgFrame(card.prompts.rarity, frameImageUrl);
  const hasBackFrame = getStaticFrameBackUrl(card.prompts.rarity) != null;
  const frameLayerStyle = frameImageUrl
    ? { mixBlendMode: getFrameBlendMode(card.prompts.rarity, frameImageUrl) }
    : undefined;
  const frameLayerClass = hasBackFrame
    ? "print-art-layer print-art-layer--frame print-art-layer--frame-wrap"
    : "print-art-layer print-art-layer--frame";

  // Focal-crop background when the rarity has a dual-face PNG frame.
  const bgStyle: React.CSSProperties | undefined = (backgroundImageUrl && hasBackFrame)
    ? {
        objectFit: "cover",
        objectPosition: computeFocalCrop(card.frameSeed, "front").objectPosition,
      }
    : undefined;

  const flavorText = card.front.flavorText ?? "";

  return (
    <>
      {hasAnyLayer ? (
        <div className="print-art-composite">
          {backgroundImageUrl && (
            <img src={backgroundImageUrl} alt="background" className={bgClass} style={bgStyle} />
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
            <img
              src={frameImageUrl}
              alt="frame"
              className={frameLayerClass}
              style={frameLayerStyle}
            />
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
        {editable ? (
          <>
            <input
              className="card-name-input"
              value={card.identity.name}
              onChange={(e) => onNameChange?.(e.target.value)}
              placeholder="Name"
            />
            <label className="card-age-field">
              <span className="card-age-label">AGE</span>
              <input
                className="card-age-input"
                value={card.identity.age ?? ""}
                onChange={(e) => onAgeChange?.(e.target.value)}
                placeholder="Age"
              />
            </label>
            <textarea
              className="card-bio-input"
              value={flavorText}
              onChange={(e) => onBioChange?.(e.target.value)}
              placeholder="Bio / flavor text"
              rows={2}
            />
          </>
        ) : (
          <>
            <span className="print-front-name">{card.identity.name}</span>
            {card.identity.age && (
              <span className="print-front-age">{card.identity.age}</span>
            )}
            {flavorText && (
              <p className="print-front-bio">&ldquo;{flavorText}&rdquo;</p>
            )}
          </>
        )}

        <div className="print-front-class-role">
          <span className="print-front-badge">{card.class.badgeLabel}</span>
          <span className="print-front-role">{card.role.label}</span>
          {card.board.tuned && <span className="print-front-tuned">⚡ Tuned</span>}
        </div>
      </div>
    </>
  );
}

// ── Back face ─────────────────────────────────────────────────────────────────

function CardBack({
  card,
  editable = false,
  onStatChange,
  boardImageLoading = false,
}: Pick<SkaterCardFaceProps, "card" | "editable" | "onStatChange" | "boardImageLoading">) {
  const accent = card.visuals.accentColor || "#00ff88";
  const rarityColor = RARITY_COLORS[card.prompts.rarity] || "#aaaaaa";
  const backFrameUrl = getStaticFrameBackUrl(card.prompts.rarity);
  const hasBackFrame = backFrameUrl != null;
  const backFrameStyle = backFrameUrl
    ? { mixBlendMode: getFrameBlendMode(card.prompts.rarity, backFrameUrl) }
    : undefined;
  const backFrameClass = hasBackFrame
    ? "print-art-layer print-art-layer--frame print-art-layer--frame-back print-art-layer--frame-wrap"
    : "print-art-layer print-art-layer--frame print-art-layer--frame-back";

  // Focal-crop background is no longer used on the back face.
  const backInfoRows = [
    ["ROLE",     getDisplayedArchetype(card)],
    ["COVER",    card.role.coverRole],
    ["DISTRICT", card.prompts.district],
    ["CREW",     getDisplayedCrew(card)],
    ["SERIAL",   card.identity.serialNumber],
  ] as [string, string][];

  const bt = BOARD_TYPE_OPTIONS.find((o) => o.value === card.board.config.boardType);
  const dr = DRIVETRAIN_OPTIONS.find((o) => o.value === card.board.config.drivetrain);
  const mt = MOTOR_OPTIONS.find((o) => o.value === card.board.config.motor);
  const wh = WHEEL_OPTIONS.find((o) => o.value === card.board.config.wheels);
  const ba = BATTERY_OPTIONS.find((o) => o.value === card.board.config.battery);
  const boardRows = [
    { icon: bt?.icon ?? "🛹",  label: "TYPE",    value: bt?.label ?? card.board.components.boardType },
    { icon: dr?.icon ?? "⚙️", label: "DRIVE",   value: dr?.label ?? card.board.components.drivetrain },
    { icon: mt?.icon ?? "⚡",  label: "MOTOR",   value: mt?.label ?? card.board.components.motor },
    { icon: wh?.icon ?? "⚫",  label: "WHEELS",  value: wh?.label ?? card.board.components.wheels },
    { icon: ba?.icon ?? "🔋",  label: "BATTERY", value: ba?.label ?? card.board.components.battery },
  ];

  return (
    <>
      <div className="print-back-header-slim">
        {card.board.tuned && <span className="print-back-tuned">⚡ TUNED</span>}
      </div>

      <div className="print-back-hero">
        <div className="print-back-board">
          {card.board.imageUrl ? (
            <img src={card.board.imageUrl} alt="Electric skateboard" className="print-back-board-image" />
          ) : boardImageLoading ? (
            <div className="print-back-board-loading">
              <img
                src={stamp360Gif}
                alt="Generating skateboard…"
                className="print-back-board-spinner"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  if (!img.dataset.fallback) {
                    img.dataset.fallback = "1";
                    img.src = "/assets/loading_2.gif";
                  }
                }}
              />
            </div>
          ) : (
            <div className="print-back-board-placeholder">🛹</div>
          )}
        </div>
      </div>

      <div className="print-back-info">
        {backInfoRows.map(([label, value]) => (
          <div key={label} className="print-back-row">
            <span className="print-back-row-label">{label}</span>
            <span className="print-back-row-value">{value}</span>
          </div>
        ))}
      </div>

      <div className="print-back-lower">
        <div className="print-back-components">
          {boardRows.map(({ icon, label, value }) => (
            <div key={label} className="print-back-board-row">
              <span className="print-back-board-icon">{icon}</span>
              <span className="print-back-board-key">{label}</span>
              <span className="print-back-board-val">{value}</span>
            </div>
          ))}
        </div>

      <div className="print-back-stats">
        <div className="print-back-rarity-row">
          <span className="print-back-rarity-label" style={{ color: rarityColor }}>
            {card.prompts.rarity.toUpperCase()}
          </span>
        </div>
        {editable ? (
          (["speed", "range", "stealth", "grit"] as const).map((key) => (
            <div key={key} className="stat-bar card-stat-editor-row">
              <span className="stat-label" title={CARD_STAT_LABELS[key].tooltip}>{CARD_STAT_LABELS[key].label}</span>
              <input
                type="number"
                className="card-stat-input"
                min={0}
                max={10}
                value={card.stats[key]}
                onChange={(e) => onStatChange?.(key, Number(e.target.value))}
                onBlur={(e) =>
                  onStatChange?.(key, Math.max(0, Math.min(10, Number(e.target.value))))
                }
              />
            </div>
          ))
        ) : (
          <>
            <StatBar label={CARD_STAT_LABELS.speed.label}   value={card.stats.speed}   color={accent} tooltip={CARD_STAT_LABELS.speed.tooltip} />
            <StatBar label={CARD_STAT_LABELS.range.label}   value={card.stats.range}   color={accent} tooltip={CARD_STAT_LABELS.range.tooltip} />
            <StatBar label={CARD_STAT_LABELS.stealth.label} value={card.stats.stealth} color={accent} tooltip={CARD_STAT_LABELS.stealth.tooltip} />
            <StatBar label={CARD_STAT_LABELS.grit.label}    value={card.stats.grit}    color={accent} tooltip={CARD_STAT_LABELS.grit.tooltip} />
            <div className="stat-bar stat-rangeNm">
              <span className="stat-label" title={CARD_STAT_LABELS.rangeNm.tooltip}>{CARD_STAT_LABELS.rangeNm.label}</span>
              <span className="stat-value">{card.stats.rangeNm} nm</span>
            </div>
          </>
        )}
      </div>
      </div>

      <div className="print-back-trait">
        <span className="print-back-trait-label">
          PASSIVE · {card.role.passiveName}
        </span>
        <p className="print-back-trait-desc">{card.role.passiveDescription}</p>
      </div>

      <div className="print-back-maintenance">
        <span className="print-back-maint-label">MAINTENANCE</span>
        <span className="print-back-maint-state">{card.maintenance.state.replace("_", " ")}</span>
        <span className="print-back-maint-charge">{card.maintenance.chargePct}%</span>
      </div>

      <div className="print-back-serial">{card.identity.serialNumber}</div>

      {backFrameUrl && (
        <img
          src={backFrameUrl}
          alt="frame"
          className={backFrameClass}
          style={backFrameStyle}
        />
      )}
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

/**
 * The single source of truth for rendering one face of a Punch Skater card.
 * Wrap in a `div.print-card` (with appropriate modifier classes) and a
 * `CardContainer` carrying the right CSS-variable token set.
 */
export function SkaterCardFace({
  face,
  card,
  backgroundImageUrl,
  characterImageUrl,
  frameImageUrl,
  characterBlend,
  fallbackWidth,
  fallbackHeight,
  editable,
  onNameChange,
  onBioChange,
  onAgeChange,
  onStatChange,
  boardImageLoading,
}: SkaterCardFaceProps) {
  if (face === "front") {
    return (
      <CardFront
        card={card}
        backgroundImageUrl={backgroundImageUrl}
        characterImageUrl={characterImageUrl}
        frameImageUrl={frameImageUrl}
        characterBlend={characterBlend}
        fallbackWidth={fallbackWidth}
        fallbackHeight={fallbackHeight}
        editable={editable}
        onNameChange={onNameChange}
        onBioChange={onBioChange}
        onAgeChange={onAgeChange}
      />
    );
  }

  return (
    <CardBack
      card={card}
      editable={editable}
      onStatChange={onStatChange}
      boardImageLoading={boardImageLoading}
    />
  );
}
