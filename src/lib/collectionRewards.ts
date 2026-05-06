import type { Archetype, CardPayload, District, Faction, Rarity } from "./types";

export type CollectionRewardKind = "badge" | "title" | "frame" | "lore" | "reroll_token";
export type CollectionRewardSafetyTier = "safe" | "controlled";
export type CollectionRewardFilter = "all" | "claimable" | "owned" | "locked" | "faction" | "district" | "seasonal";
export type CollectionMilestoneTrack = "collection" | "faction" | "district" | "rarity" | "activity" | "seasonal";
export type CollectionMilestoneRequirementKind =
  | "uniqueCards"
  | "cardsInFaction"
  | "archetypesInFaction"
  | "cardsInDistrict"
  | "allDistricts"
  | "firstRarity"
  | "rarityCount"
  | "activityCount";

export interface CollectionRewardDefinition {
  id: string;
  kind: CollectionRewardKind;
  safetyTier: CollectionRewardSafetyTier;
  name: string;
  description: string;
  value?: string | number;
}

export interface CollectionMilestoneRequirement {
  kind: CollectionMilestoneRequirementKind;
  target: number;
  faction?: Faction;
  district?: District;
  rarity?: Rarity;
  activity?: "missions" | "trades" | "battles" | "dailyStreak";
}

export interface CollectionMilestoneDefinition {
  id: string;
  track: CollectionMilestoneTrack;
  name: string;
  description: string;
  requirement: CollectionMilestoneRequirement;
  rewardIds: string[];
  seasonal?: boolean;
}

export interface CollectionRewardsState {
  badgeIds: string[];
  titleIds: string[];
  frameIds: string[];
  loreIds: string[];
  rerollTokens: number;
  claimedMilestoneIds: string[];
}

export interface CollectionActivityStats {
  missions: number;
  trades: number;
  battles: number;
  dailyStreak: number;
  eventParticipations: number;
}

export interface CollectionMilestoneProgress {
  milestone: CollectionMilestoneDefinition;
  rewards: CollectionRewardDefinition[];
  current: number;
  target: number;
  eligible: boolean;
  claimed: boolean;
  percent: number;
}

export interface CollectionRewardEvaluation {
  score: number;
  uniqueCardCount: number;
  duplicateVolumeScore: number;
  uniqueFactionCount: number;
  uniqueDistrictCount: number;
  uniqueRarityCount: number;
  state: CollectionRewardsState;
  milestones: CollectionMilestoneProgress[];
}

export const COLLECTION_REWARD_SCHEMA_VERSION = 1;
export const COLLECTION_REROLL_TOKEN_CAP = 10;

export const COLLECTION_REWARD_FACTIONS: Faction[] = [
  "United Corporations of America (UCA)",
  "Qu111s (Quills)",
  "Ne0n Legion",
  "Iron Curtains",
  "D4rk $pider",
  "The Asclepians",
  "The Mesopotamian Society",
  "The Knights Technarchy",
  "Hermes' Squirmies",
  "UCPS Workers",
  "The Team",
  "Moonrisers",
  "The Wooders",
  "Punch Skaters",
];

export const COLLECTION_REWARD_ARCHETYPES: Archetype[] = [
  "The Knights Technarchy",
  "Qu111s",
  "Ne0n Legion",
  "Iron Curtains",
  "D4rk $pider",
  "The Asclepians",
  "The Mesopotamian Society",
  "Hermes' Squirmies",
  "UCPS",
  "The Team",
];

export const COLLECTION_REWARD_DISTRICTS: District[] = ["Airaway", "Batteryville", "The Grid", "Nightshade", "The Forest", "Glass City"];
export const COLLECTION_REWARD_RARITIES: Rarity[] = ["Punch Skater", "Apprentice", "Master", "Rare", "Legendary"];

