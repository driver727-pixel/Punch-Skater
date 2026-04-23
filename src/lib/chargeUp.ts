/**
 * chargeUp.ts — "Charge Up" free forge timer.
 *
 * Every 8 hours a player earns one free forge attempt with a capped rarity
 * ceiling (Punch Skater / Apprentice only — no Rare/Legendary).
 * The charge persists in localStorage and resets on use.
 */

import type { Rarity } from "./types";

export const CHARGE_INTERVAL_MS = 8 * 60 * 60 * 1000;
export const CHARGE_MAX_RARITY: Rarity = "Apprentice";
export const CHARGE_ALLOWED_RARITIES: readonly Rarity[] = ["Punch Skater", "Apprentice"];

const CHARGE_STORAGE_KEY = "skpd_charge_up";

interface ChargeState {
  lastUsedAt: number;
}

function loadChargeState(): ChargeState {
  try {
    const raw = localStorage.getItem(CHARGE_STORAGE_KEY);
    if (!raw) return { lastUsedAt: 0 };
    const parsed = JSON.parse(raw) as Partial<ChargeState>;
    return { lastUsedAt: typeof parsed.lastUsedAt === "number" ? parsed.lastUsedAt : 0 };
  } catch {
    return { lastUsedAt: 0 };
  }
}

function saveChargeState(state: ChargeState): void {
  localStorage.setItem(CHARGE_STORAGE_KEY, JSON.stringify(state));
}

export function getChargeStatus(now: number = Date.now()): {
  available: boolean;
  msUntilReady: number;
  lastUsedAt: number;
} {
  const state = loadChargeState();
  const elapsed = now - state.lastUsedAt;
  const available = elapsed >= CHARGE_INTERVAL_MS;
  const msUntilReady = available ? 0 : CHARGE_INTERVAL_MS - elapsed;
  return { available, msUntilReady, lastUsedAt: state.lastUsedAt };
}

export function consumeCharge(): void {
  saveChargeState({ lastUsedAt: Date.now() });
}

export function isChargeAllowedRarity(rarity: Rarity): boolean {
  return (CHARGE_ALLOWED_RARITIES as readonly string[]).includes(rarity);
}

export function clampToChargeRarity(rarity: Rarity): Rarity {
  return isChargeAllowedRarity(rarity) ? rarity : CHARGE_MAX_RARITY;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ready!";
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
