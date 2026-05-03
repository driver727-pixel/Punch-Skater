/**
 * languageIngestion.ts
 * ─────────────────────
 * Utilities for consuming a Craftlingua language_profile.json export.
 *
 * Provides helpers for:
 *  - Parsing and validating a raw JSON value as a CraftlinguaEnvelope
 *  - Generating phonetically consistent character names from vocabulary
 *  - Generating a "Signature Catchphrase" for a card
 *  - Translating English text to the constructed language (word substitution)
 *  - Picking short display words from vocabulary
 */

import type { CraftlinguaEnvelope, CraftlinguaWord } from "./types";
import { createSeededRandom } from "./prng";

// ── Profile parsing ────────────────────────────────────────────────────────────

/**
 * Validate and parse an unknown value as a CraftlinguaEnvelope.
 * Returns `null` if the value does not satisfy the required shape.
 */
export function parseCraftlinguaProfile(raw: unknown): CraftlinguaEnvelope | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.source !== "craftlingua") return null;
  if (typeof obj.version !== "string") return null;
  if (typeof obj.exportedAt !== "string") return null;
  if (!obj.language || typeof obj.language !== "object") return null;
  const lang = obj.language as Record<string, unknown>;
  if (typeof lang.name !== "string" || typeof lang.code !== "string") return null;
  return obj as unknown as CraftlinguaEnvelope;
}

// ── Name generation ────────────────────────────────────────────────────────────

/**
 * Generate a phonetically consistent character name from a vocabulary list.
 *
 * Strategy:
 *  1. Prefer words with `cardField === "name"` as name components.
 *  2. Fall back to any vocabulary word when no name-specific entries exist.
 *  3. Uses the phonetic transcription (or raw word) as the syllable source.
 */
export function generateConlangName(vocabulary: CraftlinguaWord[], seed: string): string {
  if (vocabulary.length === 0) return "";

  const rng = createSeededRandom(seed + "|name");
  const nameWords = vocabulary.filter((w) => w.cardField === "name");
  const pool = nameWords.length >= 2 ? nameWords : vocabulary;

  const toNamePart = (w: CraftlinguaWord): string => {
    const raw = (w.phonetic ?? w.word).split(/[\s\-_]+/)[0];
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  };

  const first = rng.pick(pool);
  const remainder = pool.filter((w) => w !== first);
  const last = remainder.length > 0 ? rng.pick(remainder) : undefined;

  return last ? `${toNamePart(first)} ${toNamePart(last)}` : toNamePart(first);
}

// ── Catchphrase generation ─────────────────────────────────────────────────────

/**
 * Generate a short "Signature Catchphrase" by picking 3–5 vocabulary words
 * and joining them.  Words with shorter forms are preferred so the phrase
 * stays readable on a card.
 */
export function generateCatchphrase(vocabulary: CraftlinguaWord[], seed: string): string {
  if (vocabulary.length === 0) return "";

  const rng = createSeededRandom(seed + "|catchphrase");
  const count = rng.range(3, Math.min(5, vocabulary.length));
  const picked = rng.pickN(vocabulary, count);
  return picked.map((w) => w.word).join(" ");
}

// ── Translation ────────────────────────────────────────────────────────────────

/**
 * Translate a plain English string into the constructed language.
 *
 * Each English word that matches a vocabulary entry's `meaning` (case-insensitive)
 * is replaced by its conlang `word`.  Unrecognised words are left unchanged.
 * The result retains the original sentence structure so it is still readable
 * even if only a handful of words are substituted.
 */
export function translateToConlang(text: string, vocabulary: CraftlinguaWord[]): string {
  if (vocabulary.length === 0) return text;

  // Build a lowercase meaning → conlang word map (last definition wins).
  const lookup = new Map<string, string>();
  for (const entry of vocabulary) {
    const key = entry.meaning.toLowerCase().trim();
    if (key) lookup.set(key, entry.word);
  }

  return text.replace(/\b[A-Za-z]+\b/g, (match) => lookup.get(match.toLowerCase()) ?? match);
}

// ── Display word picker ───────────────────────────────────────────────────────

/**
 * Pick 1–2 short vocabulary words suitable for compact card display text.
 *
 * Short single-token words are preferred for legibility.
 */
export function getDisplayWords(vocabulary: CraftlinguaWord[], seed: string): string[] {
  if (vocabulary.length === 0) return [];

  const rng = createSeededRandom(seed + "|display-words");
  // Favour short, single-token words for legibility in generated images.
  const singleToken = vocabulary.filter((w) => !/[\s]/.test(w.word));
  const pool = singleToken.length >= 2 ? singleToken : vocabulary;
  const sorted = [...pool].sort((a, b) => a.word.length - b.word.length);
  const shortPool = sorted.slice(0, Math.max(2, Math.ceil(sorted.length * 0.5)));
  const count = Math.min(2, shortPool.length);
  return rng.pickN(shortPool, count).map((w) => w.word);
}
