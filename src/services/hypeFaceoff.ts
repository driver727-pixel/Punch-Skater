import { resolveApiUrl } from "../lib/apiUrls";
import type { CardPayload } from "../lib/types";

const API_BASE = resolveApiUrl(
  (import.meta.env.VITE_HYPE_API_URL as string | undefined)?.trim(),
  "/api/hype",
);
const CACHE_KEY = "skpd_hype_crew_faceoff";
const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
const PRELOAD_IMAGE_LIMIT = 32;
const preloadedImages: HTMLImageElement[] = [];

export interface CrewFaceoffPayload {
  generatedAt: string;
  cacheTtlMs?: number;
  source?: "live" | "cache";
  crews: {
    cassidy: {
      deckName: string;
      cards: CardPayload[];
    };
    garibaldi: {
      deckName: string;
      cards: CardPayload[];
    };
  };
}

interface CachedCrewFaceoff {
  fetchedAt: number;
  payload: CrewFaceoffPayload;
}

function isUsablePayload(payload: CrewFaceoffPayload | null): payload is CrewFaceoffPayload {
  return Boolean(
    payload?.crews?.cassidy?.cards?.length &&
    payload?.crews?.garibaldi?.cards?.length,
  );
}

function readCachedEntry(): CachedCrewFaceoff | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCrewFaceoff;
    if (!isUsablePayload(parsed.payload)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadCachedCrewFaceoff(): CrewFaceoffPayload | null {
  const cached = readCachedEntry();
  if (!cached) return null;

  const ttl = cached.payload.cacheTtlMs ?? CLIENT_CACHE_TTL_MS;
  if (Date.now() - cached.fetchedAt > ttl) return null;
  return cached.payload;
}

export async function fetchCrewFaceoff(): Promise<CrewFaceoffPayload | null> {
  const res = await fetch(`${API_BASE}/crew-faceoff`);
  if (!res.ok) return loadCachedCrewFaceoff();

  const payload = await res.json() as CrewFaceoffPayload;
  if (!isUsablePayload(payload)) return loadCachedCrewFaceoff();

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), payload }));
  } catch {
    // Ignore quota/private browsing failures; the in-memory caller state still updates.
  }
  return payload;
}

function preloadUrl(url: string | undefined): void {
  if (!url) return;
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  preloadedImages.push(image);
  if (preloadedImages.length > PRELOAD_IMAGE_LIMIT) {
    preloadedImages.splice(0, preloadedImages.length - PRELOAD_IMAGE_LIMIT);
  }
}

export function preloadCrewFaceoffImages(payload: CrewFaceoffPayload, cardLimit = 6): void {
  [
    ...payload.crews.cassidy.cards.slice(0, cardLimit),
    ...payload.crews.garibaldi.cards.slice(0, cardLimit),
  ].forEach((card) => {
    preloadUrl(card.backgroundImageUrl);
    preloadUrl(card.characterImageUrl);
    preloadUrl(card.frameImageUrl);
    preloadUrl(card.board?.imageUrl);
  });
}
