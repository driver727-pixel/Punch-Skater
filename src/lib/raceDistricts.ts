import { CRAFTLINGUA_DISTRICT_LANGUAGES } from "./craftlingua";

export const RACE_DISTRICT_ORDER = [
  "airaway",
  "batteryville",
  "the-grid",
  "nightshade",
  "the-forest",
  "glass-city",
] as const;

export const DEFAULT_RACE_DISTRICT = RACE_DISTRICT_ORDER[0];

export type RaceDistrictSlug = (typeof RACE_DISTRICT_ORDER)[number];

const DISTRICT_EMOJIS: Record<RaceDistrictSlug, string> = {
  airaway: "🌬️",
  batteryville: "⚡",
  "the-grid": "🔲",
  nightshade: "🌑",
  "the-forest": "🌲",
  "glass-city": "🏙️",
};

const DISTRICT_NAME_BY_SLUG = new Map(
  CRAFTLINGUA_DISTRICT_LANGUAGES.map((entry) => [entry.slug, entry.district] as const),
);

export const RACE_DISTRICT_OPTIONS = RACE_DISTRICT_ORDER.map((slug) => ({
  slug,
  emoji: DISTRICT_EMOJIS[slug],
  displayName: DISTRICT_NAME_BY_SLUG.get(slug) ?? slug,
}));

export function getRaceDistrictDisplayName(district?: string | null): string | null {
  if (!district) return null;
  return DISTRICT_NAME_BY_SLUG.get(district) ?? null;
}
