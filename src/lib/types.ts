export interface CardPayload {
  id: string;
  version: "1.0.0";
  prompts: {
    archetype: string;
    rarity: string;
    styleVibe: string;
    district: string;
    accentColor: string;
  };
  seed: string;
  identity: {
    name: string;
    crew: string;
    manufacturer: string;
    serialNumber: string;
  };
  stats: {
    speed: number;
    stealth: number;
    tech: number;
    grit: number;
    rep: number;
  };
  traits: {
    personalityTags: string[];
    passiveTrait: { name: string; description: string };
    activeAbility: { name: string; description: string };
  };
  flavorText: string;
  visuals: {
    helmetStyle: string;
    boardStyle: string;
    jacketStyle: string;
    colorScheme: string;
    accentColor: string;
  };
  tags: string[];
  createdAt: string;
}

export interface DeckPayload {
  id: string;
  version: "1.0.0";
  name: string;
  cards: CardPayload[];
  createdAt: string;
  updatedAt: string;
}

export type Archetype = "Runner" | "Ghost" | "Bruiser" | "Tech" | "Medic";
export type Rarity = "Common" | "Uncommon" | "Rare" | "Legendary";
export type StyleVibe = "Street" | "Corporate" | "Underground" | "Neon" | "Chrome";
export type District = "Neon District" | "The Sprawl" | "Chrome Heights" | "Undercity" | "Corporate Core";

export interface CardPrompts {
  archetype: Archetype;
  rarity: Rarity;
  styleVibe: StyleVibe;
  district: District;
  accentColor: string;
}
