export const COLLECTION_REWARD_SCHEMA_VERSION = 1;
export const COLLECTION_REROLL_TOKEN_CAP = 10;
export const COLLECTION_REROLL_ACTIONS = [
  {
    id: 'character',
    name: 'Character reroll',
    description: 'Refresh the courier portrait only.',
    tokenCost: 1,
    targets: ['character'],
  },
  {
    id: 'board',
    name: 'Board reroll',
    description: 'Refresh the skateboard artwork only.',
    tokenCost: 1,
    targets: ['board'],
  },
  {
    id: 'full',
    name: 'Full reroll',
    description: 'Refresh both the courier portrait and skateboard artwork.',
    tokenCost: 2,
    targets: ['character', 'board'],
  },
];
export const COLLECTION_REROLL_ACTION_BY_ID = Object.fromEntries(
  COLLECTION_REROLL_ACTIONS.map((action) => [action.id, action]),
);

export const COLLECTION_REWARD_FACTIONS = [
  'United Corporate Alliance (UCA)',
  'Qu111s (Quills)',
  'Ne0n Legion',
  'Iron Curtains',
  'D4rk $pider',
  'The Asclepians',
  'The Mesopotamian Society',
  'The Knights Technarchy',
  "Hermes' Squirmies",
  'UCPS Workers',
  'The Team',
  'Moonrisers',
  'The Wooders',
  'Punch Skaters',
];

export const COLLECTION_REWARD_ARCHETYPES = [
  'The Knights Technarchy',
  'Qu111s',
  'Ne0n Legion',
  'Iron Curtains',
  'D4rk $pider',
  'The Asclepians',
  'The Mesopotamian Society',
  "Hermes' Squirmies",
  'UCPS',
  'The Team',
];

export const COLLECTION_REWARD_DISTRICTS = ['Airaway', 'Batteryville', 'The Grid', 'Nightshade', 'The Forest', 'Glass City'];
export const COLLECTION_REWARD_RARITIES = ['Punch Skater', 'Apprentice', 'Master', 'Rare', 'Legendary'];

export const COLLECTION_REWARDS = [
  { id: 'badge-starter-stack', kind: 'badge', safetyTier: 'safe', name: 'Starter Stack', description: 'Collected five unique cards.' },
  { id: 'title-crew-curator', kind: 'title', safetyTier: 'safe', name: 'Crew Curator', description: 'Collected ten unique cards.' },
  { id: 'frame-archive-neon', kind: 'frame', safetyTier: 'safe', name: 'Archive Neon Frame', description: 'Cosmetic frame for a broad 25-card archive.', value: 'archive-neon' },
  { id: 'lore-codex-street-archive', kind: 'lore', safetyTier: 'safe', name: 'Street Archive Codex', description: 'A lore chapter on underground card collectors.' },
  { id: 'badge-century-archive', kind: 'badge', safetyTier: 'safe', name: 'Century Archive', description: 'Prestige badge for 100 unique cards.' },
  { id: 'frame-seasonal-archive', kind: 'frame', safetyTier: 'safe', name: 'Seasonal Archive Frame', description: 'Seasonal cosmetic frame variant for completionists.', value: 'seasonal-archive' },
  { id: 'token-cosmetic-reroll', kind: 'reroll_token', safetyTier: 'controlled', name: 'Cosmetic Reroll Token', description: 'Earned token for non-power rerolls only.', value: 1 },
  { id: 'badge-district-atlas', kind: 'badge', safetyTier: 'safe', name: 'District Atlas', description: 'Collected a card from every live district.' },
  { id: 'frame-world-map', kind: 'frame', safetyTier: 'safe', name: 'World Map Frame', description: 'Cosmetic frame for completing district collection sets.', value: 'world-map' },
  { id: 'badge-apprentice-scout', kind: 'badge', safetyTier: 'safe', name: 'Apprentice Scout', description: 'Collected an Apprentice card.' },
  { id: 'badge-master-scout', kind: 'badge', safetyTier: 'safe', name: 'Master Scout', description: 'Collected a Master card.' },
  { id: 'badge-rare-scout', kind: 'badge', safetyTier: 'safe', name: 'Rare Scout', description: 'Collected a Rare card.' },
  { id: 'badge-legendary-witness', kind: 'badge', safetyTier: 'safe', name: 'Legendary Witness', description: 'Earned your first Legendary card.' },
  { id: 'title-legendary-scout', kind: 'title', safetyTier: 'safe', name: 'Legendary Scout', description: 'Collected three Legendary cards without gaining combat power.' },
  { id: 'title-market-runner', kind: 'title', safetyTier: 'safe', name: 'Market Runner', description: 'Completed trade collection milestones.' },
  { id: 'badge-mission-stringer', kind: 'badge', safetyTier: 'safe', name: 'Mission Stringer', description: 'Completed mission collection milestones.' },
  { id: 'badge-arena-regular', kind: 'badge', safetyTier: 'safe', name: 'Arena Regular', description: 'Participated in battle milestones.' },
  { id: 'lore-daily-rituals', kind: 'lore', safetyTier: 'safe', name: 'Daily Rituals', description: 'Unlocked lore from a seven-day streak.' },
];

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function makeReward(id, kind, name, description, value) {
  return { id, kind, safetyTier: kind === 'reroll_token' ? 'controlled' : 'safe', name, description, value };
}

