/**
 * staticAssets.ts
 *
 * Registry of pre-loaded static image assets for district backgrounds and rarity
 * frame borders.  When an entry is present here the app uses the static file
 * directly — no Firestore read and no fal.ai API call — eliminating per-forge
 * credit usage for stable layers.
 *
 * ── Background sizes ─────────────────────────────────────────────────────────
 *  Two resolutions are tracked for each district:
 *
 *  • BACKGROUND_ASSETS_SMALL  — screen / standard quality (750 × 1050 px).
 *    Place files in  public/assets/backgrounds/small/<slug>.jpg
 *    Used for the live card preview and collection thumbnails (fast load).
 *
 *  • BACKGROUND_ASSETS        — print quality (1500 × 2100 px).
 *    Place files in  public/assets/backgrounds/<slug>.jpg
 *    Used only when the user prints or downloads the card (high fidelity).
 *
 * ── How to add a background ──────────────────────────────────────────────────
 *  1. Place the print-quality image in  public/assets/backgrounds/<slug>.jpg
 *     and register it in BACKGROUND_ASSETS below.
 *  2. Place the screen-quality image in public/assets/backgrounds/small/<slug>.jpg
 *     and register it in BACKGROUND_ASSETS_SMALL below.
 *
 * ── How to add a frame ───────────────────────────────────────────────────────
 *  1. Place the image in   public/assets/frames/<slug>.png        (see README there).
 *  2. Add (or uncomment) the rarity key below in FRAME_ASSETS.
 *
 * ── Getting the first-run URLs ───────────────────────────────────────────────
 *  After forging a card the browser console logs:
 *    [StaticAsset] Generated background for <District>: <URL>
 *    [StaticAsset] Generated frame for <Rarity>: <URL>
 *  Download those images, rename per the convention, place them in the
 *  appropriate folder, then register them here.
 */

import type { District, Rarity } from "../lib/types";

export type FrameBlendMode = "normal" | "screen";

interface FrameAssetConfig {
  url: string;
  blendMode?: FrameBlendMode;
  insetBackground?: boolean;
}

// ── Background registry — print / full quality ────────────────────────────────
//
// Files live in  public/assets/backgrounds/<slug>.jpg  (1500 × 2100 px).
// Used for print and JPEG download.  Uncomment an entry once you have placed
// the corresponding file.

const BACKGROUND_ASSETS: Partial<Record<District, string>> = {
  Airaway:      "/assets/backgrounds/airaway.jpg",
  Nightshade:   "/assets/backgrounds/nightshade.jpg",
  Batteryville: "/assets/backgrounds/batteryville.jpg",
  "The Grid":   "/assets/backgrounds/the-grid.jpg",
  "The Forest": "/assets/backgrounds/the-forest.jpg",
  "Glass City": "/assets/backgrounds/glass-city.jpg",
};

// ── Background registry — screen / standard quality ───────────────────────────
//
// Files live in  public/assets/backgrounds/small/<slug>.jpg  (750 × 1050 px).
// Used for the live card preview and collection thumbnails (faster load).
// Uncomment an entry once you have placed the corresponding file.

const BACKGROUND_ASSETS_SMALL: Partial<Record<District, string>> = {
  Airaway:      "/assets/backgrounds/small/airaway.jpg",
  Nightshade:   "/assets/backgrounds/small/nightshade.jpg",
  Batteryville: "/assets/backgrounds/small/batteryville.jpg",
  "The Grid":   "/assets/backgrounds/small/the-grid.jpg",
  "The Forest": "/assets/backgrounds/small/the-forest.jpg",
  "Glass City": "/assets/backgrounds/small/glass-city.jpg",
};

// ── Frame registry ─────────────────────────────────────────────────────────────
//
// Uncomment an entry once you have placed the corresponding file in
// public/assets/frames/.
//
// Example:
//   Legendary: { url: "/assets/frames/legendary.png" },

const FRAME_ASSETS: Partial<Record<Rarity, FrameAssetConfig>> = {
  // "Punch Skater": { url: "/assets/frames/punch-skater.png" },
  // Apprentice:     { url: "/assets/frames/apprentice.png" },
  // Master:         { url: "/assets/frames/master.png" },
  // Rare:           { url: "/assets/frames/rare.png" },
  // Legendary:      { url: "/assets/frames/legendary.png" },
};

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns the public URL of the **print-quality** static background image for
 * the given district (1500 × 2100 px), or null if not registered.
 *
 * Use this URL when printing or downloading — not for the on-screen preview.
 * When non-null the caller should use this URL instead of calling fal.ai.
 */
export function getStaticBackgroundUrl(district: District): string | null {
  return BACKGROUND_ASSETS[district] ?? null;
}

/**
 * Returns the public URL of the **screen-quality** static background image for
 * the given district (750 × 1050 px), or null if not registered.
 *
 * Use this URL for the live card preview and collection thumbnails.  Falls back
 * to null so the caller can fall back to getStaticBackgroundUrl if needed.
 */
export function getStaticBackgroundSmallUrl(district: District): string | null {
  return BACKGROUND_ASSETS_SMALL[district] ?? null;
}

/**
 * Returns the public URL of a pre-loaded static frame image for the given
 * rarity tier, or null if no static file has been registered yet.
 *
 * When non-null the caller should use this URL immediately, skipping both the
 * Firestore cache and the fal.ai generation step.
 */
export function getStaticFrameUrl(rarity: Rarity): string | null {
  return FRAME_ASSETS[rarity]?.url ?? null;
}

export function getFrameBlendMode(rarity: Rarity, frameUrl?: string): FrameBlendMode {
  if (!frameUrl) return "screen";
  const asset = FRAME_ASSETS[rarity];
  if (asset && asset.url === frameUrl) {
    return asset.blendMode ?? "normal";
  }
  return "screen";
}

export function shouldInsetBackgroundForFrame(rarity: Rarity, frameUrl?: string): boolean {
  if (!frameUrl) return false;
  const asset = FRAME_ASSETS[rarity];
  if (asset && asset.url === frameUrl) {
    return asset.insetBackground ?? false;
  }
  return rarity === "Punch Skater";
}
