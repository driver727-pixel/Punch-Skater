import { createRequire } from 'module';

const nodeRequire = createRequire(import.meta.url);
const districtLanguages = nodeRequire('../../src/lib/craftlinguaDistricts.json');
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const CRAFTLINGUA_BASE_URL = 'https://craftlingua.app';

function normalizeKey(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    : '';
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function buildCraftlinguaExploreUrl(shareCode) {
  return `${CRAFTLINGUA_BASE_URL}/share/${encodeURIComponent(String(shareCode ?? '').trim())}`;
}

export function getCraftlinguaDistrictLanguages() {
  return districtLanguages.map((entry) => ({
    ...cloneJson(entry),
    exploreUrl: buildCraftlinguaExploreUrl(entry.shareCode),
  }));
}

export function getCraftlinguaDistrictLanguage(districtOrSlug) {
  const normalized = normalizeKey(districtOrSlug);
  if (!normalized) return null;
  return getCraftlinguaDistrictLanguages().find((entry) => (
    normalizeKey(entry.district) === normalized || normalizeKey(entry.slug) === normalized
  )) ?? null;
}

export function getCraftlinguaDistrictLanguageByShareCode(shareCode) {
  const normalized = normalizeKey(shareCode);
  if (!normalized) return null;
  return getCraftlinguaDistrictLanguages().find((entry) => normalizeKey(entry.shareCode) === normalized) ?? null;
}

export function translateCraftlinguaText(text, entry) {
  const rawText = typeof text === 'string' ? text.trim() : '';
  if (!rawText || !entry) return rawText;

  const phrasebook = entry.phrasebook && typeof entry.phrasebook === 'object'
    ? Object.entries(entry.phrasebook)
    : [];
  const directMatch = phrasebook.find(([key]) => key.toLowerCase() === rawText.toLowerCase());
  if (directMatch) return String(directMatch[1]);

  const lookup = new Map();
  for (const word of entry.vocabulary ?? []) {
    const meaning = typeof word?.meaning === 'string' ? word.meaning.trim().toLowerCase() : '';
    const conlangWord = typeof word?.word === 'string' ? word.word.trim() : '';
    if (meaning && conlangWord) lookup.set(meaning, conlangWord);
  }

  return rawText.replace(/\b[A-Za-z]+\b/g, (match) => lookup.get(match.toLowerCase()) ?? match);
}

export function createCraftlinguaService({ cacheTtlMs = DEFAULT_CACHE_TTL_MS } = {}) {
  const cache = new Map();

  function getCached(key, builder) {
    const now = Date.now();
    const existing = cache.get(key);
    if (existing && now - existing.cachedAt < cacheTtlMs) {
      return cloneJson(existing.value);
    }
    const value = builder();
    cache.set(key, { cachedAt: now, value: cloneJson(value) });
    return cloneJson(value);
  }

  return {
    getDistricts() {
      return getCached('districts', () => getCraftlinguaDistrictLanguages().map(({ vocabulary, phrasebook, ...entry }) => entry));
    },
    getDistrict(districtOrSlug) {
      return getCached(`district:${normalizeKey(districtOrSlug)}`, () => getCraftlinguaDistrictLanguage(districtOrSlug));
    },
    resolveShareCode(shareCode) {
      return getCached(`share:${normalizeKey(shareCode)}`, () => getCraftlinguaDistrictLanguageByShareCode(shareCode));
    },
    translate({ district, shareCode, text }) {
      return getCached(`translate:${normalizeKey(district ?? shareCode)}:${String(text ?? '').trim().toLowerCase()}`, () => {
        const entry = shareCode
          ? getCraftlinguaDistrictLanguageByShareCode(shareCode)
          : getCraftlinguaDistrictLanguage(district);
        if (!entry) return null;
        return {
          shareCode: entry.shareCode,
          district: entry.district,
          language: entry.language,
          exploreUrl: entry.exploreUrl,
          translatedText: translateCraftlinguaText(text, entry),
        };
      });
    },
  };
}
