import { CRAFTLINGUA_DISTRICT_LANGUAGES } from "./craftlingua";
import { DISTRICT_LORE } from "./lore";
import { DEFAULT_RACE_DISTRICT, RACE_DISTRICT_OPTIONS, type RaceDistrictSlug } from "./raceDistricts";

export const DISTRICT_THEME_EVENT = "punch-skater:district-change";
const STORAGE_KEY = "punch-skater-active-district";

export interface DistrictTheme {
  slug: RaceDistrictSlug;
  name: string;
  bg: string;
  bg2: string;
  bg3: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
  accent2: string;
  purple: string;
  danger: string;
  neonAccent: string;
  scanline: string;
  overlay: string;
}

const DISTRICT_THEMES: Record<RaceDistrictSlug, DistrictTheme> = {
  airaway: {
    slug: "airaway",
    name: "Airaway",
    bg: "#04101d",
    bg2: "#071a2d",
    bg3: "#0b2740",
    border: "#4bbcff",
    text: "#eef8ff",
    textDim: "#8bb6d6",
    accent: "#d9f5ff",
    accent2: "#56c8ff",
    purple: "#90a8ff",
    danger: "#ff6b82",
    neonAccent: "#d9f5ff",
    scanline: "rgba(86, 200, 255, 0.045)",
    overlay: "linear-gradient(135deg, rgba(4,16,29,0.96), rgba(86,200,255,0.24))",
  },
  batteryville: {
    slug: "batteryville",
    name: "Batteryville",
    bg: "#120a02",
    bg2: "#241305",
    bg3: "#351d07",
    border: "#ff9d1f",
    text: "#fff1d4",
    textDim: "#b98752",
    accent: "#ffcf33",
    accent2: "#ff6b1a",
    purple: "#ff3af2",
    danger: "#ff3838",
    neonAccent: "#ffcf33",
    scanline: "rgba(255, 157, 31, 0.05)",
    overlay: "linear-gradient(135deg, rgba(18,10,2,0.96), rgba(255,107,26,0.26))",
  },
  "the-grid": {
    slug: "the-grid",
    name: "The Grid",
    bg: "#020816",
    bg2: "#041127",
    bg3: "#071b36",
    border: "#2d7dff",
    text: "#e7f0ff",
    textDim: "#6987c3",
    accent: "#28f7ff",
    accent2: "#2d7dff",
    purple: "#7b61ff",
    danger: "#ff4d8d",
    neonAccent: "#28f7ff",
    scanline: "rgba(40, 247, 255, 0.045)",
    overlay: "linear-gradient(135deg, rgba(2,8,22,0.96), rgba(45,125,255,0.25))",
  },
  nightshade: {
    slug: "nightshade",
    name: "Nightshade",
    bg: "#08020f",
    bg2: "#12051d",
    bg3: "#1c0730",
    border: "#7d3cff",
    text: "#f8eaff",
    textDim: "#a273c7",
    accent: "#ff3af2",
    accent2: "#7dffea",
    purple: "#b14dff",
    danger: "#ff4d5f",
    neonAccent: "#ff3af2",
    scanline: "rgba(255, 58, 242, 0.045)",
    overlay: "linear-gradient(135deg, rgba(8,2,15,0.96), rgba(255,58,242,0.2))",
  },
  "the-forest": {
    slug: "the-forest",
    name: "The Forest",
    bg: "#031007",
    bg2: "#081b0d",
    bg3: "#102914",
    border: "#4b9b50",
    text: "#edffe8",
    textDim: "#7fa879",
    accent: "#8cff5f",
    accent2: "#d1a85a",
    purple: "#68d68a",
    danger: "#ff7048",
    neonAccent: "#8cff5f",
    scanline: "rgba(140, 255, 95, 0.035)",
    overlay: "linear-gradient(135deg, rgba(3,16,7,0.96), rgba(140,255,95,0.18))",
  },
  "glass-city": {
    slug: "glass-city",
    name: "Glass City",
    bg: "#020912",
    bg2: "#061824",
    bg3: "#0a2534",
    border: "#74f4ff",
    text: "#ecfeff",
    textDim: "#86b8c4",
    accent: "#74f4ff",
    accent2: "#ff5de8",
    purple: "#b8f7ff",
    danger: "#ff4f93",
    neonAccent: "#74f4ff",
    scanline: "rgba(116, 244, 255, 0.045)",
    overlay: "linear-gradient(135deg, rgba(2,9,18,0.94), rgba(116,244,255,0.2), rgba(255,93,232,0.16))",
  },
};

