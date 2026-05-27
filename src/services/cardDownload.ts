import type { Rarity } from "../lib/types";
import type { BoardPlacement, CharacterPlacement, CompositeLayerOrder } from "../lib/types";
import { RARITY_COLORS, shouldRenderInsetNeonTube } from "../lib/cardRarityVisuals";
import {
  getBoardPlacementBox,
  getCharacterPlacementBox,
  normalizeBoardPlacement,
  normalizeCharacterPlacement,
  resolveBoardLayerOrder,
} from "../lib/boardPlacement";
import { resolveBoardPoseScene } from "../lib/boardPoseScenes";
import { buildFrameSvgDataUrl } from "./frameSvg";
import { getFrameBlendMode, shouldRenderSvgFrame } from "./staticAssets";

/**
 * Card download service — composites all three AI art layers onto a canvas
 * and triggers a JPEG download.
 *
 * Layer blend modes (mirroring .card-art-layer--* in index.css):
 *   background — source-over / normal
 *   character  — source-over / normal, with opacity = characterBlend (0–1)
 *   frame      — screen (black in the frame image becomes transparent; coloured
 *                border remains visible)
 */

/** Output dimensions for the downloaded card (poker card at 300 dpi). */
const CARD_WIDTH  = 750;
const CARD_HEIGHT = 1050;
const CHARACTER_LAYER_SCALE = 0.8;
const INSET_BACKGROUND_SCALE = 0.9333;

function strokeNeonSegment(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  startColor: string,
  endColor: string,
): void {
  const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(1, endColor);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 10;
  ctx.strokeStyle = gradient;
  ctx.shadowColor = endColor;
  ctx.shadowBlur = 18;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = gradient;
  ctx.shadowColor = startColor;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.restore();
}

function drawInsetNeonTube(ctx: CanvasRenderingContext2D, rarity: Rarity, accentColor?: string): void {
  if (!shouldRenderInsetNeonTube(rarity)) return;

  const rarityColor = RARITY_COLORS[rarity];
  const glowAccent = accentColor || rarityColor;
  const insetX = ((1 - INSET_BACKGROUND_SCALE) * CARD_WIDTH) / 2;
  const insetY = ((1 - INSET_BACKGROUND_SCALE) * CARD_HEIGHT) / 2;
  const right = CARD_WIDTH - insetX;
  const bottom = CARD_HEIGHT - insetY;
  const gapWidth = (right - insetX) * 0.44;
  const gapLeft = (CARD_WIDTH - gapWidth) / 2;
  const gapRight = gapLeft + gapWidth;

  strokeNeonSegment(ctx, insetX, insetY, gapLeft, insetY, rarityColor, glowAccent);
  strokeNeonSegment(ctx, gapRight, insetY, right, insetY, glowAccent, rarityColor);
  strokeNeonSegment(ctx, insetX, insetY + 4, insetX, bottom, rarityColor, glowAccent);
  strokeNeonSegment(ctx, right, insetY + 4, right, bottom, glowAccent, rarityColor);
  strokeNeonSegment(ctx, insetX, bottom, right, bottom, glowAccent, rarityColor);
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { width: number; height: number },
  targetWidth: number,
  targetHeight: number,
): void {
  const sourceAspect = img.width / img.height;
  const targetAspect = targetWidth / targetHeight;

  let sourceWidth = img.width;
  let sourceHeight = img.height;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceAspect > targetAspect) {
    sourceWidth = img.height * targetAspect;
    sourceX = (img.width - sourceWidth) / 2;
  } else if (sourceAspect < targetAspect) {
    sourceHeight = img.width / targetAspect;
    sourceY = (img.height - sourceHeight) / 2;
  }

  ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
}

function drawCharacterImage(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { width: number; height: number },
  placement?: CharacterPlacement,
): void {
  const normalized = normalizeCharacterPlacement(placement);
  const box = getCharacterPlacementBox(normalized.scale);
  const targetWidth = (box.widthPercent / 100) * CARD_WIDTH;
  const targetHeight = (box.heightPercent / 100) * CARD_HEIGHT;
  const containScale = Math.min(targetWidth / img.width, targetHeight / img.height) * CHARACTER_LAYER_SCALE;
  const drawWidth = img.width * containScale;
  const drawHeight = img.height * containScale;

  ctx.save();
  ctx.translate((normalized.xPercent / 100) * CARD_WIDTH, (normalized.yPercent / 100) * CARD_HEIGHT);
  ctx.rotate((normalized.rotationDeg * Math.PI) / 180);
  ctx.drawImage(img, -drawWidth / 2, targetHeight / 2 - drawHeight, drawWidth, drawHeight);
  ctx.restore();
}

