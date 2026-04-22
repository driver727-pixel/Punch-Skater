import { resolveApiUrl } from "../lib/apiUrls";
import type { BoardConfig } from "../lib/boardBuilder";
import { normalizeBoardConfig } from "../lib/boardBuilder";
import { getCategoryImages, getMatchingCategoryImages } from "../lib/boardCategoryImages";
import { auth } from "../lib/firebase";
import { getCachedImage, setCachedImage } from "./imageCache";

const BOARD_IMAGE_API_URL = resolveApiUrl(
  import.meta.env.VITE_BOARD_IMAGE_API_URL as string | undefined,
  "/api/generate-board-image",
);
// Derive the status-polling URL from the generation URL, e.g.
// "/api/generate-board-image" → "/api/board-image-status"
const BOARD_IMAGE_STATUS_BASE_URL = BOARD_IMAGE_API_URL.replace(
  /\/[^/]+$/,
  "/board-image-status",
);
// Increment when the board-generation prompt, model, or cache-key inputs change
// in a way that should invalidate previously generated board art.
const BOARD_IMAGE_CACHE_VERSION = "v4-fal-gouache-board-square";
const BOARD_IMAGE_LOCAL_CACHE_PREFIX = "skpd_board_image_cache::";
const BOARD_IMAGE_PUBLIC_ORIGIN = "https://punchskater.com";

// Maximum wall-clock time (ms) the client will poll before giving up.
const BOARD_IMAGE_POLL_TIMEOUT_MS = 120_000;
// Initial polling interval; increases to BOARD_IMAGE_POLL_INTERVAL_SLOW_MS
// after the first 30 s to avoid hammering the server on longer jobs.
const BOARD_IMAGE_POLL_INTERVAL_FAST_MS = 3_000;
const BOARD_IMAGE_POLL_INTERVAL_SLOW_MS = 5_000;
const BOARD_IMAGE_POLL_SLOW_THRESHOLD_MS = 30_000;

async function buildAuthorizedJsonHeaders(): Promise<HeadersInit> {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Sign in to generate board artwork.");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

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
  ];
  if (normalizedConfig.battery !== "SlimStealth") {
    selections.push({ category: "battery", value: normalizedConfig.battery });
  }

  return selections.map(({ category, value }) => {
    const matchingImage = getMatchingCategoryImages(category, value)[0] ?? null;
    const fallbackImage = getCategoryImages(category)[0] ?? null;
    const relativeUrl = matchingImage ?? fallbackImage;
    if (!relativeUrl) {
      throw new Error(`No board reference images are available in the ${category} category.`);
    }
    return new URL(relativeUrl, BOARD_IMAGE_PUBLIC_ORIGIN).toString();
  });
}

function buildBoardPrompt(config: BoardConfig): string {
  const normalizedConfig = normalizeBoardConfig(config);
  const batterySentence =
    normalizedConfig.battery === "SlimStealth"
      ? ""
      : `A ${normalizedConfig.battery} battery case is securely mounted. `;
  return (
    "A stylized, gouache painting of a 'Punch Skater' electric skateboard. " +
    `The board features a ${normalizedConfig.boardType} deck, ${normalizedConfig.drivetrain} drivetrain, and ${normalizedConfig.wheels} wheels. ` +
    `It uses ${normalizedConfig.motor} motors matched to the selected performance setup. ` +
    batterySentence +
    "The artwork features matte, opaque brushwork, thick textures, and a clean, neutral studio gray background suitable for a UI cutout."
  );
}

function toCacheToken(value: string): string {
  return value.trim().replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/\s+/g, "-").toLowerCase();
}

function buildBoardImageCacheKey(config: BoardConfig, imageUrls: readonly string[]): string {
  const normalizedConfig = normalizeBoardConfig(config);
  return [
    "board-img",
    BOARD_IMAGE_CACHE_VERSION,
    toCacheToken(normalizedConfig.boardType),
    toCacheToken(normalizedConfig.drivetrain),
    toCacheToken(normalizedConfig.motor),
    toCacheToken(normalizedConfig.wheels),
    toCacheToken(normalizedConfig.battery),
    ...imageUrls,
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

function isBoardImageSubmitResponse(value: unknown): value is { jobId: string } {
  return Boolean(value) && typeof value === "object" && typeof (value as { jobId?: unknown }).jobId === "string";
}

type BoardImagePollStatus =
  | { status: "pending" }
  | { status: "completed"; imageUrl: string }
  | { status: "failed"; error: string };

function isBoardImagePollStatus(value: unknown): value is BoardImagePollStatus {
  if (!value || typeof value !== "object") return false;
  const s = (value as { status?: unknown }).status;
  return s === "pending" || s === "completed" || s === "failed";
}

async function pollBoardImageJob(jobId: string): Promise<string> {
  const headers = await buildAuthorizedJsonHeaders();
  const started = Date.now();
  while (true) {
    const statusUrl = `${BOARD_IMAGE_STATUS_BASE_URL}/${encodeURIComponent(jobId)}`;
    const response = await fetch(statusUrl, { headers });

    if (!response.ok) {
      let detail = "";
      try {
        const errBody = await response.json();
        detail = errBody?.error ?? "";
      } catch {
        // Ignore malformed error bodies.
      }
      throw new Error(
        `Board image status check failed: ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`,
      );
    }

    const data: unknown = await response.json();
    if (!isBoardImagePollStatus(data)) {
      throw new Error("Unexpected response from board image status endpoint.");
    }

    if (data.status === "completed") return data.imageUrl;
    if (data.status === "failed") {
      throw new Error(`Board image generation failed: ${data.error}`);
    }

    // status === 'pending' — wait before the next poll
    const elapsed = Date.now() - started;
    if (elapsed >= BOARD_IMAGE_POLL_TIMEOUT_MS) {
      throw new Error("Board image generation timed out after polling for 120 s.");
    }
    await new Promise<void>((resolve) =>
      setTimeout(
        resolve,
        elapsed < BOARD_IMAGE_POLL_SLOW_THRESHOLD_MS
          ? BOARD_IMAGE_POLL_INTERVAL_FAST_MS
          : BOARD_IMAGE_POLL_INTERVAL_SLOW_MS,
      ),
    );
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

  // Submit the job — server returns immediately with a jobId so the
  // 30-second Render proxy timeout is never hit.
  const submitResponse = await fetch(BOARD_IMAGE_API_URL, {
    method: "POST",
    headers: await buildAuthorizedJsonHeaders(),
    body: JSON.stringify({
      prompt: buildBoardPrompt(config),
      imageUrls,
    }),
  });

  if (!submitResponse.ok) {
    let detail = "";
    try {
      const errorBody = await submitResponse.json();
      detail = errorBody?.detail ?? errorBody?.error ?? "";
    } catch {
      // Ignore malformed error bodies.
    }
    throw new Error(
      `Board image generation failed: ${submitResponse.status} ${submitResponse.statusText}${detail ? ` — ${detail}` : ""}`,
    );
  }

  const submitData: unknown = await submitResponse.json();
  if (!isBoardImageSubmitResponse(submitData)) {
    throw new Error("Board image generation submission returned an unexpected response.");
  }

  // Poll until the job completes (or times out).
  const imageUrl = await pollBoardImageJob(submitData.jobId);

  setLocalCachedBoardImage(cacheKey, imageUrl);
  await setCachedImage(cacheKey, imageUrl, {
    prompt: buildBoardPrompt(config),
    layer: "board-img",
    seed: cacheKey,
  });
  return imageUrl;
}