export const COLLECTION_REWARDS: CollectionRewardDefinition[] = [
  { id: "badge-starter-stack", kind: "badge", safetyTier: "safe", name: "Starter Stack", description: "Collected five unique Punch Skaters." },
  { id: "title-crew-curator", kind: "title", safetyTier: "safe", name: "Crew Curator", description: "Collected ten unique Punch Skaters." },
  { id: "frame-archive-neon", kind: "frame", safetyTier: "safe", name: "Archive Neon Frame", description: "Cosmetic frame for a broad 25-card archive.", value: "archive-neon" },
  { id: "lore-codex-street-archive", kind: "lore", safetyTier: "safe", name: "Street Archive Codex", description: "A lore chapter on underground card collectors." },
  { id: "badge-century-archive", kind: "badge", safetyTier: "safe", name: "Century Archive", description: "Prestige badge for 100 unique cards." },
  { id: "frame-seasonal-archive", kind: "frame", safetyTier: "safe", name: "Seasonal Archive Frame", description: "Seasonal cosmetic frame variant for completionists.", value: "seasonal-archive" },
  { id: "token-cosmetic-reroll", kind: "reroll_token", safetyTier: "controlled", name: "Cosmetic Reroll Token", description: "Earned token for non-power rerolls only.", value: 1 },
  { id: "badge-district-atlas", kind: "badge", safetyTier: "safe", name: "District Atlas", description: "Collected a card from every live district." },
  { id: "frame-world-map", kind: "frame", safetyTier: "safe", name: "World Map Frame", description: "Cosmetic frame for completing district collection sets.", value: "world-map" },
  { id: "badge-apprentice-scout", kind: "badge", safetyTier: "safe", name: "Apprentice Scout", description: "Collected an Apprentice card." },
  { id: "badge-master-scout", kind: "badge", safetyTier: "safe", name: "Master Scout", description: "Collected a Master card." },
  { id: "badge-rare-scout", kind: "badge", safetyTier: "safe", name: "Rare Scout", description: "Collected a Rare card." },
  { id: "badge-legendary-witness", kind: "badge", safetyTier: "safe", name: "Legendary Witness", description: "Earned your first Legendary card." },
  { id: "title-legendary-scout", kind: "title", safetyTier: "safe", name: "Legendary Scout", description: "Collected three Legendary cards without gaining combat power." },
  { id: "title-market-runner", kind: "title", safetyTier: "safe", name: "Market Runner", description: "Completed trade collection milestones." },
  { id: "badge-mission-stringer", kind: "badge", safetyTier: "safe", name: "Mission Stringer", description: "Completed mission collection milestones." },
  { id: "badge-arena-regular", kind: "badge", safetyTier: "safe", name: "Arena Regular", description: "Participated in battle milestones." },
  { id: "lore-daily-rituals", kind: "lore", safetyTier: "safe", name: "Daily Rituals", description: "Unlocked lore from a seven-day streak." },
];

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function makeReward(id: string, kind: CollectionRewardKind, name: string, description: string, value?: string | number): CollectionRewardDefinition {
  return { id, kind, safetyTier: kind === "reroll_token" ? "controlled" : "safe", name, description, value };
}

const factionRewards = COLLECTION_REWARD_FACTIONS.flatMap((faction) => {
  const slug = slugify(faction);
  return [
    makeReward(`badge-faction-${slug}`, "badge", `${faction} Badge`, `Collected three unique ${faction} cards.`),
    makeReward(`title-faction-${slug}`, "title", `${faction} Archivist`, `Collected six unique ${faction} cards.`),
    makeReward(`frame-faction-${slug}`, "frame", `${faction} Gallery Frame`, `Cosmetic frame for a full ${faction} archetype spread.`, `faction-${slug}`),
  ];
});

const districtRewards = COLLECTION_REWARD_DISTRICTS.flatMap((district) => {
  const slug = slugify(district);
  return [
    makeReward(`badge-district-${slug}`, "badge", `${district} Runner`, `Collected three unique ${district} cards.`),
    makeReward(`lore-district-${slug}`, "lore", `${district} Rumors`, `Unlocked district rumors for ${district}.`),
  ];
});

export const COLLECTION_REWARD_CATALOG: CollectionRewardDefinition[] = [
  ...COLLECTION_REWARDS,
  ...factionRewards,
  ...districtRewards,
];

