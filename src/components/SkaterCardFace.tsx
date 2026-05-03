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

import { useCallback, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { BoardPlacement, CardPayload, CharacterPlacement, LayerPlacement } from "../lib/types";
import { CardArt } from "./CardArt";
import { FrameOverlay } from "./FrameOverlay";
import { StatBar } from "./StatBar";
import { getDisplayedCrew } from "../lib/cardIdentity";
import { CARD_STAT_LABELS } from "../lib/statLabels";
import stamp360Gif from "../../stamp360.gif";
import { InsetNeonTube } from "./InsetNeonTube";
import { hasBuiltInFrameDesignator, RARITY_COLORS } from "../lib/cardRarityVisuals";
import {
  getFrameBlendMode,
  getStaticFrameBackUrl,
  shouldInsetBackgroundForFrame,
  shouldRenderSvgFrame,
} from "../services/staticAssets";
import { computeFocalCrop } from "../lib/focalCrop";
import { resolveBoardPoseScene } from "../lib/boardPoseScenes";
import {
  buildBoardPlacementStyle,
  buildCharacterPlacementStyle,
  CHARACTER_LAYER_Z_INDEX,
  getBoardLayerZIndex,
  normalizeBoardPlacement,
  normalizeCharacterPlacement,
  resolveBoardLayerOrder,
} from "../lib/boardPlacement";
import { BOARD_TYPE_OPTIONS, DRIVETRAIN_OPTIONS, MOTOR_OPTIONS, WHEEL_OPTIONS, BATTERY_OPTIONS } from "../lib/boardBuilder";

// ── Rarity colour map used on the card-back header ───────────────────────────

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
  onBoardPlacementChange?: (placement: BoardPlacement) => void;
  onCharacterPlacementChange?: (placement: CharacterPlacement) => void;
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

interface PointerPoint {
  x: number;
  y: number;
}

interface PlacementGestureOptions<TPlacement extends LayerPlacement> {
  editable: boolean;
  placement: TPlacement;
  normalizePlacement: (placement: Partial<TPlacement>) => TPlacement;
  onPlacementChange?: (placement: TPlacement) => void;
}

function getPointerCenter(points: PointerPoint[]): PointerPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  const total = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / points.length, y: total.y / points.length };
}

