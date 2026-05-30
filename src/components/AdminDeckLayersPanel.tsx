import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auth } from "../lib/firebase";
import type { CardPayload } from "../lib/types";
import { DISTRICT_RIVALS, type DistrictRival } from "../lib/rivals";
import {
  buildBoardPlacementStyle,
  buildCharacterPlacementStyle,
  buildWeaponPlacementStyle,
  CHARACTER_LAYER_Z_INDEX,
  getBoardPlacementBox,
  getBoardLayerZIndex,
  getCharacterPlacementBox,
  getWeaponPlacementBox,
  normalizeBoardPlacement,
  normalizeCharacterPlacement,
  normalizeWeaponPlacement,
  WEAPON_LAYER_Z_INDEX,
} from "../lib/boardPlacement";
import { resolveBoardPoseScene } from "../lib/boardPoseScenes";
import {
  getFrameBlendMode,
  getStaticFrameBackUrl,
  shouldInsetBackgroundForFrame,
} from "../services/staticAssets";
import { resolveAdminActionUrl } from "../lib/apiUrls";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminDeck {
  id: string;
  ownerUid: string;
  name: string;
  isPrimary: boolean;
  battleReady: boolean;
  challengerCardId: string | null;
  cards: CardPayload[];
}

interface LayerToggles {
  background: boolean;
  board: boolean;
  weapon: boolean;
  character: boolean;
  frame: boolean;
}

const INITIAL_BOSS_DECK_NAME = "Garibaldi's Crew";
const INITIAL_BOSS_COUNT = 6;

function normalizeDeckName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const ALL_LAYERS_ON: LayerToggles = {
  background: true,
  board: true,
  weapon: true,
  character: true,
  frame: true,
};

const ALL_LAYERS_OFF: LayerToggles = {
  background: false,
  board: false,
  weapon: false,
  character: false,
  frame: false,
};

// ── Export helpers ─────────────────────────────────────────────────────────────

type ExportLayer =
  | { type: "background"; url: string; zIndex: number; inset: boolean }
  | { type: "board"; url: string; zIndex: number; card: CardPayload }
  | { type: "weapon"; url: string; zIndex: number; card: CardPayload }
  | { type: "character"; url: string; zIndex: number; card: CardPayload }
  | { type: "frame"; url: string; zIndex: number };

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (img.naturalWidth - sourceWidth) / 2;
  const sourceY = (img.naturalHeight - sourceHeight) / 2;
  ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  objectPositionY: "center" | "bottom" = "center",
) {
  const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
  const drawWidth = img.naturalWidth * scale;
  const drawHeight = img.naturalHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = objectPositionY === "bottom"
    ? y + height - drawHeight
    : y + (height - drawHeight) / 2;
  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

function drawPlacedLayer(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  centerX: number,
  centerY: number,
  boxWidth: number,
  boxHeight: number,
  rotationDeg: number,
  objectPositionY?: "center" | "bottom",
) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  drawImageContain(ctx, img, -boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, objectPositionY);
  ctx.restore();
}

function drawExportLayer(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  layer: ExportLayer,
  width: number,
  height: number,
) {
  if (layer.type === "background") {
    const insetScale = layer.inset ? 0.9333 : 1;
    const insetWidth = width * insetScale;
    const insetHeight = height * insetScale;
    drawImageCover(ctx, img, (width - insetWidth) / 2, (height - insetHeight) / 2, insetWidth, insetHeight);
    return;
  }

  if (layer.type === "board") {
    const boardPoseScene = resolveBoardPoseScene(layer.card.characterSeed);
    const placement = normalizeBoardPlacement(boardPoseScene.key, layer.card.board?.placement);
    const box = getBoardPlacementBox(boardPoseScene.key, placement.scale);
    drawPlacedLayer(
      ctx,
      img,
      (placement.xPercent / 100) * width,
      (placement.yPercent / 100) * height,
      (box.widthPercent / 100) * width,
      (box.heightPercent / 100) * height,
      placement.rotationDeg,
    );
    return;
  }

  if (layer.type === "character") {
    const placement = normalizeCharacterPlacement(layer.card.characterPlacement);
    const box = getCharacterPlacementBox(placement.scale);
    drawPlacedLayer(
      ctx,
      img,
      (placement.xPercent / 100) * width,
      (placement.yPercent / 100) * height,
      (box.widthPercent / 100) * width,
      (box.heightPercent / 100) * height,
      placement.rotationDeg,
      "bottom",
    );
    return;
  }

  if (layer.type === "weapon") {
    const placement = normalizeWeaponPlacement(layer.card.weaponPlacement);
    const box = getWeaponPlacementBox(placement.scale);
    drawPlacedLayer(
      ctx,
      img,
      (placement.xPercent / 100) * width,
      (placement.yPercent / 100) * height,
      (box.widthPercent / 100) * width,
      (box.heightPercent / 100) * height,
      placement.rotationDeg,
    );
    return;
  }

  ctx.drawImage(img, 0, 0, width, height);
}