const baseMilestones: CollectionMilestoneDefinition[] = [
  { id: "collection-unique-5", track: "collection", name: "Starter Stack", description: "Collect five unique cards.", requirement: { kind: "uniqueCards", target: 5 }, rewardIds: ["badge-starter-stack"] },
  { id: "collection-unique-10", track: "collection", name: "Crew Curator", description: "Collect ten unique cards.", requirement: { kind: "uniqueCards", target: 10 }, rewardIds: ["title-crew-curator", "token-cosmetic-reroll"] },
  { id: "collection-unique-25", track: "collection", name: "Archive Neon", description: "Collect 25 unique cards.", requirement: { kind: "uniqueCards", target: 25 }, rewardIds: ["frame-archive-neon"] },
  { id: "collection-unique-50", track: "collection", name: "Street Archive", description: "Collect 50 unique cards.", requirement: { kind: "uniqueCards", target: 50 }, rewardIds: ["lore-codex-street-archive", "token-cosmetic-reroll"] },
  { id: "collection-unique-100", track: "collection", name: "Century Archive", description: "Collect 100 unique cards.", requirement: { kind: "uniqueCards", target: 100 }, rewardIds: ["badge-century-archive", "frame-seasonal-archive", "token-cosmetic-reroll"], seasonal: true },
  { id: "district-all-live", track: "district", name: "District Atlas", description: "Collect at least one card from every live district.", requirement: { kind: "allDistricts", target: COLLECTION_REWARD_DISTRICTS.length }, rewardIds: ["badge-district-atlas"] },
  { id: "district-all-sets", track: "district", name: "World Map Gallery", description: "Collect six unique cards in every live district.", requirement: { kind: "cardsInDistrict", target: 6 }, rewardIds: ["frame-world-map"] },
  { id: "rarity-first-apprentice", track: "rarity", name: "Apprentice Scout", description: "Collect an Apprentice card.", requirement: { kind: "firstRarity", rarity: "Apprentice", target: 1 }, rewardIds: ["badge-apprentice-scout"] },
  { id: "rarity-first-master", track: "rarity", name: "Master Scout", description: "Collect a Master card.", requirement: { kind: "firstRarity", rarity: "Master", target: 1 }, rewardIds: ["badge-master-scout"] },
  { id: "rarity-first-rare", track: "rarity", name: "Rare Scout", description: "Collect a Rare card.", requirement: { kind: "firstRarity", rarity: "Rare", target: 1 }, rewardIds: ["badge-rare-scout"] },
  { id: "rarity-first-legendary", track: "rarity", name: "Legendary Witness", description: "Collect a Legendary card.", requirement: { kind: "firstRarity", rarity: "Legendary", target: 1 }, rewardIds: ["badge-legendary-witness"] },
  { id: "rarity-legendary-3", track: "rarity", name: "Legendary Scout", description: "Collect three Legendary cards for a title only.", requirement: { kind: "rarityCount", rarity: "Legendary", target: 3 }, rewardIds: ["title-legendary-scout"] },
  { id: "activity-trades-10", track: "activity", name: "Market Runner", description: "Complete ten trades.", requirement: { kind: "activityCount", activity: "trades", target: 10 }, rewardIds: ["title-market-runner"] },
  { id: "activity-missions-10", track: "activity", name: "Mission Stringer", description: "Complete ten missions.", requirement: { kind: "activityCount", activity: "missions", target: 10 }, rewardIds: ["badge-mission-stringer", "token-cosmetic-reroll"] },
  { id: "activity-battles-10", track: "activity", name: "Arena Regular", description: "Participate in ten battles.", requirement: { kind: "activityCount", activity: "battles", target: 10 }, rewardIds: ["badge-arena-regular"] },
  { id: "activity-streak-7", track: "activity", name: "Daily Rituals", description: "Reach a seven-day login streak.", requirement: { kind: "activityCount", activity: "dailyStreak", target: 7 }, rewardIds: ["lore-daily-rituals", "token-cosmetic-reroll"] },
];

const factionMilestones = COLLECTION_REWARD_FACTIONS.flatMap((faction) => {
  const slug = slugify(faction);
  return [
    { id: `faction-${slug}-3`, track: "faction" as const, name: `${faction} Badge`, description: `Collect three unique ${faction} cards.`, requirement: { kind: "cardsInFaction" as const, faction, target: 3 }, rewardIds: [`badge-faction-${slug}`] },
    { id: `faction-${slug}-6`, track: "faction" as const, name: `${faction} Archivist`, description: `Collect six unique ${faction} cards.`, requirement: { kind: "cardsInFaction" as const, faction, target: 6 }, rewardIds: [`title-faction-${slug}`] },
    { id: `faction-${slug}-archetypes`, track: "faction" as const, name: `${faction} Gallery`, description: `Collect every available archetype represented in ${faction}.`, requirement: { kind: "archetypesInFaction" as const, faction, target: COLLECTION_REWARD_ARCHETYPES.length }, rewardIds: [`frame-faction-${slug}`] },
  ];
});

