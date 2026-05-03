import { resolveApiUrl } from "../lib/apiUrls";
import {
  CRAFTLINGUA_ATTRIBUTION,
  CRAFTLINGUA_DISTRICT_LANGUAGES,
  buildCraftlinguaExploreUrl,
  getCraftlinguaDistrictLanguageByDistrict,
  getCraftlinguaDistrictLanguageByShareCode,
} from "../lib/craftlingua";
import { HIGH_RARITY_TIERS } from "../lib/generator";
import { generateCatchphrase, parseCraftlinguaProfile, translateToConlang } from "../lib/languageIngestion";
import type {
  CardPayload,
  CraftlinguaDistrictLanguage,
  CraftlinguaEnvelope,
  CraftlinguaLink,
} from "../lib/types";

const CRAFTLINGUA_DISTRICTS_API_URL = resolveApiUrl(
  import.meta.env.VITE_CRAFTLINGUA_DISTRICTS_API_URL as string | undefined,
  "/api/craftlingua/districts",
);
const CRAFTLINGUA_TRANSLATE_API_URL = resolveApiUrl(
  import.meta.env.VITE_CRAFTLINGUA_TRANSLATE_API_URL as string | undefined,
  "/api/craftlingua/translate",
);
const CRAFTLINGUA_RESOLVE_SHARE_CODE_API_URL = resolveApiUrl(
  import.meta.env.VITE_CRAFTLINGUA_RESOLVE_API_URL as string | undefined,
  "/api/craftlingua/resolve-share-code",
);

interface DistrictsResponse {
  districts?: CraftlinguaDistrictLanguage[];
}

interface DistrictResponse {
  district?: CraftlinguaDistrictLanguage;
}

interface TranslationResponse {
  shareCode: string;
  district: CardPayload["prompts"]["district"];
  language: {
    name: string;
    code: string;
  };
  exploreUrl: string;
  translatedText: string;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    const detail = typeof data?.error === "string" ? data.error : `${response.status} ${response.statusText}`;
    throw new Error(detail);
  }
  return data;
}

export async function fetchCraftlinguaDistricts(): Promise<CraftlinguaDistrictLanguage[]> {
  try {
    const response = await fetch(CRAFTLINGUA_DISTRICTS_API_URL);
    const data = await readJson<DistrictsResponse>(response);
    return Array.isArray(data.districts) && data.districts.length > 0
      ? data.districts
      : CRAFTLINGUA_DISTRICT_LANGUAGES.map((entry) => ({
          ...entry,
          exploreUrl: entry.exploreUrl ?? buildCraftlinguaExploreUrl(entry.shareCode),
        }));
  } catch {
    return CRAFTLINGUA_DISTRICT_LANGUAGES.map((entry) => ({
      ...entry,
      exploreUrl: entry.exploreUrl ?? buildCraftlinguaExploreUrl(entry.shareCode),
    }));
  }
}

export async function resolveCraftlinguaShareCode(shareCode: string): Promise<CraftlinguaLink> {
  const trimmed = shareCode.trim();
  if (!trimmed) {
    throw new Error("Share code is required.");
  }

  try {
    const response = await fetch(CRAFTLINGUA_RESOLVE_SHARE_CODE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareCode: trimmed }),
    });
    const data = await readJson<DistrictResponse>(response);
    if (!data.district) throw new Error("CraftLingua share code not found.");
    return {
      shareCode: data.district.shareCode,
      district: data.district.district,
      languageName: data.district.language.name,
      languageCode: data.district.language.code,
      exploreUrl: data.district.exploreUrl ?? buildCraftlinguaExploreUrl(data.district.shareCode),
      linkedAt: new Date().toISOString(),
    };
  } catch (error) {
    const fallback = getCraftlinguaDistrictLanguageByShareCode(trimmed);
    if (!fallback) throw error;
    return {
      shareCode: fallback.shareCode,
      district: fallback.district,
      languageName: fallback.language.name,
      languageCode: fallback.language.code,
      exploreUrl: fallback.exploreUrl ?? buildCraftlinguaExploreUrl(fallback.shareCode),
      linkedAt: new Date().toISOString(),
    };
  }
}

