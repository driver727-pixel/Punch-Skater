import type { CraftlinguaDistrictLanguage, District } from "./types";
import craftlinguaDistrictsRaw from "./craftlinguaDistricts.json";

const CRAFTLINGUA_BASE_URL = "https://craftlingua.app";

export const CRAFTLINGUA_ATTRIBUTION = "Language system powered by CraftLingua.";

export const CRAFTLINGUA_DISTRICT_LANGUAGES =
  craftlinguaDistrictsRaw as CraftlinguaDistrictLanguage[];

export function buildCraftlinguaExploreUrl(shareCode: string): string {
  return `${CRAFTLINGUA_BASE_URL}/share/${encodeURIComponent(shareCode)}`;
}

export function getCraftlinguaDistrictLanguageByDistrict(
  district: District,
): CraftlinguaDistrictLanguage | null {
  return CRAFTLINGUA_DISTRICT_LANGUAGES.find((entry) => entry.district === district) ?? null;
}

export function getCraftlinguaDistrictLanguageByShareCode(
  shareCode: string,
): CraftlinguaDistrictLanguage | null {
  const normalized = shareCode.trim().toLowerCase();
  return (
    CRAFTLINGUA_DISTRICT_LANGUAGES.find(
      (entry) => entry.shareCode.trim().toLowerCase() === normalized,
    ) ?? null
  );
}

export const CODEX_CIPHER_CHALLENGE = {
  id: "grid-ghost-key",
  district: "The Grid" as District,
  prompt:
    "Decode the Grid stash label. The answer is a two-word courier object hidden in the district's language library.",
  englishAnswer: "thumb drive",
  translatedCipherText: "ghost key",
  shareCode: "CL-GRID-MESH",
  loreNote:
    "Static Pack runners mark physical data drops in Cipher Mesh so Cascade scanners see only another maintenance string.",
};