const SLUG_BY_NAME = new Map<string, RaceDistrictSlug>(
  RACE_DISTRICT_OPTIONS.flatMap((option) => [
    [option.slug, option.slug],
    [option.displayName.toLowerCase(), option.slug],
    [option.displayName.toLowerCase().replace(/\s+/g, "-"), option.slug],
  ]),
);
const DISTRICT_LORE_BY_NAME = new Map<string, (typeof DISTRICT_LORE)[number]>(
  DISTRICT_LORE.map((entry) => [entry.name, entry] as const),
);
const DISTRICT_LANGUAGE_BY_SLUG = new Map(CRAFTLINGUA_DISTRICT_LANGUAGES.map((entry) => [entry.slug, entry] as const));

export function normalizeDistrictSlug(district?: string | null): RaceDistrictSlug {
  if (!district) return DEFAULT_RACE_DISTRICT;
  const normalized = district.trim().toLowerCase();
  return SLUG_BY_NAME.get(normalized) ?? DEFAULT_RACE_DISTRICT;
}

export function getDistrictTheme(district?: string | null): DistrictTheme {
  return DISTRICT_THEMES[normalizeDistrictSlug(district)];
}

export function applyDistrictTheme(district?: string | null) {
  if (typeof document === "undefined") return;
  const theme = getDistrictTheme(district);
  const root = document.documentElement;
  root.dataset.district = theme.slug;
  root.style.setProperty("--theme-bg", theme.bg);
  root.style.setProperty("--theme-bg2", theme.bg2);
  root.style.setProperty("--theme-bg3", theme.bg3);
  root.style.setProperty("--theme-border", theme.border);
  root.style.setProperty("--theme-text", theme.text);
  root.style.setProperty("--theme-text-dim", theme.textDim);
  root.style.setProperty("--theme-accent", theme.accent);
  root.style.setProperty("--theme-accent2", theme.accent2);
  root.style.setProperty("--theme-purple", theme.purple);
  root.style.setProperty("--theme-danger", theme.danger);
  root.style.setProperty("--theme-neon-accent", theme.neonAccent);
  root.style.setProperty("--theme-scanline", theme.scanline);
  root.style.setProperty("--theme-overlay", theme.overlay);
}

export function getStoredActiveDistrict(): RaceDistrictSlug {
  if (typeof window === "undefined") return DEFAULT_RACE_DISTRICT;
  return normalizeDistrictSlug(window.localStorage.getItem(STORAGE_KEY));
}

export function announceActiveDistrict(district?: string | null) {
  if (typeof window === "undefined") return;
  const slug = normalizeDistrictSlug(district);
  window.localStorage.setItem(STORAGE_KEY, slug);
  window.dispatchEvent(new CustomEvent(DISTRICT_THEME_EVENT, { detail: { district: slug } }));
}

export function subscribeToDistrictChanges(listener: (district: RaceDistrictSlug) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ district?: string }>).detail;
    listener(normalizeDistrictSlug(detail?.district));
  };
  window.addEventListener(DISTRICT_THEME_EVENT, handler);
  return () => window.removeEventListener(DISTRICT_THEME_EVENT, handler);
}