export async function translateCraftlinguaText({
  district,
  shareCode,
  text,
}: {
  district?: CardPayload["prompts"]["district"];
  shareCode?: string;
  text: string;
}): Promise<TranslationResponse> {
  const response = await fetch(CRAFTLINGUA_TRANSLATE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ district, shareCode, text }),
  });
  return readJson<TranslationResponse>(response);
}

function removeCraftlinguaFlavorFields(front: CardPayload["front"]): CardPayload["front"] {
  const restFront = { ...front };
  delete restFront.flavorTextConlang;
  delete restFront.craftlingua;
  return restFront;
}

export async function buildCraftlinguaFlavorFields({
  card,
  linkedLanguage,
  profile,
  useCraftlingua,
}: {
  card: CardPayload;
  linkedLanguage?: CraftlinguaLink | null;
  profile?: CraftlinguaEnvelope | null;
  useCraftlingua?: boolean;
}): Promise<CardPayload["front"]> {
  const flavorTextEnglish = card.front.flavorTextEnglish ?? card.front.flavorText ?? "";
  if (!flavorTextEnglish || !HIGH_RARITY_TIERS.has(card.prompts.rarity)) {
    const restFront = removeCraftlinguaFlavorFields(card.front);
    return {
      ...restFront,
      flavorText: flavorTextEnglish,
      flavorTextEnglish,
    };
  }

  const parsedProfile = profile ? parseCraftlinguaProfile(profile) : null;
  if (useCraftlingua && parsedProfile?.vocabulary?.length) {
    const translatedText = translateToConlang(flavorTextEnglish, parsedProfile.vocabulary);
    const catchphrase = generateCatchphrase(parsedProfile.vocabulary, `${card.seed}|catchphrase`);
    return {
      ...card.front,
      flavorText: flavorTextEnglish,
      flavorTextEnglish,
      flavorTextConlang: translatedText === flavorTextEnglish && catchphrase ? catchphrase : translatedText,
      craftlingua: {
        languageName: parsedProfile.language.name,
        languageCode: parsedProfile.language.code,
        source: "local-profile",
      },
    };
  }

  const fallbackDistrict = linkedLanguage?.district
    ? getCraftlinguaDistrictLanguageByDistrict(linkedLanguage.district)
    : getCraftlinguaDistrictLanguageByDistrict(card.prompts.district);
  const shareCode = linkedLanguage?.shareCode ?? fallbackDistrict?.shareCode;
  if (!shareCode) {
    return {
      ...card.front,
      flavorText: flavorTextEnglish,
      flavorTextEnglish,
    };
  }

  try {
    const translation = await translateCraftlinguaText({
      district: linkedLanguage?.district ?? card.prompts.district,
      shareCode,
      text: flavorTextEnglish,
    });
    return {
      ...card.front,
      flavorText: flavorTextEnglish,
      flavorTextEnglish,
      flavorTextConlang: translation.translatedText,
      craftlingua: {
        shareCode: translation.shareCode,
        exploreUrl: translation.exploreUrl,
        languageName: translation.language.name,
        languageCode: translation.language.code,
        source: linkedLanguage ? "profile-link" : "district-default",
      },
    };
  } catch {
    const fallback = linkedLanguage
      ? getCraftlinguaDistrictLanguageByShareCode(linkedLanguage.shareCode)
      : fallbackDistrict;
    const restFront = removeCraftlinguaFlavorFields(card.front);
    return {
      ...restFront,
      flavorText: flavorTextEnglish,
      flavorTextEnglish,
      ...(fallback
        ? {
            flavorTextConlang: translateToConlang(flavorTextEnglish, fallback.vocabulary ?? []),
            craftlingua: {
              shareCode: fallback.shareCode,
              exploreUrl: fallback.exploreUrl ?? buildCraftlinguaExploreUrl(fallback.shareCode),
              languageName: fallback.language.name,
              languageCode: fallback.language.code,
              source: linkedLanguage ? "profile-link" : "district-default",
            },
          }
        : {}),
    };
  }
}

export { CRAFTLINGUA_ATTRIBUTION };
