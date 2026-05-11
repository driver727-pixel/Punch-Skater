/**
 * Converts a faction name into a safe Firestore document ID / Storage path
 * segment by lowercasing and replacing non-alphanumeric characters with
 * underscores, then collapsing repeated underscores.
 *
 * Examples:
 *   "D4rk $pider"                          → "d4rk_pider"  ($ stripped)
 *   "United Corporate Alliance (UCA)" → "uca"
 *   "Hermes' Squirmies"                    → "hermes_squirmies"
 */

const SLUG_OVERRIDES: Record<string, string> = {
  "United Corporate Alliance (UCA)": "uca",
};

export function factionSlug(name: string): string {
  if (Object.prototype.hasOwnProperty.call(SLUG_OVERRIDES, name)) {
    return SLUG_OVERRIDES[name];
  }
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