/** Render a card's visible layers onto a canvas and return a PNG blob. */
async function renderCardToPng(
  card: CardPayload,
  toggles: LayerToggles,
  width = 320,
  height = 448,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Transparent background — do not fill

  const layers: ExportLayer[] = [];

  if (toggles.background && card.backgroundImageUrl) {
    layers.push({
      type: "background",
      url: card.backgroundImageUrl,
      zIndex: 0,
      inset: shouldInsetBackgroundForFrame(card.prompts.rarity, card.frameImageUrl),
    });
  }
  if (toggles.board && card.board?.imageUrl) {
    layers.push({
      type: "board",
      url: card.board.imageUrl,
      zIndex: getBoardLayerZIndex(card.board?.layerOrder),
      card,
    });
  }
  if (toggles.weapon && card.weaponImageUrl) {
    layers.push({
      type: "weapon",
      url: card.weaponImageUrl,
      zIndex: WEAPON_LAYER_Z_INDEX,
      card,
    });
  }
  if (toggles.character && card.characterImageUrl) {
    layers.push({
      type: "character",
      url: card.characterImageUrl,
      zIndex: CHARACTER_LAYER_Z_INDEX,
      card,
    });
  }
  if (toggles.frame && card.frameImageUrl) {
    layers.push({ type: "frame", url: card.frameImageUrl, zIndex: 10 });
  }

  // Sort by z-index to draw in correct order
  layers.sort((a, b) => a.zIndex - b.zIndex);

  for (const layer of layers) {
    const img = await loadImage(layer.url);
    drawExportLayer(ctx, img, layer, width, height);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/png",
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60) || "card";
}

interface ExportEntry {
  card: CardPayload;
  toggles: LayerToggles;
}

// ── Layer toggle controls ──────────────────────────────────────────────────────

interface LayerToggleBarProps {
  toggles: LayerToggles;
  onChange: (toggles: LayerToggles) => void;
}

function LayerToggleBar({ toggles, onChange }: LayerToggleBarProps) {
  const allOn = toggles.background && toggles.board && toggles.weapon && toggles.character && toggles.frame;

  function toggle(key: keyof LayerToggles) {
    onChange({ ...toggles, [key]: !toggles[key] });
  }

  function toggleAll() {
    onChange(allOn ? ALL_LAYERS_OFF : ALL_LAYERS_ON);
  }

  return (
    <div className="adlp-layer-bar">
      <button
        className={`adlp-layer-btn${allOn ? " adlp-layer-btn--active" : ""}`}
        onClick={toggleAll}
        title="Toggle all layers"
      >
        ⊞ All
      </button>
      <button
        className={`adlp-layer-btn${toggles.background ? " adlp-layer-btn--active" : ""}`}
        onClick={() => toggle("background")}
        title="Background layer"
      >
        🌄 BG
      </button>
      <button
        className={`adlp-layer-btn${toggles.board ? " adlp-layer-btn--active" : ""}`}
        onClick={() => toggle("board")}
        title="Skateboard deck layer"
      >
        🛹 Board
      </button>
      <button
        className={`adlp-layer-btn${toggles.weapon ? " adlp-layer-btn--active" : ""}`}
        onClick={() => toggle("weapon")}
        title="Weapon layer"
      >
        ⚔ Weapon
      </button>
      <button
        className={`adlp-layer-btn${toggles.character ? " adlp-layer-btn--active" : ""}`}
        onClick={() => toggle("character")}
        title="Character layer"
      >
        🧍 Char
      </button>
      <button
        className={`adlp-layer-btn${toggles.frame ? " adlp-layer-btn--active" : ""}`}
        onClick={() => toggle("frame")}
        title="Frame overlay layer"
      >
        🖼 Frame
      </button>
    </div>
  );
}

