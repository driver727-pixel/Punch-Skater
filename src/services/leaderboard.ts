import { auth } from "../lib/firebase";
import { resolveApiUrl } from "../lib/apiUrls";
import type { LeaderboardEntry } from "../lib/types";

const LEADERBOARD_BASE = resolveApiUrl(
  (import.meta.env.VITE_LEADERBOARD_API_URL as string | undefined)?.trim(),
  "/api/leaderboard",
);

async function getIdToken(): Promise<string> {
  const idToken = await auth?.currentUser?.getIdToken();
  if (!idToken) throw new Error("Sign in to submit a leaderboard Crew.");
  return idToken;
}

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : fallback);
  }
  return payload as T;
}

export interface SubmitLeaderboardResult {
  lifetimeEntry: LeaderboardEntry;
  seasonalEntry: LeaderboardEntry;
}

export async function submitLeaderboardDeck(deckId: string): Promise<SubmitLeaderboardResult> {
  const idToken = await getIdToken();
  const res = await fetch(`${LEADERBOARD_BASE}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ deckId }),
  });
  return parseResponse<SubmitLeaderboardResult>(res, "Failed to submit leaderboard Crew.");
}
