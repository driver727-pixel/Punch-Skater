import type { Archetype, CardPayload, CardPrompts, District, Faction } from "./types";
import { remapStyleConnection } from "./styles";

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
];

const ARCHETYPE_LABEL_MAP = new Map(FORGE_ARCHETYPE_OPTIONS.map((option) => [option.value, option.label]));

// Legacy style cleanup keeps the Dark Spider reveal wired to the requested
// successor styles after Ninja/Hacker were removed from the active style list.
const DARK_SPIDER_STYLE_MATCHES: ReadonlySet<string> = new Set(["Punk Rocker", "Ex Military"]);
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
    (prompts.archetype === "D4rk $pider" || DARK_SPIDER_STYLE_MATCHES.has(remapStyleConnection(prompts.style))) &&
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
      isSecretReveal: !!revealedFaction,
      ...(revealedFaction != null ? { revealedFaction } : {}),
      ...(isDarkSpiderReveal ? { logoMark: "🕷 D4rk $pider" } : {}),
      ...(revealedFaction != null ? { unlockedAt: new Date().toISOString() } : {}),
    },
  };
}
