/**
 * Card download service — composites all three AI art layers onto a canvas
 * and triggers a JPEG download.
 *
 * Layer blend modes (mirroring .card-art-layer--* in index.css):
 *   background — source-over / normal
 *   character  — source-over / normal, with opacity = characterBlend (0–1)
 *   frame      — screen (black in the frame image becomes transparent; coloured
 *                border remains visible)
 */

/** Output dimensions for the downloaded card (poker card at 300 dpi). */
const CARD_WIDTH  = 750;
const CARD_HEIGHT = 1050;

function loadCrossOriginImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load layer image: ${url}`));
    // Set src after attaching handlers to avoid a race condition on cached images.
    img.src = url;
  });
}

/**
 * Flatten all AI art layers onto a canvas and download the result as a JPEG.
 *
 * @param cardName       - Used as the downloaded filename stem.
 * @param backgroundUrl  - District background layer URL.
 * @param characterUrl   - Character portrait layer URL (transparent PNG after birefnet).
 * @param frameUrl       - Rarity frame border layer URL.
 * @param characterBlend - Opacity of the character layer (0–1, default 1).
 */
export async function downloadCardAsJpg(
  cardName: string,
  backgroundUrl: string | undefined,
  characterUrl: string | undefined,
  frameUrl: string | undefined,
  characterBlend = 1,
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width  = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable in this browser.");

  // ── Layer 1: background (normal blend) ────────────────────────────────────
  if (backgroundUrl) {
    const img = await loadCrossOriginImage(backgroundUrl);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(img, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  // ── Layer 2: character (normal blend, user-controlled opacity) ─────────────
  if (characterUrl) {
    const img = await loadCrossOriginImage(characterUrl);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = Math.max(0, Math.min(1, characterBlend));
    ctx.drawImage(img, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    ctx.globalAlpha = 1;
  }

  // ── Layer 3: frame (screen blend — black frame interior becomes transparent) ─
  if (frameUrl) {
    const img = await loadCrossOriginImage(frameUrl);
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 1;
    ctx.drawImage(img, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  // Reset to defaults before export so nothing bleeds into the encoding pass.
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // ── Export as JPEG ─────────────────────────────────────────────────────────
  await new Promise<void>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas failed to produce a JPEG blob."));
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        const anchor    = document.createElement("a");
        anchor.href     = objectUrl;
        anchor.download = `${cardName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.jpg`;
        anchor.click();
        // Revoke after a short delay so the browser can finish reading the blob.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 15_000);
        resolve();
      },
      "image/jpeg",
      0.92,
    );
  });
}