const districtMilestones = COLLECTION_REWARD_DISTRICTS.map((district) => {
  const slug = slugify(district);
  return { id: `district-${slug}-3`, track: "district" as const, name: `${district} Runner`, description: `Collect three unique ${district} cards.`, requirement: { kind: "cardsInDistrict" as const, district, target: 3 }, rewardIds: [`badge-district-${slug}`, `lore-district-${slug}`] };
});

export const COLLECTION_MILESTONES: CollectionMilestoneDefinition[] = [
  ...baseMilestones,
  ...factionMilestones,
  ...districtMilestones,
];

export const COLLECTION_REWARD_BY_ID = Object.fromEntries(COLLECTION_REWARD_CATALOG.map((reward) => [reward.id, reward]));

export function normalizeCollectionRewardsState(input?: Partial<CollectionRewardsState> | null): CollectionRewardsState {
  return {
    badgeIds: Array.isArray(input?.badgeIds) ? input.badgeIds.filter((value): value is string => typeof value === "string") : [],
    titleIds: Array.isArray(input?.titleIds) ? input.titleIds.filter((value): value is string => typeof value === "string") : [],
    frameIds: Array.isArray(input?.frameIds) ? input.frameIds.filter((value): value is string => typeof value === "string") : [],
    loreIds: Array.isArray(input?.loreIds) ? input.loreIds.filter((value): value is string => typeof value === "string") : [],
    rerollTokens: Math.max(0, Math.min(COLLECTION_REROLL_TOKEN_CAP, Number(input?.rerollTokens) || 0)),
    claimedMilestoneIds: Array.isArray(input?.claimedMilestoneIds) ? input.claimedMilestoneIds.filter((value): value is string => typeof value === "string") : [],
  };
}

export function defaultCollectionActivityStats(input?: Partial<CollectionActivityStats> | null): CollectionActivityStats {
  return {
    missions: Math.max(0, Number(input?.missions) || 0),
    trades: Math.max(0, Number(input?.trades) || 0),
    battles: Math.max(0, Number(input?.battles) || 0),
    dailyStreak: Math.max(0, Number(input?.dailyStreak) || 0),
    eventParticipations: Math.max(0, Number(input?.eventParticipations) || 0),
  };
}

function cardUniqueKey(card: CardPayload): string {
  return [
    card.identity?.name?.trim().toLowerCase() || card.id,
    card.identity?.crew || "",
    card.prompts?.district || "",
    card.prompts?.rarity || card.class?.rarity || "",
  ].join("|");
}

function countCardsBy<T extends string>(cards: CardPayload[], selector: (card: CardPayload) => T | undefined, expected?: T): number {
  return new Set(cards.filter((card) => !expected || selector(card) === expected).map(cardUniqueKey)).size;
}

function evaluateCurrent(requirement: CollectionMilestoneRequirement, cards: CardPayload[], activity: CollectionActivityStats): number {
  switch (requirement.kind) {
    case "uniqueCards":
      return countCardsBy(cards, () => "all");
    case "cardsInFaction":
      return countCardsBy(cards, (card) => card.identity?.crew, requirement.faction);
    case "archetypesInFaction":
      return new Set(cards.filter((card) => card.identity?.crew === requirement.faction).map((card) => card.prompts?.archetype).filter(Boolean)).size;
    case "cardsInDistrict": {
      if (requirement.district) return countCardsBy(cards, (card) => card.prompts?.district, requirement.district);
      return Math.min(...COLLECTION_REWARD_DISTRICTS.map((district) => countCardsBy(cards, (card) => card.prompts?.district, district)));
    }
    case "allDistricts":
      return new Set(cards.map((card) => card.prompts?.district).filter((district): district is District => COLLECTION_REWARD_DISTRICTS.includes(district as District))).size;
    case "firstRarity":
    case "rarityCount":
      return countCardsBy(cards, (card) => card.prompts?.rarity ?? card.class?.rarity, requirement.rarity);
    case "activityCount":
      return requirement.activity ? activity[requirement.activity] : 0;
    default:
      return 0;
  }
}

