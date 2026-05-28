/**
 * Converts a frame ID into its canonical CSS-safe form.
 * @param frameId Raw frame ID, optionally prefixed with `frame-`.
 * @returns Lowercase frame ID with invalid characters replaced by dashes.
 */
export function normalizeCosmeticFrameId(frameId?: string): string {
  return String(frameId ?? "")
    .trim()
    .toLowerCase()
    .replace(/^frame-/, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
