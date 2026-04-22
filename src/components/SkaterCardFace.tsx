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
import {
  getFrameBlendMode,
  shouldInsetBackgroundForFrame,
  shouldRenderSvgFrame,
} from "../services/staticAssets";

// ── Module-level typed constant to avoid repeated inline type assertions ──────

type StatEntry = [keyof CardPayload["stats"], { label: string; tooltip: string }];
const STAT_ENTRIES = Object.entries(CARD_STAT_LABELS) as StatEntry[];

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
  const revealedFaction = card.discovery?.revealedFaction;
  const bgClass = shouldInsetBackgroundForFrame(card.prompts.rarity, frameImageUrl)
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
            <img src={backgroundImageUrl} alt="background" className={bgClass} />
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
              className="print-art-layer print-art-layer--frame"
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
            <input
              className="card-age-input"
              value={card.identity.age ?? ""}
              onChange={(e) => onAgeChange?.(e.target.value)}
              placeholder="Age"
            />
            <textarea
              className="card-bio-input"
              value={card.flavorText}
              onChange={(e) => onBioChange?.(e.target.value)}
              placeholder="Bio / flavor text"
              rows={2}
            />
            {revealedFaction && (
              <p className="print-front-faction">Faction Reveal · {revealedFaction}</p>
            )}
          </>
        ) : (
          <>
            <span className="print-front-name">{card.identity.name}</span>
            {card.identity.age && (
              <span className="print-front-age">{card.identity.age}</span>
            )}
            <p className="print-front-bio">&ldquo;{card.flavorText}&rdquo;</p>
            {revealedFaction && (
              <p className="print-front-faction">Faction Reveal · {revealedFaction}</p>
            )}
          </>
        )}
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
          ) : boardImageLoading ? (
            /* 1:1 square spinner — matches the final image container so there
               is no layout shift when the board image finishes loading.
               Drop a hourglass-spinner.gif at public/assets/hourglass-spinner.gif
               and it will appear here automatically; falls back to the standard
               animated loading gif if the file is not yet present. */
            <div className="print-back-board-loading">
              <img
                src="/assets/hourglass-spinner.gif"
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
      )}

      <div className="print-back-stats">
        {editable ? (
          (STAT_ENTRIES).map(([key, { label, tooltip }]) => (
              <div key={key} className="stat-bar card-stat-editor-row">
                <span className="stat-label" title={tooltip}>{label}</span>
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
            ),
          )
        ) : (
          <>
            <StatBar label={CARD_STAT_LABELS.speed.label}   value={card.stats.speed}   color={accent} tooltip={CARD_STAT_LABELS.speed.tooltip} />
            <StatBar label={CARD_STAT_LABELS.stealth.label} value={card.stats.stealth} color={accent} tooltip={CARD_STAT_LABELS.stealth.tooltip} />
            <StatBar label={CARD_STAT_LABELS.tech.label}    value={card.stats.tech}    color={accent} tooltip={CARD_STAT_LABELS.tech.tooltip} />
            <StatBar label={CARD_STAT_LABELS.grit.label}    value={card.stats.grit}    color={accent} tooltip={CARD_STAT_LABELS.grit.tooltip} />
            <StatBar label={CARD_STAT_LABELS.rep.label}     value={card.stats.rep}     color={accent} tooltip={CARD_STAT_LABELS.rep.tooltip} />
          </>
        )}
      </div>

      <div className="print-back-info">
        {(
          [
            ["ARCHETYPE", getDisplayedArchetype(card)],
            ["STYLE",     card.prompts.style],
            ["DISTRICT",  card.prompts.district],
            ["CREW",      getDisplayedCrew(card)],
          ] as [string, string][]
        ).map(([label, value]) => (
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
          <span key={tag} className="print-back-tag" style={{ borderColor: accent }}>
            {tag}
          </span>
        ))}
      </div>

      <div className="print-back-serial">{card.identity.serialNumber}</div>
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
