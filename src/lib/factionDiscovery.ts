import type { Archetype, CardPayload, CardPrompts, District, Faction, Style } from "./types";

export interface ForgeArchetypeOption {
  value: Archetype;
  label: string;
}

export const FORGE_ARCHETYPE_OPTIONS: ForgeArchetypeOption[] = [
  { value: "Qu111s", label: "Journalist" },
  { value: "D4rk $pider", label: "Hacker" },
  { value: "The Asclepians", label: "Humanitarian" },
  { value: "The Mesopotamian Society", label: "Archeologist" },
  { value: "The Knights Technarchy", label: "Ninja" },
  { value: "Hermes' Squirmies", label: "Blue collar worker" },
  { value: "UCPS", label: "Postal worker" },
  { value: "Iron Curtains", label: "Chef" },
  { value: "Ne0n Legion", label: "Thief" },
];

const ARCHETYPE_LABEL_MAP = new Map(FORGE_ARCHETYPE_OPTIONS.map((option) => [option.value, option.label]));

const DARK_SPIDER_STYLE_MATCHES: ReadonlySet<Style> = new Set(["Ninja", "Hacker", "Military"]);
const DARK_SPIDER_VIBE_MATCHES = new Set(["Neon", "Plastic"]);
const DARK_SPIDER_DISTRICT_MATCHES: ReadonlySet<District> = new Set([
  "Airaway",
  "Batteryville",
  "The Grid",
  "Glass City",
]);

export function getForgeArchetypeLabel(archetype: Archetype): string {
  return ARCHETYPE_LABEL_MAP.get(archetype) ?? archetype;
}

export function resolveSecretFaction(prompts: CardPrompts): Faction | null {
  const darkSpiderMatch =
    prompts.rarity === "Apprentice" &&
    (prompts.archetype === "D4rk $pider" || DARK_SPIDER_STYLE_MATCHES.has(prompts.style)) &&
    DARK_SPIDER_VIBE_MATCHES.has(prompts.vibe) &&
    DARK_SPIDER_DISTRICT_MATCHES.has(prompts.district);

  return darkSpiderMatch ? "D4rk $pider" : null;
}

export function applyFactionBranding(
  card: CardPayload,
  displayArchetype: string,
  revealedFaction: Faction | null,
): CardPayload {
  const isDarkSpiderReveal = revealedFaction === "D4rk $pider";

  return {
    ...card,
    flavorText: isDarkSpiderReveal
      ? "Signal cracked. D4rk $pider has surfaced from the noise and stamped this run."
      : `A ${card.prompts.rarity} ${displayArchetype} running packages through ${card.prompts.district}.`,
    tags: Array.from(
      new Set([
        ...card.tags.filter((tag) => tag !== card.prompts.archetype),
        displayArchetype,
        ...(revealedFaction ? [revealedFaction, "Secret Faction"] : []),
      ]),
    ),
    discovery: {
      displayArchetype,
      revealedFaction: revealedFaction ?? undefined,
      isSecretReveal: !!revealedFaction,
      logoMark: isDarkSpiderReveal ? "🕷 D4rk $pider" : undefined,
      unlockedAt: revealedFaction ? new Date().toISOString() : undefined,
    },
  };
}
