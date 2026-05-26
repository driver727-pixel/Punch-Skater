import { auth } from "../lib/firebase";
import { isEnabled } from "../lib/featureFlags";
import { resolveApiUrl } from "../lib/apiUrls";
import type {
  ActiveDistrictRun,
  DistrictWorldPayload,
  DistrictWorldVisuals,
  MissionBoardPayload,
  MissionRunResponse,
} from "../lib/sharedTypes";

const MISSION_BOARD_API_URL = resolveApiUrl(
  (import.meta.env.VITE_MISSIONS_API_URL as string | undefined)?.trim(),
  "/api/missions/board",
);
const MISSION_RUN_API_URL = resolveApiUrl(
  (import.meta.env.VITE_MISSIONS_RUN_API_URL as string | undefined)?.trim(),
  "/api/missions/run",
);
const MISSION_MAP_API_URL = resolveApiUrl(
  (import.meta.env.VITE_MISSIONS_MAP_API_URL as string | undefined)?.trim(),
  "/api/missions/map",
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
  counterOptionId?: string | null,
  joustTactic?: string | null,
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
    body: JSON.stringify({ missionId, deckId, counterOptionId, joustTactic }),
  }, "Failed to resolve mission.");
}

function extractMissionMapUrl(payload: Record<string, unknown>): string | null {
  const image = payload.image;
  if (image && typeof image === "object" && typeof (image as { url?: unknown }).url === "string") {
    return (image as { url: string }).url;
  }
  if (typeof payload.image_url === "string") {
    return payload.image_url;
  }
  const images = payload.images;
  if (Array.isArray(images) && images[0] && typeof images[0] === "object" && typeof (images[0] as { url?: unknown }).url === "string") {
    return (images[0] as { url: string }).url;
  }
  return null;
}

export async function generateMissionMapImage(prompt: string, seed: number): Promise<string> {
  const idToken = await getIdToken();
  const payload = await fetchMissionJson<Record<string, unknown>>(MISSION_MAP_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      prompt,
      seed,
      image_size: { width: 1024, height: 1024 },
      num_inference_steps: 28,
      guidance_scale: 4,
    }),
  }, "Failed to generate mission map.");

  const imageUrl = extractMissionMapUrl(payload);
  if (!imageUrl) {
    throw new Error("Mission map generation succeeded but no image URL was returned.");
  }
  return imageUrl;
}

export async function trackMissionEvent(): Promise<void> {
  // Restored mission board runs are server-authoritative and no longer depend
  // on client-side event writes.
}

const MISSION_WORLD_API_URL = resolveApiUrl(
  (import.meta.env.VITE_MISSIONS_WORLD_API_URL as string | undefined)?.trim(),
  "/api/missions/world",
);
const MISSION_WORLD_RUN_API_URL = resolveApiUrl(
  (import.meta.env.VITE_MISSIONS_WORLD_RUN_API_URL as string | undefined)?.trim(),
  "/api/missions/world/run",
);
const MISSION_WORLD_VISUALS_API_URL = resolveApiUrl(
  (import.meta.env.VITE_MISSIONS_WORLD_VISUALS_API_URL as string | undefined)?.trim(),
  "/api/missions/world/visuals",
);
const MISSION_WORLD_CHECKPOINT_API_URL = resolveApiUrl(
  (import.meta.env.VITE_MISSIONS_WORLD_CHECKPOINT_API_URL as string | undefined)?.trim(),
  "/api/missions/world/checkpoint",
);
const MISSION_WORLD_POI_RESOLVE_API_URL = resolveApiUrl(
  (import.meta.env.VITE_MISSIONS_WORLD_POI_RESOLVE_API_URL as string | undefined)?.trim(),
  "/api/missions/world/poi/resolve",
);
const MISSION_WORLD_INBOUND_API_URL = resolveApiUrl(
  (import.meta.env.VITE_MISSIONS_WORLD_INBOUND_API_URL as string | undefined)?.trim(),
  "/api/missions/world/inbound/start",
);
const MISSION_WORLD_ENCOUNTER_RESOLVE_API_URL = resolveApiUrl(
  (import.meta.env.VITE_MISSIONS_WORLD_ENCOUNTER_RESOLVE_API_URL as string | undefined)?.trim(),
  "/api/missions/world/encounter/resolve",
);