const factionRewards = COLLECTION_REWARD_FACTIONS.flatMap((faction) => {
  const slug = slugify(faction);
  return [
    makeReward(`badge-faction-${slug}`, 'badge', `${faction} Badge`, `Collected three unique ${faction} cards.`),
    makeReward(`title-faction-${slug}`, 'title', `${faction} Archivist`, `Collected six unique ${faction} cards.`),
    makeReward(`frame-faction-${slug}`, 'frame', `${faction} Gallery Frame`, `Cosmetic frame for a full ${faction} archetype spread.`, `faction-${slug}`),
  ];
});

const districtRewards = COLLECTION_REWARD_DISTRICTS.flatMap((district) => {
  const slug = slugify(district);
  return [
    makeReward(`badge-district-${slug}`, 'badge', `${district} Runner`, `Collected three unique ${district} cards.`),
    makeReward(`lore-district-${slug}`, 'lore', `${district} Rumors`, `Unlocked district rumors for ${district}.`),
  ];
});

export const COLLECTION_REWARD_CATALOG = [
  ...COLLECTION_REWARDS,
  ...factionRewards,
  ...districtRewards,
];

const baseMilestones = [
  { id: 'collection-unique-5', track: 'collection', name: 'Starter Stack', description: 'Collect five unique cards.', requirement: { kind: 'uniqueCards', target: 5 }, rewardIds: ['badge-starter-stack'] },
  { id: 'collection-unique-10', track: 'collection', name: 'Crew Curator', description: 'Collect ten unique cards.', requirement: { kind: 'uniqueCards', target: 10 }, rewardIds: ['title-crew-curator', 'token-cosmetic-reroll'] },
  { id: 'collection-unique-25', track: 'collection', name: 'Archive Neon', description: 'Collect 25 unique cards.', requirement: { kind: 'uniqueCards', target: 25 }, rewardIds: ['frame-archive-neon'] },
  { id: 'collection-unique-50', track: 'collection', name: 'Street Archive', description: 'Collect 50 unique cards.', requirement: { kind: 'uniqueCards', target: 50 }, rewardIds: ['lore-codex-street-archive', 'token-cosmetic-reroll'] },
  { id: 'collection-unique-100', track: 'collection', name: 'Century Archive', description: 'Collect 100 unique cards.', requirement: { kind: 'uniqueCards', target: 100 }, rewardIds: ['badge-century-archive', 'frame-seasonal-archive', 'token-cosmetic-reroll'], seasonal: true },
  { id: 'district-all-live', track: 'district', name: 'District Atlas', description: 'Collect at least one card from every live district.', requirement: { kind: 'allDistricts', target: COLLECTION_REWARD_DISTRICTS.length }, rewardIds: ['badge-district-atlas'] },
  { id: 'district-all-sets', track: 'district', name: 'World Map Gallery', description: 'Collect six unique cards in every live district.', requirement: { kind: 'cardsInDistrict', target: 6 }, rewardIds: ['frame-world-map'] },
  { id: 'rarity-first-apprentice', track: 'rarity', name: 'Apprentice Scout', description: 'Collect an Apprentice card.', requirement: { kind: 'firstRarity', rarity: 'Apprentice', target: 1 }, rewardIds: ['badge-apprentice-scout'] },
  { id: 'rarity-first-master', track: 'rarity', name: 'Master Scout', description: 'Collect a Master card.', requirement: { kind: 'firstRarity', rarity: 'Master', target: 1 }, rewardIds: ['badge-master-scout'] },
  { id: 'rarity-first-rare', track: 'rarity', name: 'Rare Scout', description: 'Collect a Rare card.', requirement: { kind: 'firstRarity', rarity: 'Rare', target: 1 }, rewardIds: ['badge-rare-scout'] },
  { id: 'rarity-first-legendary', track: 'rarity', name: 'Legendary Witness', description: 'Collect a Legendary card.', requirement: { kind: 'firstRarity', rarity: 'Legendary', target: 1 }, rewardIds: ['badge-legendary-witness'] },
  { id: 'rarity-legendary-3', track: 'rarity', name: 'Legendary Scout', description: 'Collect three Legendary cards for a title only.', requirement: { kind: 'rarityCount', rarity: 'Legendary', target: 3 }, rewardIds: ['title-legendary-scout'] },
  { id: 'activity-trades-10', track: 'activity', name: 'Market Runner', description: 'Complete ten trades.', requirement: { kind: 'activityCount', activity: 'trades', target: 10 }, rewardIds: ['title-market-runner'] },
  { id: 'activity-missions-10', track: 'activity', name: 'Mission Stringer', description: 'Complete ten missions.', requirement: { kind: 'activityCount', activity: 'missions', target: 10 }, rewardIds: ['badge-mission-stringer', 'token-cosmetic-reroll'] },
  { id: 'activity-battles-10', track: 'activity', name: 'Arena Regular', description: 'Participate in ten battles.', requirement: { kind: 'activityCount', activity: 'battles', target: 10 }, rewardIds: ['badge-arena-regular'] },
  { id: 'activity-streak-7', track: 'activity', name: 'Daily Rituals', description: 'Reach a seven-day login streak.', requirement: { kind: 'activityCount', activity: 'dailyStreak', target: 7 }, rewardIds: ['lore-daily-rituals', 'token-cosmetic-reroll'] },
];

