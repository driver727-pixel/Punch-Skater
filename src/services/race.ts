/**
 * Race Arena client service — wraps the `/api/race/*` endpoints.
 */
import { auth } from "../lib/firebase";
import { resolveApiUrl } from "../lib/apiUrls";
import type { Race, RaceChallenge } from "../lib/types";

const RACE_BASE = resolveApiUrl(
  (import.meta.env.VITE_RACE_API_URL as string | undefined)?.trim(),
  "/api/race",
);

async function getIdToken(): Promise<string> {
  const idToken = await auth?.currentUser?.getIdToken();
  if (!idToken) throw new Error("Sign in to use the Race Arena.");
  return idToken;
}

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : fallback);
  }
  return payload as T;
}

export interface IssueChallengeInput {
  challengerCardId: string;
  defenderUid: string;
  defenderCardId: string;
  ozzyWager?: number;
  message?: string;
}

export async function issueRaceChallenge(input: IssueChallengeInput): Promise<RaceChallenge> {
  const idToken = await getIdToken();
  const res = await fetch(`${RACE_BASE}/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(input),
  });
  return parseResponse<RaceChallenge>(res, "Failed to issue race challenge.");
}

export async function cancelRaceChallenge(challengeId: string): Promise<RaceChallenge> {
  const idToken = await getIdToken();
  const res = await fetch(`${RACE_BASE}/${encodeURIComponent(challengeId)}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return parseResponse<RaceChallenge>(res, "Failed to cancel challenge.");
}

export interface RespondResult {
  challenge: RaceChallenge;
  race?: Race;
}

export async function respondToRaceChallenge(challengeId: string, accept: boolean): Promise<RespondResult> {
  const idToken = await getIdToken();
  const res = await fetch(`${RACE_BASE}/${encodeURIComponent(challengeId)}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ accept }),
  });
  return parseResponse<RespondResult>(res, "Failed to respond to challenge.");
}

export async function fetchRace(raceId: string): Promise<Race> {
  const idToken = await getIdToken();
  const res = await fetch(`${RACE_BASE}/${encodeURIComponent(raceId)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return parseResponse<Race>(res, "Failed to load race.");
}

export interface ArenaListEntry {
  uid: string;
  displayName: string;
  deckId: string;
  deckName: string;
  challengerCardId: string | null;
  cards: import("../lib/types").RaceCardSnapshot[];
}

export async function fetchRaceArena(limit = 24): Promise<ArenaListEntry[]> {
  const idToken = await getIdToken();
  const res = await fetch(`${RACE_BASE}/arena?limit=${limit}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const payload = await parseResponse<{ entries: ArenaListEntry[] }>(res, "Failed to load arena.");
  return payload.entries ?? [];
}
