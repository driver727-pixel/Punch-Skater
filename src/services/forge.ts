import type { User } from "firebase/auth";
import { resolveApiUrl } from "../lib/apiUrls";
import type { CardPayload } from "../lib/types";

const FREE_FORGE_STATUS_API_URL = resolveApiUrl(
  import.meta.env.VITE_FREE_FORGE_STATUS_API_URL as string | undefined,
  "/api/forge/free-status",
);
const FREE_FORGE_CLAIM_API_URL = resolveApiUrl(
  import.meta.env.VITE_FREE_FORGE_CLAIM_API_URL as string | undefined,
  "/api/forge/free-claim",
);
const FORGE_COMPUTER_RIVALS_API_URL = resolveApiUrl(
  import.meta.env.VITE_FORGE_COMPUTER_RIVALS_API_URL as string | undefined,
  "/api/forge/computer-rivals",
);

export interface FreeForgeState {
  used: boolean;
  lastForgeAt: number | null;
  nextReadyAt: number | null;
  canForge: boolean;
}

export class FreeForgeCooldownError extends Error {
  readonly nextReadyAt: number | null;
  constructor(message: string, nextReadyAt: number | null) {
    super(message);
    this.name = "FreeForgeCooldownError";
    this.nextReadyAt = nextReadyAt;
  }
}

async function callForgeApi<T>(user: User, url: string, init?: RequestInit): Promise<T> {
  const idToken = await user.getIdToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + idToken,
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429) {
      const nextReadyAt = typeof data?.nextReadyAt === "number" ? data.nextReadyAt : null;
      throw new FreeForgeCooldownError(
        typeof data?.error === "string" ? data.error : "Your free forge is still on cooldown.",
        nextReadyAt,
      );
    }
    throw new Error(typeof data?.error === "string" ? data.error : "Forge request failed.");
  }
  return data as T;
}

/** Reads the server-authoritative free forge availability for the user. */
export function fetchFreeForgeStatus(user: User): Promise<FreeForgeState> {
  return callForgeApi<FreeForgeState>(user, FREE_FORGE_STATUS_API_URL);
}

/**
 * Claims the free forge for the user, enforcing the cooldown server-side.
 * @throws {FreeForgeCooldownError} when the free forge is still on cooldown.
 */
export function claimFreeForge(user: User): Promise<FreeForgeState> {
  return callForgeApi<FreeForgeState>(user, FREE_FORGE_CLAIM_API_URL, { method: "POST" });
}

export async function fetchForgeComputerRivals(user: User, count = 6): Promise<CardPayload[]> {
  const url = new URL(FORGE_COMPUTER_RIVALS_API_URL, window.location.origin);
  url.searchParams.set("count", String(count));
  const payload = await callForgeApi<{ cards?: CardPayload[] }>(user, url.toString());
  return Array.isArray(payload.cards) ? payload.cards : [];
}
