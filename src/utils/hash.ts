/**
 * FNV-1a 32-bit hash — maps an arbitrary string to an unsigned 32-bit integer
 * in [0, 4294967295].
 *
 * This is used to convert the string-based masterSeed into a valid integer seed
 * for AI image generation models (e.g. Fal.ai-hosted FLUX LoRA models) while preserving the
 * existing 1:1 reproducibility guarantee: the same masterSeed always produces
 * the same integer, and therefore the same generated image.
 *
 * Reference: https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
 */
export function hashSeedToInt(seed: string): number {
  let hash = 0x811c9dc5; // FNV-1a offset basis (32-bit)
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    // Math.imul gives correct 32-bit multiplication in JS
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0; // coerce to unsigned 32-bit result
}
