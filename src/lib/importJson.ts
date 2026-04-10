/**
 * importJson.ts
 * ─────────────
 * Validates and normalises a JSON payload before it enters the collection.
 *
 * Accepted input formats
 * ──────────────────────
 * 1. CraftlinguaEnvelope  — { source: "craftlingua", language, vocabulary?, cards? }
 * 2. Collection export    — { version: "1.0.0", exportedAt, cards: CardPayload[] }
 * 3. Raw card array       — CardPayload[]
 *
 * Any card object that passes the required-field check is added to `accepted`.
 * Cards that fail carry field-level error messages in `rejected`.
 */

import type {
  CardPayload,
  CraftlinguaEnvelope,
  ImportResult,
  ImportCardError,
} from "./types";
import { normalizeCardPayload } from "./styles";

// ── Required top-level keys on a CardPayload ──────────────────────────────────

const REQUIRED_KEYS: (keyof CardPayload)[] = [
  "id",
  "version",
  "prompts",
  "seed",
  "identity",
  "stats",
  "traits",
  "flavorText",
  "visuals",
  "tags",
  "createdAt",
];

const REQUIRED_PROMPTS = ["archetype", "rarity", "style", "vibe", "district", "accentColor", "stamina"] as const;
const REQUIRED_IDENTITY = ["name", "crew", "manufacturer", "serialNumber"] as const;
const REQUIRED_STATS = ["speed", "stealth", "tech", "grit", "rep", "stamina"] as const;
const REQUIRED_VISUALS = ["helmetStyle", "boardStyle", "jacketStyle", "colorScheme", "accentColor", "storagePackStyle"] as const;

// ── Per-card validation ───────────────────────────────────────────────────────

function validateCard(raw: unknown, index: number): { card: CardPayload | null; error: ImportCardError | null } {
  const errors: string[] = [];

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      card: null,
      error: { index, errors: ["Card entry is not an object."] },
    };
  }

  const obj = raw as Record<string, unknown>;

  // Required top-level keys
  for (const key of REQUIRED_KEYS) {
    if (obj[key] === undefined || obj[key] === null) {
      errors.push(`Missing required field: "${key}"`);
    }
  }

  // Prompts sub-fields
  if (obj.prompts && typeof obj.prompts === "object" && !Array.isArray(obj.prompts)) {
    const p = obj.prompts as Record<string, unknown>;
    for (const key of REQUIRED_PROMPTS) {
      if (p[key] === undefined) errors.push(`Missing prompts.${key}`);
    }
    if (typeof p.stamina !== "number") errors.push("prompts.stamina must be a number");
  }

  // Identity sub-fields
  if (obj.identity && typeof obj.identity === "object" && !Array.isArray(obj.identity)) {
    const id = obj.identity as Record<string, unknown>;
    for (const key of REQUIRED_IDENTITY) {
      if (id[key] === undefined) errors.push(`Missing identity.${key}`);
    }
  }

  // Stats sub-fields
  if (obj.stats && typeof obj.stats === "object" && !Array.isArray(obj.stats)) {
    const s = obj.stats as Record<string, unknown>;
    for (const key of REQUIRED_STATS) {
      if (typeof s[key] !== "number") errors.push(`stats.${key} must be a number`);
    }
  }

  // Visuals sub-fields
  if (obj.visuals && typeof obj.visuals === "object" && !Array.isArray(obj.visuals)) {
    const v = obj.visuals as Record<string, unknown>;
    for (const key of REQUIRED_VISUALS) {
      if (v[key] === undefined) errors.push(`Missing visuals.${key}`);
    }
  }

  // tags must be an array
  if (obj.tags !== undefined && !Array.isArray(obj.tags)) {
    errors.push("tags must be an array");
  }

  if (errors.length > 0) {
    return {
      card: null,
      error: { index, id: typeof obj.id === "string" ? obj.id : undefined, errors },
    };
  }

  return { card: obj as unknown as CardPayload, error: null };
}

// ── Envelope detection ────────────────────────────────────────────────────────

function isCraftlinguaEnvelope(obj: Record<string, unknown>): obj is CraftlinguaEnvelope {
  return obj.source === "craftlingua";
}

function isCollectionExport(obj: Record<string, unknown>): obj is { version: string; exportedAt: string; cards: unknown[] } {
  return typeof obj.version === "string" && Array.isArray(obj.cards);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse `raw` (already-parsed JSON value or a JSON string) and return a
 * structured `ImportResult` that separates valid cards from invalid ones.
 *
 * Throws a plain `Error` only for unrecoverable parse failures (not validation
 * errors — those are returned in `ImportResult.rejected`).
 */
export function validateImport(raw: unknown): ImportResult {
  // Accept a JSON string
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Invalid JSON: unable to parse the provided text.");
    }
  }

  let cardEntries: unknown[] = [];
  let language: CraftlinguaEnvelope["language"] | undefined;
  let vocabulary: CraftlinguaEnvelope["vocabulary"] | undefined;

  if (Array.isArray(data)) {
    // Format 3: raw array
    cardEntries = data;
  } else if (data !== null && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    if (isCraftlinguaEnvelope(obj)) {
      // Format 1: Craftlingua envelope
      language = obj.language;
      vocabulary = Array.isArray(obj.vocabulary) ? obj.vocabulary : undefined;
      cardEntries = Array.isArray(obj.cards) ? obj.cards : [];
    } else if (isCollectionExport(obj)) {
      // Format 2: Collection export
      cardEntries = obj.cards;
    } else {
      throw new Error(
        'Unrecognised JSON format. Expected a CardPayload[] array, a collection export object ' +
        '{ version, cards }, or a Craftlingua envelope { source: "craftlingua", language, cards }.'
      );
    }
  } else {
    throw new Error("JSON root must be an array or an object.");
  }

  const accepted: CardPayload[] = [];
  const rejected: ImportCardError[] = [];

  for (let i = 0; i < cardEntries.length; i++) {
    const { card, error } = validateCard(cardEntries[i], i);
    if (card) {
      accepted.push(normalizeCardPayload(card));
    } else if (error) {
      rejected.push(error);
    }
  }

  return {
    accepted,
    rejected,
    total: cardEntries.length,
    language,
    vocabulary,
  };
}

/**
 * Read a `File` object and run `validateImport` on its contents.
 * Returns a promise that resolves to an `ImportResult`.
 */
export function validateImportFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        resolve(validateImport(text));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read the file."));
    reader.readAsText(file);
  });
}
