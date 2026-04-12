import { hashSeedToInt } from "../utils/hash";

// ── Configuration ──────────────────────────────────────────────────────────────
//
// Image generation uses the backend proxy (Option B).
//
// Set VITE_IMAGE_API_URL in your .env:
//   Local dev:    VITE_IMAGE_API_URL=/api/generate-image
//                 (Vite proxies /api/* to the local server on port 3001)
//   Production:   VITE_IMAGE_API_URL=https://your-server.onrender.com/api/generate-image
//
// Start the proxy with:  FAL_KEY=your_fal_ai_key_here npm start
//
// The Authorization header is intentionally omitted from the browser request;
// the proxy adds the FAL_KEY server-side so the key never reaches the client.

const PROXY_API_URL = (import.meta.env.VITE_IMAGE_API_URL as string | undefined)?.trim();

// Derive the background-removal URL from the generation URL by replacing the
// last path segment.  e.g. "/api/generate-image" → "/api/remove-background".
const BG_REMOVAL_URL = PROXY_API_URL
  ? PROXY_API_URL.replace(/\/[^/]+$/, "/remove-background")
  : undefined;

/**
 * True when VITE_IMAGE_API_URL is configured,
 * so callers can gate image generation UI without attempting a doomed request.
 */
export const isImageGenConfigured = Boolean(PROXY_API_URL);

// ── Generation parameters ──────────────────────────────────────────────────────
// Adjust these to trade off quality vs. generation speed.

const IMAGE_SIZE         = "portrait_4_3";
const INFERENCE_STEPS    = 35;   // 35 produces noticeably sharper detail than 28; FLUX.1 dev quality sweet-spot
const GUIDANCE_SCALE     = 3.5;
const NUM_IMAGES         = 1;
const SAFETY_CHECKER     = true;

export interface ImageGenOptions {
  imageSize?: string | { width: number; height: number };
  numInferenceSteps?: number;
  guidanceScale?: number;
}

/**
 * MANDATORY negative prompt — automatically appended to every request inside
 * generateImage(). Safety terms can never be removed by editing prompt builders.
 * Quality terms (blur, low-res) are included here to prevent fuzzy outputs on
 * any seed, especially on the character layer after background removal.
 */
const NEGATIVE_PROMPT =
  "nsfw, child, children, under age, underage, x rated, r rated, unclothed, undressed, " +
  "nudity, naked, exposed, gore, sexually explicit, porn, pornographic, rape, sexual assault, " +
  "death, killing, kill, murder, violence, decapitation, mutilation, kids, minors, " +
  "blurry, blur, fuzzy, soft focus, out of focus, low resolution, low quality, degraded, " +
  "pixelated, jpeg artifacts, compression artifacts, watermark, signature";

/**
 * MANDATORY positive suffix — automatically appended to every prompt inside
 * generateImage(). These terms can never be removed by editing prompt builders.
 */
const MANDATORY_POSITIVE_SUFFIX =
  "safe-for-work, fully clothed, clearly adult subject, no childlike appearance, LGBTQIA+.";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ImageGenResult {
  imageUrl: string;
}

export interface ImageDimensions {
  width: number;
  height: number;
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
  options: ImageGenOptions = {},
): Promise<ImageGenResult> {
  const seed = hashSeedToInt(masterSeed);

  // Build headers — Authorization is omitted because the proxy adds it server-side.
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (!PROXY_API_URL) {
    throw new Error(
      "Image generation is not configured. Set VITE_IMAGE_API_URL in your .env to route requests through the proxy.",
    );
  }

  // Always append the mandatory safety suffix so it cannot be omitted regardless
  // of which prompt builder was used or how the prompt was constructed.
  const safePrompt = `${prompt} ${MANDATORY_POSITIVE_SUFFIX}`;

  const body = JSON.stringify({
    prompt: safePrompt,
    negative_prompt: NEGATIVE_PROMPT,
    seed,
    image_size: options.imageSize ?? IMAGE_SIZE,
    num_inference_steps: options.numInferenceSteps ?? INFERENCE_STEPS,
    guidance_scale: options.guidanceScale ?? GUIDANCE_SCALE,
    num_images: NUM_IMAGES,
    enable_safety_checker: SAFETY_CHECKER,
  });

  const response = await fetch(PROXY_API_URL, { method: "POST", headers, body });

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
        ? " Check that the proxy server has a valid FAL_KEY configured."
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

/**
 * Remove the background from a generated character image using the Fal.ai
 * birefnet model, returning a transparent PNG URL.
 *
 * @param imageUrl - URL of the source image (e.g. a white-background character portrait).
 * @returns        Resolves with the URL of the background-removed transparent image.
 * @throws         If the network request fails, the proxy is not configured, or no URL
 *                 is returned.
 */
export async function removeBackground(imageUrl: string): Promise<ImageGenResult> {
  if (!BG_REMOVAL_URL) {
    throw new Error(
      "Background removal is not configured. Set VITE_IMAGE_API_URL in your .env.",
    );
  }

  const headers: HeadersInit = { "Content-Type": "application/json" };
  const body = JSON.stringify({ image_url: imageUrl });

  const response = await fetch(BG_REMOVAL_URL, { method: "POST", headers, body });

  if (!response.ok) {
    let detail = "";
    try {
      const errJson = await response.json();
      detail = errJson?.detail ?? errJson?.error ?? "";
    } catch {
      // ignore parse errors for the error body
    }
    throw new Error(
      `Background removal failed: ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`,
    );
  }

  const data = await response.json();
  // Fal.ai birefnet returns { image: { url: "..." } }
  const resultUrl: string | undefined = data?.image?.url;

  if (!resultUrl) {
    throw new Error("Background removal succeeded but no image URL was returned.");
  }

  return { imageUrl: resultUrl };
}

export async function getImageDimensions(imageUrl: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error(`Failed to inspect generated image: ${imageUrl}`));
    img.src = imageUrl;
  });
}
