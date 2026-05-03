import type { CSSProperties } from "react";
import type { BoardPlacement, CharacterPlacement, CompositeLayerOrder, LayerPlacement } from "./types";
import type { BoardPoseSceneKey } from "./boardPoseScenes";

export const BOARD_PLACEMENT_MIN_SCALE = 0.5;
export const BOARD_PLACEMENT_MAX_SCALE = 1.4;
export const BOARD_PLACEMENT_SCALE_STEP = 0.05;
export const CHARACTER_PLACEMENT_MIN_SCALE = 0.7;
export const CHARACTER_PLACEMENT_MAX_SCALE = 1.2;
export const CHARACTER_PLACEMENT_SCALE_STEP = 0.05;
export const CHARACTER_LAYER_Z_INDEX = 3;
const DEFAULT_CENTER_PERCENT = 50;

interface PlacementBox {
  widthPercent: number;
  heightPercent: number;
}

interface PlacementPreset<TPlacement extends LayerPlacement> extends PlacementBox, TPlacement {}

const BOARD_PLACEMENT_PRESETS: Record<BoardPoseSceneKey, PlacementPreset<BoardPlacement>> = {
  workshop: { xPercent: 38, yPercent: 77.5, scale: 1, rotationDeg: -9, widthPercent: 68, heightPercent: 25 },
  loadout: { xPercent: 75, yPercent: 46, scale: 1, rotationDeg: 8, widthPercent: 48, heightPercent: 30 },
  airborne: { xPercent: 50, yPercent: 81, scale: 1, rotationDeg: -10, widthPercent: 64, heightPercent: 24 },
  showcase: { xPercent: 69.5, yPercent: 75.5, scale: 1, rotationDeg: 3, widthPercent: 57, heightPercent: 25 },
  painting: { xPercent: 37.5, yPercent: 75.5, scale: 1, rotationDeg: -8, widthPercent: 67, heightPercent: 25 },
  wheels: { xPercent: 47, yPercent: 80.5, scale: 1, rotationDeg: -5, widthPercent: 70, heightPercent: 27 },
  cleaning: { xPercent: 67, yPercent: 77, scale: 1, rotationDeg: 5, widthPercent: 60, heightPercent: 24 },
};

const CHARACTER_PLACEMENT_PRESET: PlacementPreset<CharacterPlacement> = {
  xPercent: 50,
  yPercent: 59,
  scale: 1,
  rotationDeg: 0,
  widthPercent: 75,
  heightPercent: 82,
};

function clampPlacementValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getValidNumberOrDefault(value: number | null | undefined, fallback: number): number {
  if (value == null) return fallback;
  return Number.isFinite(value) ? Number(value) : fallback;
}

function normalizePlacement<TPlacement extends LayerPlacement>(
  preset: PlacementPreset<TPlacement>,
  placement: Partial<TPlacement> | undefined,
  minScale: number,
  maxScale: number,
): TPlacement {
  const scale = clampPlacementValue(
    getValidNumberOrDefault(placement?.scale, preset.scale),
    minScale,
    maxScale,
  );
  const box = getPlacementBox(preset, scale, minScale, maxScale);
  const xMinRaw = box.widthPercent / 2;
  const xMaxRaw = 100 - xMinRaw;
  const yMinRaw = box.heightPercent / 2;
  const yMaxRaw = 100 - yMinRaw;
  const xMin = xMinRaw <= xMaxRaw ? xMinRaw : DEFAULT_CENTER_PERCENT;
  const xMax = xMinRaw <= xMaxRaw ? xMaxRaw : DEFAULT_CENTER_PERCENT;
  const yMin = yMinRaw <= yMaxRaw ? yMinRaw : DEFAULT_CENTER_PERCENT;
  const yMax = yMinRaw <= yMaxRaw ? yMaxRaw : DEFAULT_CENTER_PERCENT;

  return {
    ...preset,
    xPercent: clampPlacementValue(getValidNumberOrDefault(placement?.xPercent, preset.xPercent), xMin, xMax),
    yPercent: clampPlacementValue(getValidNumberOrDefault(placement?.yPercent, preset.yPercent), yMin, yMax),
    scale,
    rotationDeg: getValidNumberOrDefault(placement?.rotationDeg, preset.rotationDeg),
  };
}

