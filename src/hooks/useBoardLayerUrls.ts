/**
 * useBoardLayerUrls.ts
 *
 * Resolves the four board composite layer URLs for a given BoardConfig.
 *
 * Resolution priority per layer:
 *   1. Static PNG at /assets/boards/<seedKey>.png  — used if the file exists
 *      (checked once via a lightweight HEAD request).
 *   2. Firestore imageCache entry `board::<seedKey>` — a previously generated
 *      fal.ai placeholder URL.
 *   3. fal.ai image generation — triggered when no static file and no cached
 *      URL exist and VITE_IMAGE_API_URL is configured.  The result is written
 *      to the imageCache for future visits.
 *   4. null — returned when the component has no seed key or the image API is
 *      not configured and no cached URL exists.
 */

import { useState, useEffect, useRef } from "react";
import type { BoardConfig } from "../lib/boardBuilder";
import {
  BOARD_COMPONENT_CATALOG,
  getBoardAssetUrls,
  BATTERY_OPTIONS,
} from "../lib/boardBuilder";
import { getCachedImage, setCachedImage } from "../services/imageCache";
import { generateImage, isImageGenConfigured } from "../services/imageGen";

// ── Helpers ────────────────────────────────────────────────────────────────────

const BOARD_CACHE_PREFIX = "board";

function makeCacheKey(seedKey: string): string {
  return `${BOARD_CACHE_PREFIX}::${seedKey}`;
}

function getBoardComponentPrompt(seedKey: string): string | null {
  return BOARD_COMPONENT_CATALOG.find((m) => m.seedKey === seedKey)?.description ?? null;
}

/**
 * Returns true when a static asset exists at the given path.
 * Uses a HEAD request so no image data is transferred.
 * Any network error is treated as "not found" to avoid blocking the UI.
 */
async function staticAssetExists(path: string): Promise<boolean> {
  try {
    const res = await fetch(path, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolves the URL for a single board layer component.
 *
 * @param seedKey   - Component seed key from BOARD_COMPONENT_CATALOG.
 * @param staticUrl - The static /assets/boards/<seedKey>.png path to probe first.
 * @returns Resolved URL string, or null if unavailable.
 */
async function resolveLayerUrl(
  seedKey: string,
  staticUrl: string,
): Promise<string | null> {
  // 1. Static file probe — zero extra cost if the file already exists.
  if (await staticAssetExists(staticUrl)) {
    return staticUrl;
  }

  // 2. Firestore cache.
  const cacheKey = makeCacheKey(seedKey);
  const cached = await getCachedImage(cacheKey);
  if (cached) return cached;

  // 3. fal.ai generation.
  if (!isImageGenConfigured) return null;

  const prompt = getBoardComponentPrompt(seedKey);
  if (!prompt) return null;

  try {
    const result = await generateImage(prompt, seedKey, { imageSize: "square_hd" });
    await setCachedImage(cacheKey, result.imageUrl);
    return result.imageUrl;
  } catch (err) {
    console.warn(`Board layer generation failed for "${seedKey}":`, err);
    return null;
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export interface BoardLayerUrls {
  deckUrl: string | null;
  drivetrainUrl: string | null;
  wheelsUrl: string | null;
  batteryUrl: string | null;
  batteryIsTopMounted: boolean;
  /** True while any layer is still being resolved. */
  loading: boolean;
}

/**
 * Resolves board composite layer image URLs for the given BoardConfig,
 * using fal.ai-generated placeholders for any component that lacks a static
 * asset.  Resolved URLs are cached in Firestore so subsequent visits are
 * instant.
 */
export function useBoardLayerUrls(config: BoardConfig): BoardLayerUrls {
  const staticResult = getBoardAssetUrls(config);
  const batteryIsTopMounted =
    BATTERY_OPTIONS.find((o) => o.value === config.battery)?.isTopMounted ?? false;

  const [urls, setUrls] = useState<{
    deck: string | null;
    drivetrain: string | null;
    wheels: string | null;
    battery: string | null;
  }>({ deck: null, drivetrain: null, wheels: null, battery: null });

  const [loading, setLoading] = useState(true);

  // Stable ref so async callbacks never close over a stale config.
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setUrls({ deck: null, drivetrain: null, wheels: null, battery: null });

    const layers: Array<{
      key: keyof typeof urls;
      seedUrl: string | null;
    }> = [
      { key: "deck",        seedUrl: staticResult.deckUrl },
      { key: "drivetrain",  seedUrl: staticResult.drivetrainUrl },
      { key: "wheels",      seedUrl: staticResult.wheelsUrl },
      { key: "battery",     seedUrl: staticResult.batteryUrl },
    ];

    // Resolve all four layers concurrently so the composite fills in as each
    // layer becomes available rather than waiting for the slowest one.
    const promises = layers.map(async ({ key, seedUrl }) => {
      if (!seedUrl) return;

      // seedUrl is already in the form "/assets/boards/<seedKey>.png".
      // Extract the seedKey from it.
      const seedKey = seedUrl.replace("/assets/boards/", "").replace(".png", "");
      const resolved = await resolveLayerUrl(seedKey, seedUrl);

      if (!cancelled) {
        setUrls((prev) => ({ ...prev, [key]: resolved }));
      }
    });

    Promise.all(promises).then(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
    // Depend on the four individual seed URLs so we re-resolve when the user
    // switches a component but not on every parent render.
  }, [
    staticResult.deckUrl,
    staticResult.drivetrainUrl,
    staticResult.wheelsUrl,
    staticResult.batteryUrl,
  ]);

  return {
    deckUrl:             urls.deck,
    drivetrainUrl:       urls.drivetrain,
    wheelsUrl:           urls.wheels,
    batteryUrl:          urls.battery,
    batteryIsTopMounted,
    loading,
  };
}