export function calculateCollectionScore(cards: CardPayload[], state?: Partial<CollectionRewardsState> | null, activityInput?: Partial<CollectionActivityStats> | null): number {
  const normalizedState = normalizeCollectionRewardsState(state);
  const activity = defaultCollectionActivityStats(activityInput);
  const uniqueCards = new Set(cards.map(cardUniqueKey)).size;
  const duplicateVolumeScore = Math.floor(Math.sqrt(Math.max(0, cards.length - uniqueCards)) * 3);
  const uniqueFactionCount = new Set(cards.map((card) => card.identity?.crew).filter(Boolean)).size;
  const uniqueDistrictCount = new Set(cards.map((card) => card.prompts?.district).filter(Boolean)).size;
  const safeCosmetics = normalizedState.badgeIds.length + normalizedState.titleIds.length + normalizedState.frameIds.length;
  return (
    uniqueCards * 10 +
    duplicateVolumeScore +
    uniqueFactionCount * 25 +
    uniqueDistrictCount * 30 +
    normalizedState.loreIds.length * 20 +
    safeCosmetics * 15 +
    Math.min(activity.eventParticipations, 10) * 10
  );
}

export function evaluateCollectionRewards(
  cards: CardPayload[],
  stateInput?: Partial<CollectionRewardsState> | null,
  activityInput?: Partial<CollectionActivityStats> | null,
): CollectionRewardEvaluation {
  const state = normalizeCollectionRewardsState(stateInput);
  const activity = defaultCollectionActivityStats(activityInput);
  const uniqueCardCount = new Set(cards.map(cardUniqueKey)).size;
  const duplicateVolumeScore = Math.floor(Math.sqrt(Math.max(0, cards.length - uniqueCardCount)) * 3);
  const uniqueFactionCount = new Set(cards.map((card) => card.identity?.crew).filter(Boolean)).size;
  const uniqueDistrictCount = new Set(cards.map((card) => card.prompts?.district).filter(Boolean)).size;
  const uniqueRarityCount = new Set(cards.map((card) => card.prompts?.rarity ?? card.class?.rarity).filter(Boolean)).size;
  const claimed = new Set(state.claimedMilestoneIds);

  const milestones = COLLECTION_MILESTONES.map((milestone) => {
    const current = evaluateCurrent(milestone.requirement, cards, activity);
    const target = milestone.requirement.target;
    return {
      milestone,
      rewards: milestone.rewardIds.map((id) => COLLECTION_REWARD_BY_ID[id]).filter((reward): reward is CollectionRewardDefinition => Boolean(reward)),
      current,
      target,
      eligible: current >= target,
      claimed: claimed.has(milestone.id),
      percent: target > 0 ? Math.min(100, Math.floor((current / target) * 100)) : 100,
    };
  });

  return {
    score: calculateCollectionScore(cards, state, activity),
    uniqueCardCount,
    duplicateVolumeScore,
    uniqueFactionCount,
    uniqueDistrictCount,
    uniqueRarityCount,
    state,
    milestones,
  };
}

export function applyCollectionMilestoneClaim(
  stateInput: Partial<CollectionRewardsState> | null | undefined,
  milestoneId: string,
): { state: CollectionRewardsState; rewards: CollectionRewardDefinition[]; alreadyClaimed: boolean } {
  const state = normalizeCollectionRewardsState(stateInput);
  if (state.claimedMilestoneIds.includes(milestoneId)) {
    return { state, rewards: [], alreadyClaimed: true };
  }

  const milestone = COLLECTION_MILESTONES.find((entry) => entry.id === milestoneId);
  if (!milestone) return { state, rewards: [], alreadyClaimed: false };
  const rewards = milestone.rewardIds.map((id) => COLLECTION_REWARD_BY_ID[id]).filter((reward): reward is CollectionRewardDefinition => Boolean(reward));
  const next = normalizeCollectionRewardsState({ ...state, claimedMilestoneIds: [...state.claimedMilestoneIds, milestoneId] });

  for (const reward of rewards) {
    if (reward.kind === "badge" && !next.badgeIds.includes(reward.id)) next.badgeIds.push(reward.id);
    if (reward.kind === "title" && !next.titleIds.includes(reward.id)) next.titleIds.push(reward.id);
    if (reward.kind === "frame" && !next.frameIds.includes(reward.id)) next.frameIds.push(reward.id);
    if (reward.kind === "lore" && !next.loreIds.includes(reward.id)) next.loreIds.push(reward.id);
    if (reward.kind === "reroll_token") {
      next.rerollTokens = Math.min(COLLECTION_REROLL_TOKEN_CAP, next.rerollTokens + Math.max(1, Number(reward.value) || 1));
    }
  }

  return { state: next, rewards, alreadyClaimed: false };
}
