import type { User } from "firebase/auth";
import { resolveApiUrl } from "../lib/apiUrls";
import type {
  CardPayload,
  JoustCardSnapshot,
  JoustResolution,
  JoustTactic,
} from "../lib/types";

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
const FORGE_CLASH_START_API_URL = resolveApiUrl(
  import.meta.env.VITE_FORGE_CLASH_START_API_URL as string | undefined,
  "/api/forge/clash/start",
);
const FORGE_CLASH_PLAY_API_URL = resolveApiUrl(
  import.meta.env.VITE_FORGE_CLASH_PLAY_API_URL as string | undefined,
  "/api/forge/clash/play",
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

export interface ForgeLoanerCard extends CardPayload {
  ownerUid: string;
}

export interface ForgeClashRosterReference {
  cardId: string;
  ownerUid?: string;
}

export interface ForgeClashRosterSlot {
  slotId: string;
  cardId: string;
  ownerUid: string;
  loaner: boolean;
  name: string;
  snapshot: JoustCardSnapshot;
}

export interface ForgeClashTelegraph {
  intent: "rush" | "brace" | "trick";
  label: string;
  hint: string;
}

export interface ForgeClashRound {
  turn: number;
  slotId: string;
  cardId: string;
  cardName: string;
  loaner: boolean;
  telegraph: ForgeClashTelegraph;
  playerTactic: JoustTactic;
  rivalTactic: JoustTactic;
  baseStrike: number;
  finisher: boolean;
  finisherBonus: number;
  effectiveStrike: number;
  outcome: "win" | "loss" | "draw";
  correctRead: boolean;
  playerDamage: number;
  rivalDamage: number;
  playerHpBefore: number;
  playerHpAfter: number;
  rivalHpBefore: number;
  rivalHpAfter: number;
  comboBefore: number;
  comboAfter: number;
  heatBefore: number;
  heatAfter: number;
  narration: string;
  breakdown: JoustResolution["breakdown"];
  resolvedAt: string;
}

export interface ForgeClashRewards {
  xp: number;
  ozzies: number;
  cardXp: number;
  cardOzzies: number;
  districtReputation: number;
  firstClear: boolean;
  frameId: string | null;
  mvpCardId: string | null;
  mvpCardName: string | null;
  newCodexIds: string[];
  wallet: {
    currentBalance: number;
  };
}

export interface ForgeClashMatch {
  id: string;
  status: "playing" | "completed";
  turn: number;
  maxRounds: number;
  maxHp: number;
  maxHeat: number;
  playerHp: number;
  rivalHp: number;
  combo: number;
  heat: number;
  cooldowns: Record<string, number>;
  result: "win" | "loss" | "draw" | null;
  rival: JoustCardSnapshot & {
    tagline: string;
    signatureTrait: string;
    dialogue: {
      intro: string;
      win: string;
      loss: string;
      draw: string;
    };
  };
  roster: ForgeClashRosterSlot[];
  rounds: ForgeClashRound[];
  telegraph: ForgeClashTelegraph | null;
  latestRound: ForgeClashRound | null;
  rewards: ForgeClashRewards | null;
  createdAt: string;
  completedAt: string | null;
  rematchOf: string | null;
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

export async function fetchForgeComputerRivals(user: User, count = 6): Promise<ForgeLoanerCard[]> {
  const url = new URL(FORGE_COMPUTER_RIVALS_API_URL, window.location.origin);
  url.searchParams.set("count", String(count));
  const payload = await callForgeApi<{ cards?: ForgeLoanerCard[] }>(user, url.toString());
  return Array.isArray(payload.cards) ? payload.cards : [];
}

export async function startForgeClash(
  user: User,
  {
    roster,
    rematchOf,
  }: {
    roster: ForgeClashRosterReference[];
    rematchOf?: string | null;
  },
): Promise<ForgeClashMatch> {
  const payload = await callForgeApi<{ match: ForgeClashMatch }>(user, FORGE_CLASH_START_API_URL, {
    method: "POST",
    body: JSON.stringify({ roster, rematchOf: rematchOf ?? null }),
  });
  return payload.match;
}

export async function playForgeClashTurn(
  user: User,
  {
    matchId,
    slotId,
    tactic,
    turn,
    finisher,
  }: {
    matchId: string;
    slotId: string;
    tactic: JoustTactic;
    turn: number;
    finisher: boolean;
  },
): Promise<ForgeClashMatch> {
  const payload = await callForgeApi<{ match: ForgeClashMatch }>(user, FORGE_CLASH_PLAY_API_URL, {
    method: "POST",
    body: JSON.stringify({
      matchId,
      slotId,
      tactic,
      turn,
      finisher,
    }),
  });
  return payload.match;
}