const factionMilestones = COLLECTION_REWARD_FACTIONS.flatMap((faction) => {
  const slug = slugify(faction);
  return [
    { id: `faction-${slug}-3`, track: 'faction', name: `${faction} Badge`, description: `Collect three unique ${faction} cards.`, requirement: { kind: 'cardsInFaction', faction, target: 3 }, rewardIds: [`badge-faction-${slug}`] },
    { id: `faction-${slug}-6`, track: 'faction', name: `${faction} Archivist`, description: `Collect six unique ${faction} cards.`, requirement: { kind: 'cardsInFaction', faction, target: 6 }, rewardIds: [`title-faction-${slug}`] },
    { id: `faction-${slug}-archetypes`, track: 'faction', name: `${faction} Gallery`, description: `Collect every available archetype represented in ${faction}.`, requirement: { kind: 'archetypesInFaction', faction, target: COLLECTION_REWARD_ARCHETYPES.length }, rewardIds: [`frame-faction-${slug}`] },
  ];
});

const districtMilestones = COLLECTION_REWARD_DISTRICTS.map((district) => {
  const slug = slugify(district);
  return { id: `district-${slug}-3`, track: 'district', name: `${district} Runner`, description: `Collect three unique ${district} cards.`, requirement: { kind: 'cardsInDistrict', district, target: 3 }, rewardIds: [`badge-district-${slug}`, `lore-district-${slug}`] };
});

export const COLLECTION_MILESTONES = [
  ...baseMilestones,
  ...factionMilestones,
  ...districtMilestones,
];

export const COLLECTION_REWARD_BY_ID = Object.fromEntries(COLLECTION_REWARD_CATALOG.map((reward) => [reward.id, reward]));

export function normalizeCollectionRewardsState(input) {
  return {
    badgeIds: Array.isArray(input?.badgeIds) ? input.badgeIds.filter((value) => typeof value === 'string') : [],
    titleIds: Array.isArray(input?.titleIds) ? input.titleIds.filter((value) => typeof value === 'string') : [],
    frameIds: Array.isArray(input?.frameIds) ? input.frameIds.filter((value) => typeof value === 'string') : [],
    loreIds: Array.isArray(input?.loreIds) ? input.loreIds.filter((value) => typeof value === 'string') : [],
    rerollTokens: Math.max(0, Math.min(COLLECTION_REROLL_TOKEN_CAP, Number(input?.rerollTokens) || 0)),
    claimedMilestoneIds: Array.isArray(input?.claimedMilestoneIds) ? input.claimedMilestoneIds.filter((value) => typeof value === 'string') : [],
  };
}

