/**
 * staticAssets.ts
 *
 * Registry of pre-loaded static image assets for district backgrounds and rarity
 * frame borders.  When an entry is present here the app uses the static file
 * directly — no Firestore read and no fal.ai API call — eliminating per-forge
 * credit usage for stable layers.
 *
 * ── How to add a background ──────────────────────────────────────────────────
 *  1. Place the image in   public/assets/backgrounds/<slug>.jpg   (see README there).
 *  2. Add (or uncomment) the district key below in BACKGROUND_ASSETS.
 *
 * ── How to add a frame ───────────────────────────────────────────────────────
 *  1. Place the image in   public/assets/frames/<slug>.jpg        (see README there).
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

// ── Background registry ────────────────────────────────────────────────────────
//
// Uncomment an entry once you have placed the corresponding file in
// public/assets/backgrounds/.
//
// Example:
//   Airaway: "/assets/backgrounds/airaway.jpg",

const BACKGROUND_ASSETS: Partial<Record<District, string>> = {
  Airaway:      "/assets/backgrounds/airaway.jpg",
  Nightshade:   "/assets/backgrounds/nightshade.jpg",
  Batteryville: "/assets/backgrounds/batteryville.jpg",
  "The Grid":   "/assets/backgrounds/the-grid.jpg",
  "The Forest": "/assets/backgrounds/the-forest.jpg",
  "Glass City": "/assets/backgrounds/glass-city.jpg",
};

// ── Frame registry ─────────────────────────────────────────────────────────────
//
// Uncomment an entry once you have placed the corresponding file in
// public/assets/frames/.
//
// Example:
//   Legendary: "/assets/frames/legendary.jpg",

const FRAME_ASSETS: Partial<Record<Rarity, string>> = {
  // "Punch Skater": "/assets/frames/punch-skater.jpg",
  // Apprentice:     "/assets/frames/apprentice.jpg",
  // Master:         "/assets/frames/master.jpg",
  // Rare:           "/assets/frames/rare.jpg",
  // Legendary:      "/assets/frames/legendary.jpg",
};

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns the public URL of a pre-loaded static background image for the given
 * district, or null if no static file has been registered yet.
 *
 * When non-null the caller should use this URL immediately, skipping both the
 * Firestore cache and the fal.ai generation step.
 */
export function getStaticBackgroundUrl(district: District): string | null {
  return BACKGROUND_ASSETS[district] ?? null;
}

/**
 * Returns the public URL of a pre-loaded static frame image for the given
 * rarity tier, or null if no static file has been registered yet.
 *
 * When non-null the caller should use this URL immediately, skipping both the
 * Firestore cache and the fal.ai generation step.
 */
export function getStaticFrameUrl(rarity: Rarity): string | null {
  return FRAME_ASSETS[rarity] ?? null;
}
