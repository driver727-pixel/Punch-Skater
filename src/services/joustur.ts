/**
 * joustur.ts — Client-side HTTP wrapper for the Joustur Skatur™ API.
 *
 * All requests are authenticated with the current Firebase user's ID token.
 */

import { getAuth } from "firebase/auth";
import { resolveApiUrl } from "../lib/apiUrls";
import type {
  JousturLineup,
  JousturChallenge,
  JousturMatch,
  JousturTurnLogEntry,
  JousturLegalMove,
  JousturMoveChoice,
  JousturClashChoice,
} from "../lib/jousturTypes";

const API_BASE = resolveApiUrl(
  (import.meta.env.VITE_JOUSTUR_API_URL as string | undefined)?.trim(),
  "/api/joustur",
);

async function getIdToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Not signed in.");
  return user.getIdToken();
}

async function apiFetch<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const token = await getIdToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Request failed (${res.status})`,
    );
  }
  return data as T;
}

// ── Lineup ────────────────────────────────────────────────────────────────────

export async function loadJousturLineup(): Promise<JousturLineup | null> {
  return apiFetch<JousturLineup | null>("/lineup");
}

export async function saveJousturLineup(
  riderCardIds: string[],
  supportCardId: string,
): Promise<JousturLineup> {
  return apiFetch<JousturLineup>("/lineup", {
    method: "POST",
    body: JSON.stringify({ riderCardIds, supportCardId }),
  });
}

// ── Challenges ────────────────────────────────────────────────────────────────

export async function listJousturChallenges(): Promise<{
  sent: JousturChallenge[];
  received: JousturChallenge[];
}> {
  return apiFetch<{ sent: JousturChallenge[]; received: JousturChallenge[] }>("/challenges");
}

export async function createJousturChallenge(
  defenderUid: string,
): Promise<JousturChallenge> {
  return apiFetch<JousturChallenge>("/challenge", {
    method: "POST",
    body: JSON.stringify({ defenderUid }),
  });
}

export async function acceptJousturChallenge(
  challengeId: string,
): Promise<JousturMatch> {
  return apiFetch<JousturMatch>(`/challenge/${challengeId}/accept`, {
    method: "POST",
  });
}

export async function declineJousturChallenge(
  challengeId: string,
): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/challenge/${challengeId}/decline`, {
    method: "POST",
  });
}

// ── Matchmaking queue ─────────────────────────────────────────────────────────

export async function enqueueJoustur(): Promise<
  { queued: true } | { queued: false; match: JousturMatch }
> {
  return apiFetch("/queue", { method: "POST" });
}

export async function dequeueJoustur(): Promise<{ dequeued: boolean }> {
  return apiFetch("/queue", { method: "DELETE" });
}

export async function startSoloJousturMatch(): Promise<JousturMatch> {
  return apiFetch<JousturMatch>("/solo", { method: "POST" });
}

export async function startFreeSoloJousturMatch(): Promise<JousturMatch> {
  return apiFetch<JousturMatch>("/free-solo", { method: "POST" });
}

// ── Matches ───────────────────────────────────────────────────────────────────

export async function listJousturMatches(): Promise<JousturMatch[]> {
  return apiFetch<JousturMatch[]>("/matches");
}

export async function getJousturMatch(matchId: string): Promise<JousturMatch> {
  return apiFetch<JousturMatch>(`/match/${matchId}`);
}

// ── Turn flow ─────────────────────────────────────────────────────────────────

export interface RollResult {
  roll: number;
  dice?: number[];
  legalMoves: JousturLegalMove[];
  canActivateSupport: { canActivate: boolean; reason: string | null };
}

export async function rollJousturShards(matchId: string): Promise<RollResult> {
  return apiFetch<RollResult>(`/match/${matchId}/roll`, { method: "POST" });
}

export interface MoveResult {
  match: JousturMatch;
  turnEntry: JousturTurnLogEntry;
  events: object[];
  extraTurn: boolean;
  winner: string | null;
}

export async function submitJousturMove(
  matchId: string,
  choice: JousturMoveChoice,
): Promise<MoveResult> {
  return apiFetch<MoveResult>(`/match/${matchId}/move`, {
    method: "POST",
    body: JSON.stringify(choice),
  });
}

export async function submitJousturClashChoice(
  matchId: string,
  choice: JousturClashChoice,
): Promise<MoveResult> {
  return apiFetch<MoveResult>(`/match/${matchId}/clash`, {
    method: "POST",
    body: JSON.stringify(choice),
  });
}
