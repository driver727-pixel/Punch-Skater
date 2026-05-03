import type { Archetype, CardPayload, CardPrompts, District, Faction } from "./types";
import { remapStyleConnection } from "./styles";

export { FORGE_ARCHETYPE_OPTIONS, getForgeArchetypeLabel, getForgeCoverRole } from "./coverIdentity";

export interface ForgeArchetypeOption {
  value: Archetype;
  label: string;
  coverRole: string;
}

// Legacy style cleanup keeps the Dark Spider reveal wired to the requested
// successor styles after Ninja/Hacker were removed from the active style list.
const DARK_SPIDER_STYLE_MATCHES: ReadonlySet<string> = new Set(["Punk Rocker", "Ex Military"]);
const DARK_SPIDER_DISTRICT_MATCHES: ReadonlySet<District> = new Set([
  "Airaway",
  "Batteryville",
  "The Grid",
  "Glass City",
]);

// Styles that signal a UCA-aligned courier in Airaway
const UCA_STYLE_MATCHES: ReadonlySet<string> = new Set(["Corporate", "Fascist"]);

// Per-faction flavor text and logo marks shown on reveal
const FACTION_BRANDING: Partial<Record<Faction, { logoMark: string; flavorText: string }>> = {
  "D4rk $pider": {
    logoMark: "🕷 D4rk $pider",
    flavorText: "Signal cracked. D4rk $pider has surfaced from the noise and stamped this run.",
  },
  "The Knights Technarchy": {
    logoMark: "🗡 The Knights Technarchy",
    flavorText: "The Dark Lights have marked this run. You've entered the Technarchy's shadow.",
  },
  "Qu111s (Quills)": {
    logoMark: "✒ Qu111s",
    flavorText: "Signal intercepted. The Quills have logged this run for the record.",
  },
  "Ne0n Legion": {
    logoMark: "⚡ Ne0n Legion",
    flavorText: "Fast money, faster exits. Ne0n Legion has taken an interest in this run.",
  },
  "Iron Curtains": {
    logoMark: "✊ Iron Curtains",
    flavorText: "Revolution doesn't wait. The Iron Curtains have drafted this courier.",
  },
  "The Asclepians": {
    logoMark: "🩺 The Asclepians",
    flavorText: "No questions asked. The Asclepians have sanctioned this delivery.",
  },
  "The Mesopotamian Society": {
    logoMark: "🏺 The Mesopotamian Society",
    flavorText: "The artifact trail leads here. The Mesopotamian Society has noted this run.",
  },
  "Hermes' Squirmies": {
    logoMark: "📦 Hermes' Squirmies",
    flavorText: "Any job. Any risk. Hermes' Squirmies have picked up this contract.",
  },
  "UCPS Workers": {
    logoMark: "📮 UCPS Workers",
    flavorText: "Sanctioned and stamped. UCPS has cleared this courier for delivery.",
  },
  "United Corporations of America (UCA)": {
    logoMark: "🏙 United Corporations of America (UCA)",
    flavorText: "Corporate clearance confirmed. UCA has eyes on this run from Airaway.",
  },
  "Moonrisers": {
    logoMark: "🌙 Moonrisers",
    flavorText: "The rave starts at midnight. Moonrisers have spotted this courier in the dark.",
  },
  "The Wooders": {
    logoMark: "🌲 The Wooders",
    flavorText: "No screens. No trackers. The Wooders have acknowledged this rider from the canopy.",
  },
  "Punch Skaters": {
    logoMark: "🛹 Punch Skaters",
    flavorText: "Bloodied knuckles, battered board. Another Punch Skater hits the streets.",
  },
  "The Team": {
    logoMark: "🏅 The Team",
    flavorText: "Coordination wins. The Team has clocked this run and added it to the board.",
  },
};

export function resolveSecretFaction(prompts: CardPrompts): Faction | null {
  // 1. Any forge inside The Forest reveals The Wooders — it's their exclusive territory.
  if (prompts.district === "The Forest") return "The Wooders";

  // 2. D4rk $pider (legacy logic preserved — wired to successor styles after
  //    Ninja/Hacker were removed from the active style list).
  const darkSpiderMatch =
    prompts.rarity === "Apprentice" &&
    (prompts.archetype === "D4rk $pider" || DARK_SPIDER_STYLE_MATCHES.has(remapStyleConnection(prompts.style))) &&
    DARK_SPIDER_DISTRICT_MATCHES.has(prompts.district);
  if (darkSpiderMatch) return "D4rk $pider";

  // 3. UCA: a Corporate or Fascist-styled courier operating out of Airaway
  //    surfaces the governing body before any archetype check fires.
  if (UCA_STYLE_MATCHES.has(remapStyleConnection(prompts.style)) && prompts.district === "Airaway") {
    return "United Corporations of America (UCA)";
  }

  // 4. Moonrisers: Apprentice couriers running Street-style packages through
  //    Nightshade underground — the classic Moonriser recruitment path.
  if (
    prompts.rarity === "Apprentice" &&
    prompts.district === "Nightshade" &&
    remapStyleConnection(prompts.style) === "Street"
  ) {
    return "Moonrisers";
  }

  // 5. Remaining factions stay hidden until additional gameplay-specific
  //    reveal combinations are satisfied.
  return null;
}

export function applyFactionBranding(
  card: CardPayload,
  displayArchetype: string,
  revealedFaction: Faction | null,
): CardPayload {
  const branding = revealedFaction != null ? FACTION_BRANDING[revealedFaction] : undefined;

  return {
    ...card,
    front: {
      ...card.front,
      flavorText: branding
        ? branding.flavorText
        : `Running packages through ${card.prompts.district}.`,
    },
    role: {
      ...card.role,
      label: displayArchetype,
    },
  };
}