function getPointerDistance(first: PointerPoint, second: PointerPoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function getPointerAngle(first: PointerPoint, second: PointerPoint): number {
  return Math.atan2(second.y - first.y, second.x - first.x) * (180 / Math.PI);
}

function normalizeAngleDeltaTo180Range(angle: number): number {
  if (angle > 180) return angle - 360;
  if (angle < -180) return angle + 360;
  return angle;
}

function usePlacementGesture<TPlacement extends LayerPlacement>({
  editable,
  placement,
  normalizePlacement,
  onPlacementChange,
}: PlacementGestureOptions<TPlacement>) {
  const activePointersRef = useRef(new Map<number, PointerPoint>());
  const currentPlacementRef = useRef(placement);
  const baselineRef = useRef<{
    placement: TPlacement;
    center: PointerPoint;
    distance: number;
    angle: number;
  } | null>(null);
  currentPlacementRef.current = placement;

  const resetBaseline = useCallback(() => {
    const points = [...activePointersRef.current.values()];
    if (points.length === 0) {
      baselineRef.current = null;
      return;
    }

    const center = getPointerCenter(points);
    const [firstPoint, secondPoint] = points;
    baselineRef.current = {
      placement: currentPlacementRef.current,
      center,
      distance: points.length >= 2 ? getPointerDistance(firstPoint, secondPoint) : 0,
      angle: points.length >= 2 ? getPointerAngle(firstPoint, secondPoint) : currentPlacementRef.current.rotationDeg,
    };
  }, []);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!editable || !onPlacementChange || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    resetBaseline();
  }, [editable, onPlacementChange, resetBaseline]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!editable || !onPlacementChange || !activePointersRef.current.has(event.pointerId)) {
      return;
    }

    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...activePointersRef.current.values()];
    const baseline = baselineRef.current;
    const container = event.currentTarget.parentElement;
    if (!baseline || !container || points.length === 0) return;

    const rect = container.getBoundingClientRect();
    const center = getPointerCenter(points);
    const deltaXPercent = ((center.x - baseline.center.x) / rect.width) * 100;
    const deltaYPercent = ((center.y - baseline.center.y) / rect.height) * 100;
    const nextPlacement: Partial<TPlacement> = {
      ...baseline.placement,
      xPercent: baseline.placement.xPercent + deltaXPercent,
      yPercent: baseline.placement.yPercent + deltaYPercent,
    };

    if (points.length >= 2) {
      const [firstPoint, secondPoint] = points;
      const distance = getPointerDistance(firstPoint, secondPoint);
      const angle = getPointerAngle(firstPoint, secondPoint);
      const scaleRatio = baseline.distance > 0 ? distance / baseline.distance : 1;
      nextPlacement.scale = baseline.placement.scale * scaleRatio;
      nextPlacement.rotationDeg = baseline.placement.rotationDeg + normalizeAngleDeltaTo180Range(angle - baseline.angle);
    }

    event.preventDefault();
    const normalizedPlacement = normalizePlacement(nextPlacement);
    currentPlacementRef.current = normalizedPlacement;
    onPlacementChange(normalizedPlacement);
  }, [editable, normalizePlacement, onPlacementChange]);

  const handlePointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return;

    activePointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resetBaseline();
  }, [resetBaseline]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
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
  onBoardPlacementChange,
  onCharacterPlacementChange,
}: Omit<SkaterCardFaceProps, "face" | "onStatChange" | "onBioChange" | "onAgeChange">) {
  const [boardImageFailed, setBoardImageFailed] = useState(false);
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
  const boardPoseScene = resolveBoardPoseScene(card.characterSeed);
  const boardLayerOrder = resolveBoardLayerOrder(card.board.layerOrder);
  const showExactBoardLayer = Boolean(card.board.imageUrl && (backgroundImageUrl || characterImageUrl));
  const boardPlacement = normalizeBoardPlacement(boardPoseScene.key, card.board.placement);
  const boardPlacementStyle = {
    ...buildBoardPlacementStyle(boardPoseScene.key, boardPlacement),
    zIndex: getBoardLayerZIndex(boardLayerOrder),
  };
  const characterPlacement = normalizeCharacterPlacement(card.characterPlacement);
  const characterPlacementStyle = {
    ...buildCharacterPlacementStyle(characterPlacement),
    opacity: characterBlend,
    zIndex: CHARACTER_LAYER_Z_INDEX,
  };
  const boardPlacementChangeHandler = editable ? onBoardPlacementChange : undefined;
  const characterPlacementChangeHandler = editable ? onCharacterPlacementChange : undefined;
  const boardGesture = usePlacementGesture({
    editable,
    placement: boardPlacement,
    normalizePlacement: (nextPlacement) => normalizeBoardPlacement(boardPoseScene.key, nextPlacement),
    onPlacementChange: boardPlacementChangeHandler,
  });
  const characterGesture = usePlacementGesture({
    editable,
    placement: characterPlacement,
    normalizePlacement: normalizeCharacterPlacement,
    onPlacementChange: characterPlacementChangeHandler,
  });

  // Focal-crop background when the rarity has a dual-face PNG frame.
  const bgStyle: React.CSSProperties | undefined = (backgroundImageUrl && hasBackFrame)
    ? {
        objectFit: "cover",
        objectPosition: computeFocalCrop(card.frameSeed, "front").objectPosition,
      }
    : undefined;

  const nameField = editable ? (
    <input
      className="card-name-input"
      value={card.identity.name}
      onChange={(e) => onNameChange?.(e.target.value)}
      placeholder="Name"
    />
  ) : (
    <span className="print-front-name">{card.identity.name}</span>
  );

  return (
    <>
      {hasAnyLayer ? (
        <div className="print-art-composite">
          {backgroundImageUrl && (
            <img src={backgroundImageUrl} alt="background" className={bgClass} style={bgStyle} />
          )}
          <InsetNeonTube rarity={card.prompts.rarity} accentColor={card.visuals.accentColor} />
          {showExactBoardLayer && card.board.imageUrl && !boardImageFailed && (
            <div
              className={`print-art-layer print-art-layer--board-exact${boardPlacementChangeHandler ? " print-art-layer--board-editable" : ""}`}
              style={boardPlacementStyle}
              role={boardPlacementChangeHandler ? "img" : undefined}
              aria-label={boardPlacementChangeHandler ? "Editable skateboard. Drag to reposition, or pinch and rotate on touch devices." : undefined}
              onPointerDown={boardGesture.handlePointerDown}
              onPointerMove={boardGesture.handlePointerMove}
              onPointerUp={boardGesture.handlePointerUp}
              onPointerCancel={boardGesture.handlePointerUp}
            >
              <img
                src={card.board.imageUrl}
                alt="exact generated skateboard"
                className="print-art-layer--board-image"
                draggable={false}
                onError={() => setBoardImageFailed(true)}
              />
            </div>
          )}
          {characterImageUrl && (
            <div
              className={`print-art-layer print-art-layer--char${characterPlacementChangeHandler ? " print-art-layer--char-editable" : ""}`}
              style={characterPlacementStyle}
              role={characterPlacementChangeHandler ? "img" : undefined}
              aria-label={characterPlacementChangeHandler ? "Editable character. Drag to reposition, or pinch and rotate on touch devices." : undefined}
              onPointerDown={characterGesture.handlePointerDown}
              onPointerMove={characterGesture.handlePointerMove}
              onPointerUp={characterGesture.handlePointerUp}
              onPointerCancel={characterGesture.handlePointerUp}
            >
              <img
                src={characterImageUrl}
                alt="character"
                className="print-art-layer--char-image"
              />
            </div>
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

      <div className="print-front-name-overlay">
        {nameField}
      </div>
    </>
  );
}

// ── Back face ─────────────────────────────────────────────────────────────────

function CardBack({
  card,
  editable = false,
  onNameChange,
  onBioChange,
  onAgeChange,
  onStatChange,
  boardImageLoading = false,
}: Pick<SkaterCardFaceProps, "card" | "editable" | "onNameChange" | "onBioChange" | "onAgeChange" | "onStatChange" | "boardImageLoading">) {
  const [boardImageFailed, setBoardImageFailed] = useState(false);
  const accent = card.visuals.accentColor || "#00ff88";
  const rarityColor = RARITY_COLORS[card.prompts.rarity] || "#aaaaaa";
  const hasBuiltInDesignator = hasBuiltInFrameDesignator(card.prompts.rarity);
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
    ["DISTRICT", card.prompts.district],
    ["CREW",     getDisplayedCrew(card)],
  ] as [string, string][];

  const flavorText = card.front.flavorTextEnglish ?? card.front.flavorText ?? "";
  const conlangFlavorText = card.front.flavorTextConlang ?? "";

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
      <div className="print-back-identity">
        {editable ? (
          <input
            className="card-name-input print-back-identity-name-input"
            value={card.identity.name}
            onChange={(e) => onNameChange?.(e.target.value)}
            placeholder="Name"
          />
        ) : (
          <span className="print-back-identity-name">{card.identity.name}</span>
        )}
        <div className="print-back-identity-meta">
          {!hasBuiltInDesignator && <span className="print-back-identity-badge">{card.class.badgeLabel}</span>}
          <span className="print-back-identity-role">{card.role.label}</span>
          {card.board.tuned && <span className="print-back-identity-tuned">⚡ TUNED</span>}
          {card.identity.age && (
            editable ? (
              <label className="print-back-identity-age-field">
                <span className="print-back-identity-age-label">AGE</span>
                <input
                  className="card-age-input print-back-identity-age-input"
                  value={card.identity.age ?? ""}
                  onChange={(e) => onAgeChange?.(e.target.value)}
                  placeholder="Age"
                />
              </label>
            ) : (
              <span className="print-back-identity-age">{card.identity.age}</span>
            )
          )}
        </div>
        {editable ? (
          <textarea
            className="card-bio-input print-back-identity-bio-input"
            value={flavorText}
            onChange={(e) => onBioChange?.(e.target.value)}
            placeholder="Bio / flavor text"
            rows={2}
          />
        ) : (
          <>
            {flavorText && (
              <p className="print-back-identity-bio">&ldquo;{flavorText}&rdquo;</p>
            )}
            {conlangFlavorText && (
              <p className="print-back-identity-bio print-back-identity-bio--conlang">{conlangFlavorText}</p>
            )}
          </>
        )}
      </div>

      <div className="print-back-hero">
        <div className="print-back-board">
          {card.board.imageUrl && !boardImageFailed ? (
            <img
              src={card.board.imageUrl}
              alt="Electric skateboard"
              className="print-back-board-image"
              onError={() => setBoardImageFailed(true)}
            />
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
        {!hasBuiltInDesignator && (
          <div className="print-back-rarity-row">
            <span className="print-back-rarity-label" style={{ color: rarityColor }}>
              {card.prompts.rarity.toUpperCase()}
            </span>
          </div>
        )}
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
  onBoardPlacementChange,
  onCharacterPlacementChange,
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
        onBoardPlacementChange={onBoardPlacementChange}
        onCharacterPlacementChange={onCharacterPlacementChange}
      />
    );
  }

  return (
    <CardBack
      card={card}
      editable={editable}
      onNameChange={onNameChange}
      onBioChange={onBioChange}
      onAgeChange={onAgeChange}
      onStatChange={onStatChange}
      boardImageLoading={boardImageLoading}
    />
  );
}
