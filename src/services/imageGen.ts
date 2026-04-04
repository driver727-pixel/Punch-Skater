import { hashSeedToInt } from "../utils/hash";

// ── Configuration ──────────────────────────────────────────────────────────────
//
// OPTION A — Direct access (simplest for local dev, exposes key to browser):
//   VITE_FAL_KEY=your_fal_ai_key_here
//
// OPTION B — Backend proxy (recommended for production):
//   1. Deploy server/index.js to any Node.js host (Render, Railway, etc.)
//      and set the FAL_KEY env var on that host.
//   2. Point VITE_IMAGE_API_URL at the deployed proxy endpoint, e.g.:
//        VITE_IMAGE_API_URL=https://your-server.onrender.com/api/generate-image
//
//   For local development, start the proxy with `npm start` (port 3001) and
//   set:  VITE_IMAGE_API_URL=/api/generate-image
//   The Vite dev server proxy (configured in vite.config.ts) will forward
//   /api/* requests to localhost:3001.
//
// When VITE_IMAGE_API_URL is set the Authorization header is omitted because
// the proxy adds it server-side.

const PROXY_API_URL = (import.meta.env.VITE_IMAGE_API_URL as string | undefined)?.trim();
const API_URL = PROXY_API_URL || "https://fal.run/fal-ai/flux/dev";
const FAL_KEY = (import.meta.env.VITE_FAL_KEY as string | undefined)?.trim();

/**
 * True when at least one of VITE_FAL_KEY or VITE_IMAGE_API_URL is configured,
 * so callers can gate image generation UI without attempting a doomed request.
 */
export const isImageGenConfigured = Boolean(PROXY_API_URL || FAL_KEY);

// ── Generation parameters ──────────────────────────────────────────────────────
// Adjust these to trade off quality vs. generation speed.

const IMAGE_SIZE         = "portrait_4_3";
const INFERENCE_STEPS    = 28;
const GUIDANCE_SCALE     = 3.5;
const NUM_IMAGES         = 1;
const SAFETY_CHECKER     = true;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ImageGenResult {
  imageUrl: string;
}

// ── Service ────────────────────────────────────────────────────────────────────

/**
 * Generate a card illustration via the Fal.ai FLUX.1 model.
 *
 * @param prompt     - Text description built by `buildImagePrompt()`.
 * @param masterSeed - The card's string master seed; hashed to a 32-bit int so
 *                     the same card always produces the same image.
 * @returns          Resolves with the URL of the generated image.
 * @throws           If the network request fails or the response is unexpected.
 */
export async function generateImage(
  prompt: string,
  masterSeed: string,
): Promise<ImageGenResult> {
  const seed = hashSeedToInt(masterSeed);

  // Build headers — omit Authorization when routing through the backend proxy
  // (the proxy adds the key server-side to keep it off the client).
  const headers: HeadersInit = { "Content-Type": "application/json" };
  const usingProxy = Boolean(PROXY_API_URL);
  if (!usingProxy && !FAL_KEY) {
    throw new Error(
      "Image generation is not configured. Set VITE_FAL_KEY for direct Fal.ai access or VITE_IMAGE_API_URL to route requests through a proxy.",
    );
  }

  if (!usingProxy && FAL_KEY) {
    headers["Authorization"] = `Key ${FAL_KEY}`;
  }

  const body = JSON.stringify({
    prompt,
    seed,
    image_size: IMAGE_SIZE,
    num_inference_steps: INFERENCE_STEPS,
    guidance_scale: GUIDANCE_SCALE,
    num_images: NUM_IMAGES,
    enable_safety_checker: SAFETY_CHECKER,
  });

  const response = await fetch(API_URL, { method: "POST", headers, body });

  if (!response.ok) {
    let detail = "";
    try {
      const errJson = await response.json();
      detail = errJson?.detail ?? errJson?.error ?? "";
    } catch {
      // ignore parse errors for the error body
    }
    const authHint =
      response.status === 401
        ? usingProxy
          ? " Check that the proxy server has a valid FAL_KEY configured."
          : " Check that VITE_FAL_KEY is set, or configure VITE_IMAGE_API_URL to use an authenticated proxy."
        : "";
    throw new Error(
      `Image generation failed: ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}${authHint}`,
    );
  }

  const data = await response.json();
  const imageUrl: string | undefined = data?.images?.[0]?.url;

  if (!imageUrl) {
    throw new Error("Image generation succeeded but no image URL was returned.");
  }

  return { imageUrl };
}
