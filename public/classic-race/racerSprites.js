/**
 * racerSprites.js — runtime loader for the pre-baked Arcade Racer character
 * sprite sheets committed under ./assets/racers/.
 *
 * Production loads only these static files (manifest.json + racer-*.png); there
 * is no live fal.ai call at race time. When the manifest is empty or fails to
 * load, the racer falls back to the procedural shape drawn in gameScene.js.
 */

export const RACER_SPRITE_MANIFEST_URL = new URL(
  './assets/racers/manifest.json',
  import.meta.url,
).href;

export const RACER_SPRITE_ASSET_BASE_URL = new URL(
  './assets/racers/',
  import.meta.url,
).href;

const DEFAULT_GRID = Object.freeze({
  columns: 4,
  rows: 2,
  frameCount: 8,
  frameWidth: 256,
  frameHeight: 256,
  fps: 10,
});

/** Phaser texture key for a racer sprite sheet. */
export function buildRacerSheetTextureKey(slug) {
  return `racer-sheet:${slug}`;
}

/** Phaser animation key for a racer sprite sheet. */
export function buildRacerAnimationKey(slug) {
  return `racer-anim:${slug}`;
}

function normalizeGrid(grid) {
  if (!grid || typeof grid !== 'object') return { ...DEFAULT_GRID };
  const merged = { ...DEFAULT_GRID, ...grid };
  // Guard against malformed manifests producing NaN frame slices.
  for (const key of ['columns', 'rows', 'frameCount', 'frameWidth', 'frameHeight', 'fps']) {
    const value = Number(merged[key]);
    merged[key] = Number.isFinite(value) && value > 0 ? value : DEFAULT_GRID[key];
  }
  return merged;
}

function normalizeRacers(racers) {
  if (!Array.isArray(racers)) return [];
  return racers
    .filter((entry) => entry && typeof entry.file === 'string' && entry.file)
    .map((entry) => ({
      slug: String(entry.slug || entry.file).replace(/[^a-zA-Z0-9_-]/g, '-'),
      file: entry.file,
      name: typeof entry.name === 'string' ? entry.name : '',
      deck: typeof entry.deck === 'string' ? entry.deck : '',
      url: new URL(entry.file, RACER_SPRITE_ASSET_BASE_URL).href,
    }));
}

/**
 * Fetch and normalize the committed sprite manifest. Resolves to
 * `{ grid, racers }` (racers may be empty); never rejects.
 */
export async function loadRacerSpriteManifest() {
  try {
    const response = await fetch(RACER_SPRITE_MANIFEST_URL, { cache: 'no-cache' });
    if (!response.ok) {
      return { grid: { ...DEFAULT_GRID }, racers: [] };
    }
    const data = await response.json();
    return {
      grid: normalizeGrid(data?.grid),
      racers: normalizeRacers(data?.racers),
    };
  } catch {
    return { grid: { ...DEFAULT_GRID }, racers: [] };
  }
}

/**
 * Deterministically assign a sprite entry to each racer slot. The player (index
 * 0) gets the first available sprite; remaining racers cycle through the rest so
 * a small manifest still decorates every racer. Returns an array aligned to
 * `racerCount`; entries are `null` when no sprite is available.
 */
export function assignRacerSprites(racers, racerCount) {
  const assignments = new Array(racerCount).fill(null);
  if (!Array.isArray(racers) || racers.length === 0) return assignments;
  for (let i = 0; i < racerCount; i += 1) {
    assignments[i] = racers[i % racers.length];
  }
  return assignments;
}
