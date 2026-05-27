/**
 * forgeSessionCache.ts
 *
 * Persists the last forged card (payload + layer image URLs + character-blend
 * slider position) in sessionStorage so a user can navigate away and return to
 * the Card Forge page without losing their result. Entries are scoped per auth
 * identity so signing out and back in does not expose another user's preview.
 * The entry is automatically removed when the browser tab/session ends, or
 * overwritten when a new card is forged.
 */
import type { CardPayload } from "../lib/types";

const SESSION_KEY_PREFIX = "forge_session_v1";

export interface ForgeSessionData {
  card: CardPayload;
  backgroundUrl?: string;
  characterUrl?: string;
  frameUrl?: string;
  characterBlend: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object";
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRenderableForgeCard(value: unknown): value is CardPayload {
  if (!isRecord(value)) return false;

  return (
    isString(value.id) &&
    isString(value.seed) &&
    isString(value.frameSeed) &&
    isString(value.backgroundSeed) &&
    isString(value.characterSeed) &&
    isRecord(value.prompts) &&
    isString(value.prompts.rarity) &&
    isRecord(value.class) &&
    isString(value.class.rarity) &&
    isString(value.class.badgeLabel) &&
    isRecord(value.identity) &&
    isString(value.identity.name) &&
    isString(value.identity.serialNumber) &&
    isRecord(value.role) &&
    isString(value.role.label) &&
    isString(value.role.passiveName) &&
    isString(value.role.passiveDescription) &&
    isRecord(value.stats) &&
    isNumber(value.stats.speed) &&
    isNumber(value.stats.range) &&
    isNumber(value.stats.rangeNm) &&
    isNumber(value.stats.stealth) &&
    isNumber(value.stats.grit) &&
    isRecord(value.board) &&
    isRecord(value.board.config) &&
    isRecord(value.board.components) &&
    isRecord(value.maintenance) &&
    isString(value.maintenance.state) &&
    isNumber(value.maintenance.chargePct) &&
    isRecord(value.visuals) &&
    isString(value.visuals.accentColor) &&
    isRecord(value.front) &&
    isRecord(value.back)
  );
}

function isForgeSessionData(value: unknown): value is ForgeSessionData {
  return (
    isRecord(value) &&
    isRenderableForgeCard(value.card) &&
    isNumber(value.characterBlend) &&
    (value.backgroundUrl == null || isString(value.backgroundUrl)) &&
    (value.characterUrl == null || isString(value.characterUrl)) &&
    (value.frameUrl == null || isString(value.frameUrl))
  );
}

function buildSessionKey(ownerKey = "guest"): string {
  return `${SESSION_KEY_PREFIX}:${ownerKey}`;
}

/**
 * Load the last forge session from sessionStorage.
 * Returns null if nothing is stored or if the stored value cannot be parsed.
 */
export function loadForgeSession(ownerKey?: string): ForgeSessionData | null {
  try {
    const sessionKey = buildSessionKey(ownerKey);
    const raw = sessionStorage.getItem(sessionKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isForgeSessionData(parsed)) {
      sessionStorage.removeItem(sessionKey);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Persist the current forge state to sessionStorage.
 * Silently no-ops if sessionStorage is unavailable.
 */
export function saveForgeSession(data: ForgeSessionData, ownerKey?: string): void {
  try {
    sessionStorage.setItem(buildSessionKey(ownerKey), JSON.stringify(data));
  } catch {
    // sessionStorage may be unavailable in private-browsing or restricted contexts.
  }
}

/**
 * Remove the forge session entry from sessionStorage.
 * Silently no-ops if sessionStorage is unavailable.
 */
export function clearForgeSession(ownerKey?: string): void {
  try {
    sessionStorage.removeItem(buildSessionKey(ownerKey));
  } catch {
    // Ignore
  }
}
