import { auth } from "../lib/firebase";
import { isEnabled } from "../lib/featureFlags";
import { resolveApiUrl } from "../lib/apiUrls";
import type { MissionBoardPayload, MissionRunResponse } from "../lib/sharedTypes";

const MISSION_BOARD_API_URL = resolveApiUrl(
  (import.meta.env.VITE_MISSIONS_API_URL as string | undefined)?.trim(),
  "/api/missions/board",
);
const MISSION_RUN_API_URL = resolveApiUrl(
  (import.meta.env.VITE_MISSIONS_RUN_API_URL as string | undefined)?.trim(),
  "/api/missions/run",
);

async function getIdToken(): Promise<string> {
  const idToken = await auth?.currentUser?.getIdToken();
  if (!idToken) {
    throw new Error("Sign in to access missions.");
  }
  return idToken;
}

async function parseResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const raw = await response.json().catch(() => null);
  const payload = raw !== null && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : fallbackMessage,
    );
  }
  return (raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as T;
}

async function fetchMissionJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Failed to reach the missions service.");
    }
    throw error;
  }
  return parseResponse<T>(response, fallbackMessage);
}

export async function getMissionBoard(uid: string, userEmail?: string | null): Promise<MissionBoardPayload> {
  if (!uid || !isEnabled("MISSIONS", userEmail)) {
    return { missions: [], progression: { missionXp: 0, missionOzzies: 0 } };
  }
  const idToken = await getIdToken();
  return fetchMissionJson<MissionBoardPayload>(MISSION_BOARD_API_URL, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  }, "Failed to load mission board.");
}

export async function runMission(
  uid: string,
  missionId: string,
  deckId: string,
  forkOptionId?: string | null,
  userEmail?: string | null,
): Promise<MissionRunResponse> {
  if (!uid || !isEnabled("MISSIONS", userEmail)) {
    throw new Error("Missions are not enabled.");
  }
  const idToken = await getIdToken();
  return fetchMissionJson<MissionRunResponse>(MISSION_RUN_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ missionId, deckId, forkOptionId }),
  }, "Failed to resolve mission.");
}

export async function trackMissionEvent(): Promise<void> {
  // Restored mission board runs are server-authoritative and no longer depend
  // on client-side event writes.
}
