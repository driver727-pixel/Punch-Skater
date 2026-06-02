/**
 * racerSpriteGen.ts — client service for generating Arcade Racer character
 * sprite sheets via the fal.ai `nano-banana-2` proxy.
 *
 * Flow: submit a clean character reference URL + a sprite-sheet prompt, poll the
 * queue-backed status endpoint until the sheet is ready, then optionally remove
 * the background so the committed PNG has clean transparency.
 */
import { auth } from "../lib/firebase";
import { resolveApiUrl } from "../lib/apiUrls";
import {
  buildRacerSpriteSheetPrompt,
  RACER_SPRITE_SHEET_IMAGE_SIZE,
} from "../lib/arcadeRacerSprites";
import { removeBackground } from "./imageGen";

const RACER_SPRITE_API_URL = resolveApiUrl(
  import.meta.env.VITE_RACER_SPRITE_API_URL as string | undefined,
  "/api/generate-racer-sprite",
);
// Derive the status-polling URL from the generation URL, e.g.
// "/api/generate-racer-sprite" → "/api/racer-sprite-status"
const RACER_SPRITE_STATUS_BASE_URL = RACER_SPRITE_API_URL.replace(
  /\/[^/]+$/,
  "/racer-sprite-status",
);

const POLL_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_FAST_MS = 3_000;
const POLL_INTERVAL_SLOW_MS = 5_000;
const POLL_SLOW_THRESHOLD_MS = 30_000;

async function buildAuthorizedJsonHeaders(): Promise<HeadersInit> {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Sign in as an admin to generate racer sprites.");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function isSubmitResponse(value: unknown): value is { jobId: string } {
  return Boolean(value) && typeof value === "object" && typeof (value as { jobId?: unknown }).jobId === "string";
}

type PollStatus =
  | { status: "pending" }
  | { status: "completed"; imageUrl: string }
  | { status: "failed"; error: string };

function isPollStatus(value: unknown): value is PollStatus {
  if (!value || typeof value !== "object") return false;
  const s = (value as { status?: unknown }).status;
  return s === "pending" || s === "completed" || s === "failed";
}

async function pollRacerSpriteJob(jobId: string): Promise<string> {
  const headers = await buildAuthorizedJsonHeaders();
  const started = Date.now();
  while (true) {
    const statusUrl = `${RACER_SPRITE_STATUS_BASE_URL}/${encodeURIComponent(jobId)}`;
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
        `Racer sprite status check failed: ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`,
      );
    }

    const data: unknown = await response.json();
    if (!isPollStatus(data)) {
      throw new Error("Unexpected response from racer sprite status endpoint.");
    }

    if (data.status === "completed") return data.imageUrl;
    if (data.status === "failed") {
      throw new Error(`Racer sprite generation failed: ${data.error}`);
    }

    const elapsed = Date.now() - started;
    if (elapsed >= POLL_TIMEOUT_MS) {
      throw new Error("Racer sprite generation timed out after polling for 180 s.");
    }
    await new Promise<void>((resolve) =>
      setTimeout(
        resolve,
        elapsed < POLL_SLOW_THRESHOLD_MS ? POLL_INTERVAL_FAST_MS : POLL_INTERVAL_SLOW_MS,
      ),
    );
  }
}

export interface GenerateRacerSpriteOptions {
  /** Optional character name woven into the prompt for better likeness. */
  characterName?: string;
  /** When true (default), runs the sheet through background removal. */
  removeSheetBackground?: boolean;
}

/**
 * Generate an animated isometric sprite sheet from a clean character reference.
 *
 * @param referenceImageUrl - URL of the isolated character (no background,
 *                            frame, weapon, or skateboard deck). Must be on an
 *                            approved remote host (Firebase Storage / fal CDN).
 * @returns The URL of the generated (and background-removed) sprite sheet.
 */
export async function generateRacerSpriteSheet(
  referenceImageUrl: string,
  options: GenerateRacerSpriteOptions = {},
): Promise<string> {
  const submitResponse = await fetch(RACER_SPRITE_API_URL, {
    method: "POST",
    headers: await buildAuthorizedJsonHeaders(),
    body: JSON.stringify({
      prompt: buildRacerSpriteSheetPrompt(options.characterName),
      imageUrl: referenceImageUrl,
      imageSize: RACER_SPRITE_SHEET_IMAGE_SIZE,
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
      `Racer sprite generation failed: ${submitResponse.status} ${submitResponse.statusText}${detail ? ` — ${detail}` : ""}`,
    );
  }

  const submitData: unknown = await submitResponse.json();
  if (!isSubmitResponse(submitData)) {
    throw new Error("Racer sprite generation submission returned an unexpected response.");
  }

  const sheetUrl = await pollRacerSpriteJob(submitData.jobId);

  if (options.removeSheetBackground === false) {
    return sheetUrl;
  }
  const transparent = await removeBackground(sheetUrl);
  return transparent.imageUrl;
}
