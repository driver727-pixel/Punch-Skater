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
 *    Place files in  public/assets/backgrounds/small/<slug>.webp
 *    Used for the live card preview and collection thumbnails (fast load).
 *
 *  • BACKGROUND_ASSETS        — print quality (1500 × 2100 px).
 *    Place files in  public/assets/backgrounds/<slug>.webp
 *    Used only when the user prints or downloads the card (high fidelity).
 *
 * ── How to add a background ──────────────────────────────────────────────────
 *  1. Place the print-quality image in  public/assets/backgrounds/<slug>.webp
 *     and register it in BACKGROUND_ASSETS below.
 *  2. Place the screen-quality image in public/assets/backgrounds/small/<slug>.webp
 *     and register it in BACKGROUND_ASSETS_SMALL below.
 *
 * ── How to add a frame ───────────────────────────────────────────────────────
 *  1. Place the image in   public/assets/frames/<slug>.webp       (see README there).
 *  2. Add (or uncomment) the rarity key below in FRAME_ASSETS.
 *
 * ── Getting the first-run URLs ───────────────────────────────────────────────
 *  After forging a card the browser console logs:
 *    [StaticAsset] Generated background for <District>: <URL>
 *    [StaticAsset] Generated frame for <Rarity>: <URL>
 *  Download those images, rename per the convention, place them in the
 *  appropriate folder, then register them here.
 */

import type { District, Faction, Rarity } from "../lib/types";

export type FrameBlendMode = "normal" | "screen";

interface FrameAssetConfig {
  /** Front-face frame image (overlaid above background + character). */
  url: string;
  /**
   * Optional back-face frame image.  When set, this image is overlaid on top
   * of the rendered card-back so the border can wrap continuously around the
   * front and back faces (e.g. corner bandages on the Punch Skater frame).
   */
  backUrl?: string;
  blendMode?: FrameBlendMode;
  insetBackground?: boolean;
}

// ── Background registry — print / full quality ────────────────────────────────
//
// Files live in  public/assets/backgrounds/<slug>.webp  (1500 × 2100 px).
// Used for print and JPEG download.  Uncomment an entry once you have placed
// the corresponding file.

const BACKGROUND_ASSETS: Partial<Record<District, string>> = {
  Airaway:      "/assets/backgrounds/airaway.webp",
  Nightshade:   "/assets/backgrounds/nightshade.webp",
  Batteryville: "/assets/backgrounds/batteryville.webp",
  "The Grid":   "/assets/backgrounds/the-grid.webp",
  "The Forest": "/assets/backgrounds/the-forest.webp",
  "Glass City": "/assets/backgrounds/glass-city.webp",
};

// ── Background registry — screen / standard quality ───────────────────────────
//
// Files live in  public/assets/backgrounds/small/<slug>.webp  (750 × 1050 px).
// Used for the live card preview and collection thumbnails (faster load).
// Uncomment an entry once you have placed the corresponding file.

const BACKGROUND_ASSETS_SMALL: Partial<Record<District, string>> = {
  Airaway:      "/assets/backgrounds/small/airaway.webp",
  Nightshade:   "/assets/backgrounds/small/nightshade.webp",
  Batteryville: "/assets/backgrounds/small/batteryville.webp",
  "The Grid":   "/assets/backgrounds/small/the-grid.webp",
  "The Forest": "/assets/backgrounds/small/the-forest.webp",
  "Glass City": "/assets/backgrounds/small/glass-city.webp",
};

// ── Frame registry ─────────────────────────────────────────────────────────────
//
// Uncomment an entry once you have placed the corresponding file in
// public/assets/frames/.
//
// Example:
//   Legendary: { url: "/assets/frames/legendary.webp" },

const FRAME_ASSETS: Partial<Record<Rarity, FrameAssetConfig>> = {
  "Punch Skater": {
    url:     "/assets/frames/punch-skater-front.png",
    backUrl: "/assets/frames/punch-skater-rear.png",
  },
  Apprentice:     { url: "/assets/frames/apprentice.webp" },
  Master:         { url: "/assets/frames/master.webp" },
  Rare:           { url: "/assets/frames/rare.webp" },
  Legendary:      { url: "/assets/frames/legendary.webp" },
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

/**
 * Returns the public URL of the pre-loaded static frame image to overlay on
 * the **back** face of the card for the given rarity, or null if no
 * back-specific frame is registered.  When set, the back-face frame should be
 * rendered the same way as the front-face frame so that border decorations
 * (e.g. corner bandages) appear to wrap continuously around the card.
 */
export function getStaticFrameBackUrl(rarity: Rarity): string | null {
  return FRAME_ASSETS[rarity]?.backUrl ?? null;
}

export function shouldRenderSvgFrame(rarity: Rarity, frameUrl?: string): boolean {
  if (!frameUrl) return true;
  return FRAME_ASSETS[rarity]?.url === frameUrl;
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

// ── Faction background registry ───────────────────────────────────────────────
//
// Files live in  public/assets/factions/<slug>.webp
// Used as the background image on the Factions page faction cards.
// Firebase-uploaded images (from the Admin panel) take precedence over these.
// Add an entry here once you have placed the corresponding file in that folder.

const FACTION_ASSETS: Partial<Record<Faction, string>> = {
  "D4rk $pider":                          "/assets/factions/d4rk_pider.webp",
  "Hermes' Squirmies":                    "/assets/factions/hermes_squirmies.webp",
  "Iron Curtains":                        "/assets/factions/iron_curtains.webp",
  "Ne0n Legion":                          "/assets/factions/ne0n_legion.webp",
  "Qu111s (Quills)":                      "/assets/factions/qu111s_quills.webp",
  "The Asclepians":                       "/assets/factions/the_asclepians.webp",
  "The Knights Technarchy":               "/assets/factions/the_knights_technarchy.webp",
  "The Mesopotamian Society":             "/assets/factions/the_mesopotamian_society.webp",
  "The Team":                             "/assets/factions/the_team.webp",
  "The Wooders":                          "/assets/factions/the_wooders.webp",
  "United Corporations of America (UCA)": "/assets/factions/uca.webp",
  "UCPS Workers":                         "/assets/factions/ucps_workers.webp",
  "Punch Skaters":                        "/assets/factions/punch_skaters.png",
};

/**
 * Returns the public URL of the static faction background image for the given
 * faction name, or null if no static file has been registered.
 *
 * Firebase-uploaded images should take precedence over this value.
 */
export function getStaticFactionImageUrl(faction: Faction): string | null {
  return FACTION_ASSETS[faction] ?? null;
}