export async function getDistrictWorld(uid: string, userEmail?: string | null): Promise<DistrictWorldPayload> {
  if (!uid || !isEnabled("MISSIONS", userEmail)) {
    return {
      world: {
        worldId: "",
        boardDateKey: "",
        dailyResetAt: "",
        nodes: [],
        edges: [],
        contracts: [],
      },
      activeRun: null,
    };
  }
  const idToken = await getIdToken();
  return fetchMissionJson<DistrictWorldPayload>(MISSION_WORLD_API_URL, {
    headers: { Authorization: ["Bearer", idToken].join(" ") },
  }, "Failed to load district world.");
}

export async function startDistrictRun(
  uid: string,
  contractId: string,
  deckId: string,
  deckName: string,
  userEmail?: string | null,
): Promise<ActiveDistrictRun> {
  if (!uid || !isEnabled("MISSIONS", userEmail)) {
    throw new Error("Missions are not enabled.");
  }
  const idToken = await getIdToken();
  const payload = await fetchMissionJson<{ activeRun: ActiveDistrictRun }>(
    MISSION_WORLD_RUN_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ["Bearer", idToken].join(" "),
      },
      body: JSON.stringify({ contractId, deckId, deckName }),
    },
    "Failed to start district run.",
  );
  return payload.activeRun;
}

export async function getDistrictWorldVisuals(
  uid: string,
  boardDateKey: string,
  userEmail?: string | null,
): Promise<DistrictWorldVisuals> {
  if (!uid || !isEnabled("MISSIONS", userEmail)) {
    throw new Error("Missions are not enabled.");
  }
  const idToken = await getIdToken();
  const payload = await fetchMissionJson<{ visuals: DistrictWorldVisuals }>(
    MISSION_WORLD_VISUALS_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ["Bearer", idToken].join(" "),
      },
      body: JSON.stringify({ boardDateKey }),
    },
    "Failed to load mission visuals.",
  );
  return payload.visuals;
}

export async function persistDistrictCheckpoint(
  uid: string,
  runId: string,
  nodeId: string,
  checkpointNodeIndex: number,
  userEmail?: string | null,
): Promise<ActiveDistrictRun> {
  if (!uid || !isEnabled("MISSIONS", userEmail)) {
    throw new Error("Missions are not enabled.");
  }
  const idToken = await getIdToken();
  const payload = await fetchMissionJson<{ activeRun: ActiveDistrictRun }>(
    MISSION_WORLD_CHECKPOINT_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ["Bearer", idToken].join(" "),
      },
      body: JSON.stringify({ runId, nodeId, checkpointNodeIndex }),
    },
    "Failed to persist checkpoint.",
  );
  return payload.activeRun;
}

export async function resolveDistrictPoiFork(
  uid: string,
  runId: string,
  optionId: string,
  userEmail?: string | null,
): Promise<ActiveDistrictRun> {
  if (!uid || !isEnabled("MISSIONS", userEmail)) {
    throw new Error("Missions are not enabled.");
  }
  const idToken = await getIdToken();
  const payload = await fetchMissionJson<{ activeRun: ActiveDistrictRun }>(
    MISSION_WORLD_POI_RESOLVE_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ["Bearer", idToken].join(" "),
      },
      body: JSON.stringify({ runId, optionId }),
    },
    "Failed to resolve POI fork.",
  );
  return payload.activeRun;
}

export async function startDistrictInboundTravel(
  uid: string,
  runId: string,
  userEmail?: string | null,
): Promise<ActiveDistrictRun> {
  if (!uid || !isEnabled("MISSIONS", userEmail)) {
    throw new Error("Missions are not enabled.");
  }
  const idToken = await getIdToken();
  const payload = await fetchMissionJson<{ activeRun: ActiveDistrictRun }>(
    MISSION_WORLD_INBOUND_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ["Bearer", idToken].join(" "),
      },
      body: JSON.stringify({ runId }),
    },
    "Failed to begin inbound travel.",
  );
  return payload.activeRun;
}

export async function resolveDistrictEncounter(
  uid: string,
  runId: string,
  optionId: string,
  userEmail?: string | null,
): Promise<ActiveDistrictRun> {
  if (!uid || !isEnabled("MISSIONS", userEmail)) {
    throw new Error("Missions are not enabled.");
  }
  const idToken = await getIdToken();
  const payload = await fetchMissionJson<{ activeRun: ActiveDistrictRun }>(
    MISSION_WORLD_ENCOUNTER_RESOLVE_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ["Bearer", idToken].join(" "),
      },
      body: JSON.stringify({ runId, optionId }),
    },
    "Failed to resolve encounter.",
  );
  return payload.activeRun;
}
