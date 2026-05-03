export interface FocalCrop {
  /** CSS object-position value, e.g. "32% 67%" */
  objectPosition: string;
}

/**
 * Deterministically derive a focal-point crop for a card face from the
 * card's frameSeed.  Front and back use different seed-mixing so the
 * same district image shows two distinct compositions.
 *
 * Uses FNV-1a to produce stable, well-distributed x/y percentages.
 * Re-renders of the same card always produce the same crop.
 */
export function computeFocalCrop(frameSeed: string | number, face: "front" | "back"): FocalCrop {
  // Separate face from seed with a character that can't appear in a frameSeed
  // (frameSeeds are alphanumeric/UUID-like, so '|' is safe as a delimiter).
  const input = String(frameSeed) + "|" + face;

  // FNV-1a 32-bit hash
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }

  // Derive x from the low 16 bits, y from the high 16 bits
  const x = (h & 0xffff) % 101;        // 0–100
  const y = ((h >>> 16) & 0xffff) % 101; // 0–100

  return { objectPosition: `${x}% ${y}%` };
}
