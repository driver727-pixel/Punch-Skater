import { resolveApiUrl } from "../lib/apiUrls";
import type { BoardConfig } from "../lib/boardBuilder";
import { normalizeBoardConfig } from "../lib/boardBuilder";
import { getCategoryImages, getMatchingCategoryImages } from "../lib/boardCategoryImages";
import { getCachedImage, setCachedImage } from "./imageCache";

const BOARD_IMAGE_API_URL = resolveApiUrl(
  import.meta.env.VITE_BOARD_IMAGE_API_URL as string | undefined,
  "/api/generate-board-image",
);
const BOARD_IMAGE_CACHE_VERSION = "v3-nano-banana-gouache";
const BOARD_IMAGE_LOCAL_CACHE_PREFIX = "skpd_board_image_cache::";
const BOARD_IMAGE_PUBLIC_ORIGIN = "https://punchskater.com";

type BoardImageCategoryValue = {
  category: "deck" | "drivetrain" | "wheels" | "battery";
  value: string;
};

function getResolvedBoardReferenceUrls(config: BoardConfig): string[] {
  const normalizedConfig = normalizeBoardConfig(config);
  const selections: BoardImageCategoryValue[] = [
    { category: "deck", value: normalizedConfig.boardType },
    { category: "drivetrain", value: normalizedConfig.drivetrain },
    { category: "wheels", value: normalizedConfig.wheels },
    { category: "battery", value: normalizedConfig.battery },
  ];

  return selections.map(({ category, value }) => {
    const relativeUrl = getMatchingCategoryImages(category, value)[0] ?? getCategoryImages(category)[0] ?? null;
    if (!relativeUrl) {
      throw new Error(`Missing board reference image for ${category} "${value}".`);
    }
    return new URL(relativeUrl, BOARD_IMAGE_PUBLIC_ORIGIN).toString();
  });
}

function buildBoardPrompt(config: BoardConfig): string {
  const normalizedConfig = normalizeBoardConfig(config);
  return (
    "A stylized, gouache painting of a 'Punch Skater' electric skateboard. " +
    `The board features a ${normalizedConfig.boardType} deck, ${normalizedConfig.drivetrain} drivetrain, and ${normalizedConfig.wheels} wheels. ` +
    `A ${normalizedConfig.battery} battery case is securely mounted. ` +
    "The artwork features matte, opaque brushwork, thick textures, and a clean, neutral studio gray background suitable for a UI cutout."
  );
}

function slugFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  return pathname.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? "unknown";
}

function buildBoardImageCacheKey(config: BoardConfig, imageUrls: readonly string[]): string {
  const normalizedConfig = normalizeBoardConfig(config);
  return [
    "board-img",
    BOARD_IMAGE_CACHE_VERSION,
    normalizedConfig.boardType.toLowerCase(),
    ...imageUrls.map(slugFromUrl),
  ].join("::");
}

function getLocalCachedBoardImage(cacheKey: string): string | null {
  try {
    return localStorage.getItem(`${BOARD_IMAGE_LOCAL_CACHE_PREFIX}${cacheKey}`);
  } catch {
    return null;
  }
}

function setLocalCachedBoardImage(cacheKey: string, imageUrl: string): void {
  try {
    localStorage.setItem(`${BOARD_IMAGE_LOCAL_CACHE_PREFIX}${cacheKey}`, imageUrl);
  } catch {
    // Non-critical local cache write.
  }
}

export async function generateGouacheBoard(config: BoardConfig): Promise<string> {
  const imageUrls = getResolvedBoardReferenceUrls(config);
  const cacheKey = buildBoardImageCacheKey(config, imageUrls);
  const cachedLocal = getLocalCachedBoardImage(cacheKey);
  if (cachedLocal) {
    return cachedLocal;
  }

  const cachedRemote = await getCachedImage(cacheKey);
  if (cachedRemote) {
    setLocalCachedBoardImage(cacheKey, cachedRemote);
    return cachedRemote;
  }

  const response = await fetch(BOARD_IMAGE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: buildBoardPrompt(config),
      imageUrls,
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const errorBody = await response.json();
      detail = errorBody?.detail ?? errorBody?.error ?? "";
    } catch {
      // Ignore malformed error bodies.
    }
    throw new Error(
      `Board image generation failed: ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`,
    );
  }

  const data = await response.json() as { imageUrl?: string };
  if (!data.imageUrl) {
    throw new Error("Board image generation succeeded but no image URL was returned.");
  }

  setLocalCachedBoardImage(cacheKey, data.imageUrl);
  await setCachedImage(cacheKey, data.imageUrl, {
    prompt: buildBoardPrompt(config),
    layer: "board-img",
    seed: cacheKey,
  });
  return data.imageUrl;
}