export function getDefaultBoardPlacement(sceneKey: BoardPoseSceneKey): BoardPlacement {
  const preset = BOARD_PLACEMENT_PRESETS[sceneKey];
  return {
    xPercent: preset.xPercent,
    yPercent: preset.yPercent,
    scale: preset.scale,
    rotationDeg: preset.rotationDeg,
  };
}

export function getDefaultCharacterPlacement(): CharacterPlacement {
  return {
    xPercent: CHARACTER_PLACEMENT_PRESET.xPercent,
    yPercent: CHARACTER_PLACEMENT_PRESET.yPercent,
    scale: CHARACTER_PLACEMENT_PRESET.scale,
    rotationDeg: CHARACTER_PLACEMENT_PRESET.rotationDeg,
  };
}

function getPlacementBox(
  preset: PlacementBox,
  scale: number,
  minScale: number,
  maxScale: number,
): PlacementBox {
  const clampedScale = clampPlacementValue(scale, minScale, maxScale);
  return {
    widthPercent: preset.widthPercent * clampedScale,
    heightPercent: preset.heightPercent * clampedScale,
  };
}

export function getBoardPlacementBox(sceneKey: BoardPoseSceneKey, scale: number): PlacementBox {
  return getPlacementBox(BOARD_PLACEMENT_PRESETS[sceneKey], scale, BOARD_PLACEMENT_MIN_SCALE, BOARD_PLACEMENT_MAX_SCALE);
}

export function getCharacterPlacementBox(scale: number): PlacementBox {
  return getPlacementBox(
    CHARACTER_PLACEMENT_PRESET,
    scale,
    CHARACTER_PLACEMENT_MIN_SCALE,
    CHARACTER_PLACEMENT_MAX_SCALE,
  );
}

export function normalizeBoardPlacement(
  sceneKey: BoardPoseSceneKey,
  placement?: Partial<BoardPlacement>,
): BoardPlacement {
  return normalizePlacement(
    BOARD_PLACEMENT_PRESETS[sceneKey],
    placement,
    BOARD_PLACEMENT_MIN_SCALE,
    BOARD_PLACEMENT_MAX_SCALE,
  );
}

export function normalizeCharacterPlacement(
  placement?: Partial<CharacterPlacement>,
): CharacterPlacement {
  return normalizePlacement(
    CHARACTER_PLACEMENT_PRESET,
    placement,
    CHARACTER_PLACEMENT_MIN_SCALE,
    CHARACTER_PLACEMENT_MAX_SCALE,
  );
}

export function buildBoardPlacementStyle(
  sceneKey: BoardPoseSceneKey,
  placement?: Partial<BoardPlacement>,
): CSSProperties {
  const normalized = normalizeBoardPlacement(sceneKey, placement);
  const box = getBoardPlacementBox(sceneKey, normalized.scale);

  return {
    left: `${normalized.xPercent}%`,
    top: `${normalized.yPercent}%`,
    width: `${box.widthPercent}%`,
    height: `${box.heightPercent}%`,
    transform: `translate(-50%, -50%) rotate(${normalized.rotationDeg}deg)`,
  };
}

export function buildCharacterPlacementStyle(
  placement?: Partial<CharacterPlacement>,
): CSSProperties {
  const normalized = normalizeCharacterPlacement(placement);
  const box = getCharacterPlacementBox(normalized.scale);

  return {
    left: `${normalized.xPercent}%`,
    top: `${normalized.yPercent}%`,
    width: `${box.widthPercent}%`,
    height: `${box.heightPercent}%`,
    transform: `translate(-50%, -50%) rotate(${normalized.rotationDeg}deg)`,
  };
}

export function resolveBoardLayerOrder(layerOrder?: CompositeLayerOrder): CompositeLayerOrder {
  return layerOrder === "behind-character" ? "behind-character" : "in-front";
}

export function getBoardLayerZIndex(layerOrder?: CompositeLayerOrder): number {
  return resolveBoardLayerOrder(layerOrder) === "behind-character" ? 2 : 4;
}