// ── Single card layer preview ──────────────────────────────────────────────────

const CARD_W = 160;
const CARD_H = 224;

interface CardLayerPreviewProps {
  card: CardPayload;
  toggles: LayerToggles;
}

function CardLayerPreview({ card, toggles }: CardLayerPreviewProps) {
  const [boardImageFailed, setBoardImageFailed] = useState(false);
  const { backgroundImageUrl, characterImageUrl, frameImageUrl, weaponImageUrl } = card;
  const hasBackFrame = getStaticFrameBackUrl(card.prompts.rarity) != null;
  const hasAnyLayer = backgroundImageUrl || characterImageUrl || frameImageUrl || card.board?.imageUrl || weaponImageUrl;

  const backgroundLayerClassName = shouldInsetBackgroundForFrame(card.prompts.rarity, frameImageUrl)
    ? "card-art-layer card-art-layer--background card-art-layer--background-inset"
    : "card-art-layer card-art-layer--background";

  const frameLayerStyle = frameImageUrl
    ? { mixBlendMode: getFrameBlendMode(card.prompts.rarity, frameImageUrl) }
    : undefined;

  const boardPoseScene = resolveBoardPoseScene(card.characterSeed);
  const showExactBoardLayer =
    toggles.board &&
    Boolean(card.board?.imageUrl && (backgroundImageUrl || characterImageUrl));

  const boardPlacementStyle = {
    ...buildBoardPlacementStyle(boardPoseScene.key, card.board?.placement),
    zIndex: getBoardLayerZIndex(card.board?.layerOrder),
  };
  const characterPlacementStyle = {
    ...buildCharacterPlacementStyle(card.characterPlacement),
    zIndex: CHARACTER_LAYER_Z_INDEX,
  };
  const weaponPlacementStyle = {
    ...buildWeaponPlacementStyle(card.weaponPlacement),
    zIndex: WEAPON_LAYER_Z_INDEX,
  };

  return (
    <div
      className={`card-art-composite adlp-card-preview${hasBackFrame ? " card-art-composite--wrap-frame" : ""}`}
      style={{ width: CARD_W, height: CARD_H }}
    >
      {toggles.background && backgroundImageUrl && (
        <img
          src={backgroundImageUrl}
          alt="background"
          className={backgroundLayerClassName}
          loading="lazy"
          decoding="async"
        />
      )}
      {showExactBoardLayer && card.board?.imageUrl && !boardImageFailed && (
        <img
          src={card.board.imageUrl}
          alt="skateboard deck"
          className="card-art-layer card-art-layer--board-exact"
          style={boardPlacementStyle}
          loading="lazy"
          decoding="async"
          onError={() => setBoardImageFailed(true)}
        />
      )}
      {toggles.weapon && weaponImageUrl && (
        <img
          src={weaponImageUrl}
          alt="weapon"
          className="card-art-layer card-art-layer--weapon"
          style={weaponPlacementStyle}
          loading="lazy"
          decoding="async"
        />
      )}
      {toggles.character && characterImageUrl && (
        <img
          src={characterImageUrl}
          alt="character"
          className="card-art-layer card-art-layer--character"
          style={characterPlacementStyle}
          loading="lazy"
          decoding="async"
        />
      )}
      {toggles.frame && frameImageUrl && (
        <img
          src={frameImageUrl}
          alt="frame"
          className={
            hasBackFrame
              ? "card-art-layer card-art-layer--frame card-art-layer--frame-wrap"
              : "card-art-layer card-art-layer--frame"
          }
          style={frameLayerStyle as React.CSSProperties}
          loading="lazy"
          decoding="async"
        />
      )}
      {!hasAnyLayer && (
        <div className="adlp-no-layers">No image layers generated yet</div>
      )}
    </div>
  );
}

// ── Export toolbar ──────────────────────────────────────────────────────────────

interface ExportToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onExportSelected: () => void;
  exporting: boolean;
}

function ExportToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onExportSelected,
  exporting,
}: ExportToolbarProps) {
  return (
    <div className="adlp-export-toolbar">
      <span className="adlp-export-count">
        {selectedCount} of {totalCount} selected
      </span>
      <button className="adlp-export-btn adlp-export-btn--select" onClick={onSelectAll} disabled={exporting}>
        ☑ Select All
      </button>
      <button className="adlp-export-btn adlp-export-btn--select" onClick={onDeselectAll} disabled={exporting}>
        ☐ Deselect All
      </button>
      <button
        className="adlp-export-btn adlp-export-btn--download"
        onClick={onExportSelected}
        disabled={selectedCount === 0 || exporting}
      >
        {exporting ? "⏳ Exporting…" : `📥 Download${selectedCount > 1 ? ` (${selectedCount})` : ""}`}
      </button>
    </div>
  );
}

// ── Deck section ───────────────────────────────────────────────────────────────

interface DeckSectionProps {
  deck: AdminDeck;
}

function DeckSection({ deck }: DeckSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [globalToggles, setGlobalToggles] = useState<LayerToggles>(ALL_LAYERS_ON);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  // Track per-card toggles for export
  const cardTogglesRef = useRef<Map<string, LayerToggles>>(new Map());

  function handleCardToggleChange(cardId: string, toggles: LayerToggles) {
    cardTogglesRef.current.set(cardId, toggles);
  }

  function toggleCardSelection(cardId: string) {
    setSelectedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  function selectAll() {
    setSelectedCards(new Set(deck.cards.map((c) => c.id)));
  }

  function deselectAll() {
    setSelectedCards(new Set());
  }

  async function handleExportSelected() {
    if (selectedCards.size === 0) return;
    setExporting(true);
    try {
      const entries: ExportEntry[] = deck.cards
        .filter((c) => selectedCards.has(c.id))
        .map((card) => ({
          card,
          toggles: cardTogglesRef.current.get(card.id) ?? globalToggles,
        }));

      for (const { card, toggles } of entries) {
        const blob = await renderCardToPng(card, toggles);
        const name = sanitizeFilename(card.identity?.name ?? card.id);
        downloadBlob(blob, `${name}.png`);
        // Small delay between downloads so browser doesn't block them
        if (entries.length > 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Some card images may not be available for cross-origin download. Check that all image URLs are accessible.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="adlp-deck">
      <div className="adlp-deck-header">
        <button className="adlp-deck-expand-btn" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "▾" : "▸"}
        </button>
        <span className="adlp-deck-name">
          {deck.name}
          {deck.isPrimary && <span className="adlp-primary-badge">★ Primary</span>}
          {deck.battleReady && <span className="adlp-ready-badge">⚔ Battle Ready</span>}
        </span>
        <span className="adlp-deck-meta">
          {deck.cards.length} card{deck.cards.length !== 1 ? "s" : ""}
        </span>
        {expanded && (
          <div className="adlp-deck-global-toggles">
            <span className="adlp-deck-global-label">All cards:</span>
            <LayerToggleBar toggles={globalToggles} onChange={setGlobalToggles} />
          </div>
        )}
      </div>

      {expanded && (
        <>
          {deck.cards.length > 0 && (
            <ExportToolbar
              selectedCount={selectedCards.size}
              totalCount={deck.cards.length}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
              onExportSelected={handleExportSelected}
              exporting={exporting}
            />
          )}
          <div className="adlp-card-grid">
            {deck.cards.map((card) => (
              <CardTileWithGlobal
                key={card.id}
                card={card}
                isChallengerCard={deck.challengerCardId === card.id}
                globalToggles={globalToggles}
                selected={selectedCards.has(card.id)}
                onToggleSelect={() => toggleCardSelection(card.id)}
                onToggleChange={(t) => handleCardToggleChange(card.id, t)}
                onExportSingle={async (toggles) => {
                  setExporting(true);
                  try {
                    const blob = await renderCardToPng(card, toggles);
                    const name = sanitizeFilename(card.identity?.name ?? card.id);
                    downloadBlob(blob, `${name}.png`);
                  } catch {
                    alert(`Export failed for "${card.identity?.name ?? card.id}". The image may not be available for cross-origin download.`);
                  } finally {
                    setExporting(false);
                  }
                }}
              />
            ))}
            {deck.cards.length === 0 && (
              <p className="adlp-empty">This deck has no cards.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Card tile that can be overridden by global toggles or managed individually
interface CardTileWithGlobalProps {
  card: CardPayload;
  isChallengerCard: boolean;
  globalToggles: LayerToggles;
  selected: boolean;
  onToggleSelect: () => void;
  onToggleChange: (toggles: LayerToggles) => void;
  onExportSingle: (toggles: LayerToggles) => void;
}

function CardTileWithGlobal({
  card,
  isChallengerCard,
  globalToggles,
  selected,
  onToggleSelect,
  onToggleChange,
  onExportSingle,
}: CardTileWithGlobalProps) {
  // Individual overrides start synced to global, then diverge if user changes them
  const [overridden, setOverridden] = useState(false);
  const [localToggles, setLocalToggles] = useState<LayerToggles>(globalToggles);
  const onToggleChangeRef = useRef(onToggleChange);
  onToggleChangeRef.current = onToggleChange;

  // Sync with global when not overridden
  useEffect(() => {
    if (!overridden) {
      setLocalToggles(globalToggles);
      onToggleChangeRef.current(globalToggles);
    }
  }, [globalToggles, overridden]);

  function handleChange(t: LayerToggles) {
    setOverridden(true);
    setLocalToggles(t);
    onToggleChange(t);
  }

  return (
    <div className={`adlp-card-tile${selected ? " adlp-card-tile--selected" : ""}`}>
      <div className="adlp-card-tile-top">
        <label className="adlp-card-select" title="Select for export">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} />
        </label>
        <div className="adlp-card-tile-name">
          {card.identity?.name ?? "—"}
          {isChallengerCard && <span className="adlp-challenger-badge">⚡ Challenger</span>}
          {overridden && (
            <button
              className="adlp-reset-btn"
              onClick={() => { setOverridden(false); setLocalToggles(globalToggles); onToggleChange(globalToggles); }}
              title="Reset to deck-wide toggles"
            >
              ↺
            </button>
          )}
        </div>
      </div>
      <div className="adlp-card-tile-sub">
        {card.prompts?.rarity} · {card.prompts?.archetype}
      </div>
      <CardLayerPreview card={card} toggles={localToggles} />
      <LayerToggleBar toggles={localToggles} onChange={handleChange} />
      <button
        className="adlp-export-btn adlp-export-btn--single"
        onClick={() => onExportSingle(localToggles)}
        title="Download this card as PNG"
      >
        📥 Export
      </button>
    </div>
  );
}

// ── Boss card tile ─────────────────────────────────────────────────────────────

interface AdminBossCardTileProps {
  card: CardPayload;
}

function AdminBossCardTile({ card }: AdminBossCardTileProps) {
  return (
    <div className="adlp-boss-tile">
      <div className="adlp-boss-header">
        <h3 className="adlp-boss-name">{card.identity?.name ?? "Unnamed Boss"}</h3>
        <span className="adlp-boss-district">{card.prompts?.district ?? "Unknown district"}</span>
      </div>
      <div className="adlp-boss-tagline">
        {(card.identity?.crew ?? card.prompts?.archetype ?? "Unknown crew")} · {card.class?.rarity ?? card.prompts?.rarity ?? "Unknown rarity"}
      </div>
      <CardLayerPreview card={card} toggles={ALL_LAYERS_ON} />
      <div className="adlp-boss-stats">
        <div className="adlp-boss-stat"><span>SPD</span>{card.stats.speed}</div>
        <div className="adlp-boss-stat"><span>RNG</span>{card.stats.range}</div>
        <div className="adlp-boss-stat"><span>STL</span>{card.stats.stealth}</div>
        <div className="adlp-boss-stat"><span>GRT</span>{card.stats.grit}</div>
        <div className="adlp-boss-stat"><span>LNC</span>{card.joust?.lance ?? "—"}</div>
        <div className="adlp-boss-stat"><span>SHD</span>{card.joust?.shield ?? "—"}</div>
        <div className="adlp-boss-stat"><span>HYP</span>{card.joust?.hype ?? "—"}</div>
      </div>
      <div className="adlp-boss-tactic">
        <span aria-hidden="true">⚔</span> Traits: <strong>{card.joust?.traits?.[0] ?? "No joust trait set"}</strong>
      </div>
      <blockquote className="adlp-boss-dialogue">
        {card.front?.flavorTextEnglish ?? card.front?.flavorText ?? card.back?.notes ?? "No boss flavor text set yet."}
      </blockquote>
    </div>
  );
}

interface RivalBossTileProps {
  rival: DistrictRival;
}

function RivalBossTile({ rival }: RivalBossTileProps) {
  const sc = rival.signatureCard;
  return (
    <div className="adlp-boss-tile">
      <div className="adlp-boss-header">
        <h3 className="adlp-boss-name">{rival.name}</h3>
        <span className="adlp-boss-district">{rival.district}</span>
      </div>
      <div className="adlp-boss-tagline">{rival.tagline}</div>
      <div className="adlp-no-layers adlp-boss-no-layers">
        No image layers — boss cards are stat-only
      </div>
      <div className="adlp-boss-stats">
        <div className="adlp-boss-stat"><span>SPD</span>{sc.stats.speed}</div>
        <div className="adlp-boss-stat"><span>RNG</span>{sc.stats.range}</div>
        <div className="adlp-boss-stat"><span>STL</span>{sc.stats.stealth}</div>
        <div className="adlp-boss-stat"><span>GRT</span>{sc.stats.grit}</div>
        <div className="adlp-boss-stat"><span>LNC</span>{sc.joust.lance}</div>
        <div className="adlp-boss-stat"><span>SHD</span>{sc.joust.shield}</div>
        <div className="adlp-boss-stat"><span>HYP</span>{sc.joust.hype}</div>
      </div>
      <div className="adlp-boss-tactic">
        <span aria-hidden="true">⚔</span> Tactic: <strong>{rival.signatureTactic}</strong> · {rival.signatureTrait}
      </div>
      <blockquote className="adlp-boss-dialogue">{rival.dialogue.intro}</blockquote>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function AdminDeckLayersPanel() {
  const [decks, setDecks] = useState<AdminDeck[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const initialBossDeck = useMemo(
    () => decks.find((deck) => normalizeDeckName(deck.name) === normalizeDeckName(INITIAL_BOSS_DECK_NAME)),
    [decks],
  );

  const initialBossCards = useMemo(
    () => initialBossDeck?.cards.slice(0, INITIAL_BOSS_COUNT) ?? [],
    [initialBossDeck],
  );

  const fetchDecks = useCallback(async () => {
    if (!auth?.currentUser) {
      setError("Not signed in.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(resolveAdminActionUrl("/api/admin/decks"), {
        headers: {
          Authorization: "Bearer " + idToken,
        },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error ?? "Failed to load admin decks.");
      }
      const data = await res.json();
      setDecks(data.decks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin decks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  return (
    <div className="adlp-panel">
      {/* ── Admin Card Decks ─────────────────────────────────────────────── */}
      <section className="asset-gen-section">
        <div className="adlp-section-header">
          <h2 className="asset-gen-section-title">Admin Card Decks</h2>
          <button
            className="btn-outline"
            onClick={fetchDecks}
            disabled={loading}
          >
            {loading ? "⏳ Loading…" : "↺ Refresh"}
          </button>
        </div>
        <p className="asset-gen-toolbar-copy">
          All card decks saved by admin accounts. Use the layer toggles on each card
          to show or hide the Background, Skateboard Deck, Weapon, Character, and Frame layers.
          Deck-wide toggles apply to all cards at once; individual card toggles override independently.
        </p>

        {error && <p className="admin-error">{error}</p>}

        {!loading && decks.length === 0 && !error && (
          <p className="adlp-empty">No admin card decks found.</p>
        )}

        {decks.map((deck) => (
          <DeckSection key={`${deck.ownerUid}::${deck.id}`} deck={deck} />
        ))}
      </section>

      {/* ── District Bosses ───────────────────────────────────────────────── */}
      <section className="asset-gen-section">
        <h2 className="asset-gen-section-title">Initial Bosses</h2>
        <p className="asset-gen-toolbar-copy">
          {initialBossDeck
            ? `Showing the first ${initialBossCards.length} cards from "${initialBossDeck.name}" as the starting boss lineup.`
            : `${INITIAL_BOSS_DECK_NAME} was not found, so the fallback district rival snapshots are shown instead.`}
        </p>
        <div className="adlp-boss-grid">
          {initialBossCards.length > 0
            ? initialBossCards.map((card) => (
                <AdminBossCardTile key={card.id} card={card} />
              ))
            : DISTRICT_RIVALS.map((rival) => (
                <RivalBossTile key={rival.id} rival={rival} />
              ))}
        </div>
      </section>
    </div>
  );
}