function drawBoardImage(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { width: number; height: number },
  sceneSeed: string,
  placement?: BoardPlacement,
): void {
  const scene = resolveBoardPoseScene(sceneSeed);
  const normalized = normalizeBoardPlacement(scene.key, placement);
  const box = getBoardPlacementBox(scene.key, normalized.scale);
  const targetWidth = (box.widthPercent / 100) * CARD_WIDTH;
  const targetHeight = (box.heightPercent / 100) * CARD_HEIGHT;
  const containScale = Math.min(targetWidth / img.width, targetHeight / img.height);
  const drawWidth = img.width * containScale;
  const drawHeight = img.height * containScale;

  ctx.save();
  ctx.translate((normalized.xPercent / 100) * CARD_WIDTH, (normalized.yPercent / 100) * CARD_HEIGHT);
  ctx.rotate((normalized.rotationDeg * Math.PI) / 180);
  ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

function loadCrossOriginImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load layer image: ${url}`));
    // Set src after attaching handlers to avoid a race condition on cached images.
    img.src = url;
  });
}

/**
 * Flatten all AI art layers onto a canvas and download the result as a JPEG.
 *
 * @param cardName       - Used as the downloaded filename stem.
 * @param backgroundUrl  - District background layer URL.
 * @param characterUrl   - Character portrait layer URL (transparent PNG after birefnet).
 * @param frameUrl       - Rarity frame border layer URL.
 * @param characterBlend - Opacity of the character layer (0–1, default 1).
 */
export async function downloadCardAsJpg(
  cardName: string,
  rarity: Rarity,
  backgroundUrl: string | undefined,
  characterUrl: string | undefined,
  frameUrl: string | undefined,
  frameSeed: string,
  accentColor?: string,
  characterBlend = 1,
  boardUrl?: string,
  characterSeed?: string,
  boardPlacement?: BoardPlacement,
  characterPlacement?: CharacterPlacement,
  boardLayerOrder?: CompositeLayerOrder,
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width  = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable in this browser.");

  // ── Layer 1: background (normal blend) ────────────────────────────────────
  if (backgroundUrl) {
    const img = await loadCrossOriginImage(backgroundUrl);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    drawImageCover(ctx, img, CARD_WIDTH, CARD_HEIGHT);
  }
  drawInsetNeonTube(ctx, rarity, accentColor);

  const resolvedBoardLayerOrder = resolveBoardLayerOrder(boardLayerOrder);

  // ── Layer 2: exact generated board, with user placement (optional behind character) ─────────
  if (resolvedBoardLayerOrder === "behind-character" && boardUrl && characterSeed) {
    const img = await loadCrossOriginImage(boardUrl);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    drawBoardImage(ctx, img, characterSeed, boardPlacement);
  }

  // ── Layer 3: character (normal blend, user-controlled opacity) ─────────────
  if (characterUrl) {
    const img = await loadCrossOriginImage(characterUrl);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = Math.max(0, Math.min(1, characterBlend));
    drawCharacterImage(ctx, img, characterPlacement);
    ctx.globalAlpha = 1;
  }

  // ── Layer 4: exact generated board in front of character ────────────────────
  if (resolvedBoardLayerOrder === "in-front" && boardUrl && characterSeed) {
    const img = await loadCrossOriginImage(boardUrl);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    drawBoardImage(ctx, img, characterSeed, boardPlacement);
  }

  // ── Layer 5: frame (screen blend — black frame interior becomes transparent) ─
  if (frameUrl || shouldRenderSvgFrame(rarity, frameUrl)) {
    const resolvedFrameUrl = shouldRenderSvgFrame(rarity, frameUrl)
      ? buildFrameSvgDataUrl(rarity, frameSeed)
      : frameUrl;
    if (!resolvedFrameUrl) {
      throw new Error(`Frame download URL could not be resolved for ${rarity}.`);
    }
    const img = await loadCrossOriginImage(resolvedFrameUrl);
    ctx.globalCompositeOperation = frameUrl && getFrameBlendMode(rarity, frameUrl) === "screen" ? "screen" : "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(img, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  // Reset to defaults before export so nothing bleeds into the encoding pass.
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // ── Export as JPEG ─────────────────────────────────────────────────────────
  await new Promise<void>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas failed to produce a JPEG blob."));
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        const anchor    = document.createElement("a");
        anchor.href     = objectUrl;
        anchor.download = `${cardName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.jpg`;
        anchor.click();
        // Revoke after a short delay so the browser can finish reading the blob.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 15_000);
        resolve();
      },
      "image/jpeg",
      0.92,
    );
  });
}