const AUSTRALIAN_SLANG: Partial<Record<RaceDistrictSlug, string[]>> = {
  airaway: [
    "Badge up, mate — sky-bridge security is feeling stroppy.",
    "Keep it tidy as a servo receipt and don't look down.",
  ],
  batteryville: [
    "Chuck a sickie later; the freight line's live now.",
    "Too right, spark-runner — heavy load, heavier attitude.",
  ],
  "the-grid": [
    "No worries if you're invisible; big worries if Cascade agrees.",
    "Don't be a drongo — every lens has a ledger.",
  ],
  nightshade: [
    "Meet in the laneway, keep it suss, leave before the bass drops.",
    "She'll be right if the crew knows your tag.",
  ],
  "the-forest": [
    "Off-grid and fair dinkum — leave the shiny tracker at the treeline.",
    "Wooders don't yap; they carve the answer into the rail.",
  ],
  "glass-city": [
    "Looks flash as, mate — that's how the trap gets ya.",
    "Skate the reflection, not the road.",
  ],
};

const TRANSITION_EYEBROW_LINES: Partial<Record<RaceDistrictSlug, string[]>> = {
  airaway: [
    "District bleed engaged",
    "Air lane sync engaged",
    "Skyline feed rerouted",
  ],
  batteryville: [
    "District bleed engaged",
    "Breaker relay engaged",
    "Yard feed rerouted",
  ],
  "the-grid": [
    "District bleed engaged",
    "Grid relay engaged",
    "Signal feed rerouted",
  ],
  nightshade: [
    "District bleed engaged",
    "Murk relay engaged",
    "Shadow feed rerouted",
  ],
  "the-forest": [
    "District bleed engaged",
    "Rootline relay engaged",
    "Canopy feed rerouted",
  ],
  "glass-city": [
    "District bleed engaged",
    "Mirror relay engaged",
    "Exchange feed rerouted",
  ],
};

function buildDistrictTransitionCandidates(theme: DistrictTheme): string[] {
  const lore = DISTRICT_LORE_BY_NAME.get(theme.name);
  const language = DISTRICT_LANGUAGE_BY_SLUG.get(theme.slug);
  const flavorTexts = lore?.flavorTexts ?? [];
  const baseLines = [
    lore?.tagline,
    lore?.atmosphere,
    ...flavorTexts,
    language?.summary,
    language?.sample,
    ...(AUSTRALIAN_SLANG[theme.slug] ?? []),
  ]
    .filter((line): line is string => Boolean(line?.trim()))
    .map((line) => line.replace(/^"|"$/g, "").trim());

  if (baseLines.length === 0) return [];

  const firstFlavor = flavorTexts.find((line) => Boolean(line?.trim()));
  const remixed = [
    lore?.tagline && language?.summary ? `${lore.tagline} ${language.summary}` : null,
    lore?.atmosphere && language?.sample ? `${lore.atmosphere} ${language.sample}` : null,
    firstFlavor && language?.summary ? `${firstFlavor} ${language.summary}` : null,
    language?.sample && lore?.tagline ? `${language.sample} ${lore.tagline}` : null,
  ]
    .filter((line): line is string => Boolean(line?.trim()))
    .map((line) => line.replace(/\s+/g, " ").trim());

  return [...new Set([...baseLines, ...remixed])];
}

export function getDistrictTransitionEyebrow(district?: string | null, seed = 0): string {
  const theme = getDistrictTheme(district);
  const candidates = TRANSITION_EYEBROW_LINES[theme.slug] ?? ["District bleed engaged"];
  return candidates[Math.abs(seed) % candidates.length] ?? "District bleed engaged";
}

export function getDistrictTransitionLine(district?: string | null, seed = 0): string {
  const theme = getDistrictTheme(district);
  const candidates = buildDistrictTransitionCandidates(theme);
  if (candidates.length === 0) {
    console.warn(`[DistrictTheme] Missing transition copy for district: ${theme.slug}`);
    return "Booting the district feed…";
  }
  return candidates[Math.abs(seed) % candidates.length] ?? "Booting the district feed…";
}
