/**
 * arcadeRacerSprites.ts — shared metadata and helpers for the Arcade Racer
 * character sprite sheets.
 *
 * Pipeline: an admin takes an admin *card-deck* card, isolates the blank
 * character layer (background, frame, weapon, and skateboard *deck* removed),
 * and sends that clean reference image to fal.ai `nano-banana-2`, which renders
 * a clean isometric 2D **animated sprite sheet** of the same character. The
 * generated sheet + a static `manifest.json` are then committed under
 * `public/classic-race/assets/racers/` so production loads pre-baked assets and
 * never depends on a live fal.ai call.
 *
 * This module is the single source of truth for the sprite-sheet grid layout so
 * the generator, the manifest, and the in-game Phaser loader all agree.
 */

/**
 * Fixed sprite-sheet grid. `nano-banana-2` is prompted to lay out one transparent
 * sheet as COLUMNS × ROWS evenly spaced cells (a skate/idle animation cycle).
 * The in-game loader slices the sheet with these exact frame dimensions.
 */
export interface RacerSpriteGrid {
  columns: number;
  rows: number;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  /** Playback rate (frames per second) for the looping animation. */
  fps: number;
}

export const RACER_SPRITE_GRID: RacerSpriteGrid = Object.freeze({
  columns: 4,
  rows: 2,
  frameCount: 8,
  frameWidth: 256,
  frameHeight: 256,
  fps: 10,
});

/** Overall pixel dimensions of the generated sprite sheet (columns × rows). */
export const RACER_SPRITE_SHEET_IMAGE_SIZE = Object.freeze({
  width: RACER_SPRITE_GRID.columns * RACER_SPRITE_GRID.frameWidth,
  height: RACER_SPRITE_GRID.rows * RACER_SPRITE_GRID.frameHeight,
});

/** Folder (relative to the published site root) where sheets + manifest live. */
export const RACER_SPRITE_ASSET_DIR = "classic-race/assets/racers";

/** Current manifest schema version. Bump when the grid or schema changes. */
export const RACER_SPRITE_MANIFEST_VERSION = 1;

/** A single committed racer sprite sheet. */
export interface RacerSpriteRecord {
  /** Stable identifier derived from the source card id. */
  slug: string;
  /** Source admin card-deck card id this sprite was generated from. */
  cardId: string;
  /** Display name of the source character (for admin UI + debugging). */
  name: string;
  /** Source deck name (for admin UI + grouping). */
  deck: string;
  /** Sheet filename committed alongside the manifest, e.g. "racer-<slug>.png". */
  file: string;
  /**
   * Runtime-only URL of the generated sheet (Firebase/fal CDN). Present in the
   * admin session manifest but stripped from the committed static manifest.
   */
  imageUrl?: string;
}

export interface RacerSpriteManifest {
  version: number;
  generatedAt: string;
  grid: RacerSpriteGrid;
  racers: RacerSpriteRecord[];
}

/** Convert an arbitrary card id / name into a filesystem- and URL-safe slug. */
export function buildRacerSpriteSlug(value: string): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "racer";
}

/** Committed PNG filename for a sprite sheet, e.g. "racer-ghost-rider.png". */
export function buildRacerSpriteFilename(slug: string): string {
  return `racer-${buildRacerSpriteSlug(slug)}.png`;
}

/**
 * Build the fal.ai `nano-banana-2` prompt that turns a clean character reference
 * into an isometric 2D animated sprite sheet laid out on the fixed grid.
 */
export function buildRacerSpriteSheetPrompt(characterName?: string): string {
  const subject = characterName?.trim()
    ? `the same character ("${characterName.trim()}") shown in the reference image`
    : "the same character shown in the reference image";
  const { columns, rows, frameCount } = RACER_SPRITE_GRID;
  return (
    `A crisp 2D arcade-game character sprite sheet of ${subject}. ` +
    `FIDELITY: replicate the reference image exactly — the character's hair color, ` +
    `outfit colors (every garment), skin tone, and body proportions must be ` +
    `pixel-accurate copies of the reference; do NOT invent or alter any color. ` +
    `These are mature adult characters (mid-20s to 40s); render fully grown adult ` +
    `anatomy and proportions — NOT chibi, NOT cartoon child, NOT anime-exaggerated ` +
    `youth, NOT juvenile. ` +
    `LAYOUT: a single image arranged as a strict ${columns}-column by ${rows}-row grid ` +
    `(${frameCount} evenly spaced, equally sized cells) on a fully transparent background; ` +
    `no bleeding between cells, no padding, no border. ` +
    `ANIMATION: the ${frameCount} cells form one smooth looping skateboarding/skating ` +
    `cycle, with the character centered identically in every cell at a consistent scale. ` +
    `PERSPECTIVE: isometric 45-degree top-down 3/4 view, character facing toward the ` +
    `upper-right, suitable for a top-down arcade racer. ` +
    `STYLE: semi-realistic game-sprite shading, bold clean outlines, consistent soft ` +
    `top-right lighting, no card frame, no border, no background scenery, no text, no ` +
    `watermark, no UI, no skateboard deck unless worn by the character, no weapons.`
  );
}

/** Build an in-memory manifest from a list of generated records. */
export function buildRacerSpriteManifest(
  racers: RacerSpriteRecord[],
  generatedAt: string = new Date().toISOString(),
): RacerSpriteManifest {
  const seen = new Set<string>();
  const deduped: RacerSpriteRecord[] = [];
  // Last write wins per slug so re-generating a card replaces its earlier entry.
  for (let i = racers.length - 1; i >= 0; i -= 1) {
    const record = racers[i];
    if (seen.has(record.slug)) continue;
    seen.add(record.slug);
    deduped.unshift(record);
  }
  return {
    version: RACER_SPRITE_MANIFEST_VERSION,
    generatedAt,
    grid: RACER_SPRITE_GRID,
    racers: deduped,
  };
}

/**
 * Produce the committed static manifest: strip runtime-only fields (CDN URLs)
 * so the file references only the committed PNGs by filename.
 */
export function buildStaticRacerSpriteManifest(
  manifest: RacerSpriteManifest,
): RacerSpriteManifest {
  return {
    ...manifest,
    racers: manifest.racers.map((record) => {
      const stripped = { ...record };
      delete stripped.imageUrl;
      return stripped;
    }),
  };
}
