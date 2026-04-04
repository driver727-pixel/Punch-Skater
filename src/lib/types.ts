export interface CardPayload {
  id: string;
  version: "1.0.0";
  prompts: {
    archetype: string;
    rarity: string;
    style: string;
    vibe: string;
    district: string;
    accentColor: string;
    stamina: number;
  };
  /** Master seed: frameSeed::backgroundSeed::characterSeed */
  seed: string;
  /** Layer-1 seed — determined by rarity alone */
  frameSeed: string;
  /** Layer-2 seed — determined by district alone */
  backgroundSeed: string;
  /** Layer-3 seed — determined by archetype, style, vibe, stamina */
  characterSeed: string;
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
    stamina: number;
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
    storagePackStyle: string;
  };
  tags: string[];
  createdAt: string;
  /** AI-generated illustration URL produced by the image generation service. */
  imageUrl?: string;
}

export interface DeckPayload {
  id: string;
  version: "1.0.0";
  name: string;
  cards: CardPayload[];
  createdAt: string;
  updatedAt: string;
}

export type TradeStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface TradePayload {
  id: string;
  fromUid: string;
  fromEmail: string;
  toUid: string;
  toEmail: string;
  offeredCard: CardPayload;
  status: TradeStatus;
  createdAt: string;
  updatedAt: string;
}

export type Archetype = "Ninja" | "Punk Rocker" | "Ex Military" | "Hacker" | "Chef";
export type Rarity = "Legendary" | "Rare" | "Master" | "Apprentice" | "Punch Skater";
export type Style = "Corporate" | "Street" | "Off-grid" | "Military" | "Union";
export type Vibe = "Grunge" | "Neon" | "Chrome" | "Plastic";
export type District = "Airaway" | "Nightshade" | "Batteryville";

export interface CardPrompts {
  archetype: Archetype;
  rarity: Rarity;
  style: Style;
  vibe: Vibe;
  district: District;
  accentColor: string;
  stamina: number;
}