export function defaultCollectionActivityStats(input) {
  return {
    missions: Math.max(0, Number(input?.missions) || 0),
    trades: Math.max(0, Number(input?.trades) || 0),
    battles: Math.max(0, Number(input?.battles) || 0),
    dailyStreak: Math.max(0, Number(input?.dailyStreak) || 0),
    eventParticipations: Math.max(0, Number(input?.eventParticipations) || 0),
  };
}

function cardUniqueKey(card) {
  return [
    card.identity?.name?.trim().toLowerCase() || card.id,
    card.identity?.crew || '',
    card.prompts?.district || '',
    card.prompts?.rarity || card.class?.rarity || '',
  ].join('|');
}

function countCardsBy(cards, selector, expected) {
  return new Set(cards.filter((card) => !expected || selector(card) === expected).map(cardUniqueKey)).size;
}

function evaluateCurrent(requirement, cards, activity) {
  switch (requirement.kind) {
    case 'uniqueCards':
      return countCardsBy(cards, () => 'all');
    case 'cardsInFaction':
      return countCardsBy(cards, (card) => card.identity?.crew, requirement.faction);
    case 'archetypesInFaction':
      return new Set(cards.filter((card) => card.identity?.crew === requirement.faction).map((card) => card.prompts?.archetype).filter(Boolean)).size;
    case 'cardsInDistrict': {
      if (requirement.district) return countCardsBy(cards, (card) => card.prompts?.district, requirement.district);
      return Math.min(...COLLECTION_REWARD_DISTRICTS.map((district) => countCardsBy(cards, (card) => card.prompts?.district, district)));
    }
    case 'allDistricts':
      return new Set(cards.map((card) => card.prompts?.district).filter((district) => COLLECTION_REWARD_DISTRICTS.includes(district))).size;
    case 'firstRarity':
    case 'rarityCount':
      return countCardsBy(cards, (card) => card.prompts?.rarity ?? card.class?.rarity, requirement.rarity);
    case 'activityCount':
      return requirement.activity ? activity[requirement.activity] : 0;
    default:
      return 0;
  }
}

export function calculateCollectionScore(cards, state, activityInput) {
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

export function evaluateCollectionRewards(cards, stateInput, activityInput) {
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
      rewards: milestone.rewardIds.map((id) => COLLECTION_REWARD_BY_ID[id]).filter(Boolean),
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

export function applyCollectionMilestoneClaim(stateInput, milestoneId) {
  const state = normalizeCollectionRewardsState(stateInput);
  if (state.claimedMilestoneIds.includes(milestoneId)) {
    return { state, rewards: [], alreadyClaimed: true };
  }

  const milestone = COLLECTION_MILESTONES.find((entry) => entry.id === milestoneId);
  if (!milestone) return { state, rewards: [], alreadyClaimed: false };
  const rewards = milestone.rewardIds.map((id) => COLLECTION_REWARD_BY_ID[id]).filter(Boolean);
  const next = normalizeCollectionRewardsState({ ...state, claimedMilestoneIds: [...state.claimedMilestoneIds, milestoneId] });

  for (const reward of rewards) {
    if (reward.kind === 'badge' && !next.badgeIds.includes(reward.id)) next.badgeIds.push(reward.id);
    if (reward.kind === 'title' && !next.titleIds.includes(reward.id)) next.titleIds.push(reward.id);
    if (reward.kind === 'frame' && !next.frameIds.includes(reward.id)) next.frameIds.push(reward.id);
    if (reward.kind === 'lore' && !next.loreIds.includes(reward.id)) next.loreIds.push(reward.id);
    if (reward.kind === 'reroll_token') {
      next.rerollTokens = Math.min(COLLECTION_REROLL_TOKEN_CAP, next.rerollTokens + Math.max(1, Number(reward.value) || 1));
    }
  }

  return { state: next, rewards, alreadyClaimed: false };
}

export function spendCollectionRerollTokens(stateInput, actionId) {
  const state = normalizeCollectionRewardsState(stateInput);
  const action = COLLECTION_REROLL_ACTION_BY_ID[actionId];
  if (!action) {
    return { state, action: null, spent: false, error: 'Unknown cosmetic reroll action.' };
  }
  if (state.rerollTokens < action.tokenCost) {
    return {
      state,
      action,
      spent: false,
      error: `You need ${action.tokenCost} reroll token${action.tokenCost === 1 ? '' : 's'} for ${action.name.toLowerCase()}.`,
    };
  }

  return {
    state: normalizeCollectionRewardsState({
      ...state,
      rerollTokens: state.rerollTokens - action.tokenCost,
    }),
    action,
    spent: true,
  };
}
