import { auth } from "../lib/firebase";
import { ELECTRIC_SKATEBOARD_EXCLUSIONS } from "../lib/promptBuilder";
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

async function buildAuthorizedJsonHeaders(): Promise<HeadersInit> {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Sign in to forge or edit AI-generated artwork.");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ── Generation parameters ──────────────────────────────────────────────────────
// Adjust these to trade off quality vs. generation speed.

const IMAGE_SIZE         = { width: 750, height: 1050 };
const INFERENCE_STEPS    = 28;
const GUIDANCE_SCALE     = 3.5;
const NUM_IMAGES         = 1;
const SAFETY_CHECKER     = true;
const OUTPUT_FORMAT      = "png";

export interface FalLoraConfig {
  path: string;
  scale: number;
}

export interface ImageGenOptions {
  imageSize?: string | { width: number; height: number };
  numInferenceSteps?: number;
  guidanceScale?: number;
  loras?: FalLoraConfig[];
  falProfile?: "default" | "character";
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
  "scooter, kick scooter, mobility scooter, mobility chair, roller skates, inline skates, rollerskates, " +
  "hoverboard, self-balancing scooter, self balancing scooter, segway, unicycle, mono wheel, monowheel, " +
  "caster wheels, swivel wheels, shopping cart wheels, sideways wheels, perpendicular wheels, " +
  "blurry, blur, fuzzy, soft focus, out of focus, low resolution, low quality, degraded, " +
  "pixelated, jpeg artifacts, compression artifacts, watermark, signature, " +
  "photograph, photography, photorealistic, photo-realistic, realistic skin pores, live action, live-action, " +
  "cinema still, DSLR, studio photo, stock photo, hyperreal, hyper-real, 3d render, CGI, octane render, " +
  "anime, manga, chibi, super-deformed, mascot costume, toy-like proportions, pixar, disney, cel shading, cel-shaded, " +
  "watercolor, oil painting, painterly, charcoal sketch, pastel drawing, minimalist flat design";

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
 * Generate a card illustration via the Fal.ai proxy.
 *
 * @param prompt     - Text description built by one of the image prompt builders.
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

  if (!PROXY_API_URL) {
    throw new Error(
      "Image generation is not configured. Set VITE_IMAGE_API_URL in your .env to route requests through the proxy.",
    );
  }
  const headers = await buildAuthorizedJsonHeaders();

  // Always append the mandatory safety suffix so it cannot be omitted regardless
  // of which prompt builder was used or how the prompt was constructed.
  const safePrompt = `${prompt} ${MANDATORY_POSITIVE_SUFFIX}`;

  // For character generations, append skateboard exclusions to the negative prompt
  // so the model is steered away from non-skateboard vehicles on both axes.
  const negativePrompt =
    options.falProfile === "character"
      ? `${NEGATIVE_PROMPT} ${ELECTRIC_SKATEBOARD_EXCLUSIONS}`
      : NEGATIVE_PROMPT;

  const body = JSON.stringify({
    prompt: safePrompt,
    negative_prompt: negativePrompt,
    seed,
    image_size: options.imageSize ?? IMAGE_SIZE,
    num_inference_steps: options.numInferenceSteps ?? INFERENCE_STEPS,
    guidance_scale: options.guidanceScale ?? GUIDANCE_SCALE,
    loras: options.loras,
    fal_profile: options.falProfile,
    num_images: NUM_IMAGES,
    enable_safety_checker: SAFETY_CHECKER,
    output_format: OUTPUT_FORMAT,
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
        ? " Confirm you are signed in and that the proxy server has Firebase Admin + FAL_KEY configured."
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

  const headers = await buildAuthorizedJsonHeaders();
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
