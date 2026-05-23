const CARD_CLASS_PROMOTION_RULES = [
  { rarity: 'Punch Skater™', minXp: 0, minOzzies: 0 },
  { rarity: 'Apprentice', minXp: 120, minOzzies: 90 },
  { rarity: 'Master', minXp: 360, minOzzies: 220 },
  { rarity: 'Rare', minXp: 900, minOzzies: 500 },
];

const CLASS_MULTIPLIERS = {
  'Punch Skater™': 1,
  Apprentice: 1,
  Master: 1.25,
  Rare: 1.5,
  Legendary: 2,
};

function normalizeValue(value) {
  return Math.max(0, Number(value) || 0);
}

function getRepairMinutesForRarity(rarity) {
  switch (rarity) {
    case 'Legendary': return 240;
    case 'Rare': return 90;
    case 'Master': return 45;
    case 'Apprentice':
    case 'Punch Skater™':
    default: return 15;
  }
}

function getFastTrackCreditCost(rarity) {
  switch (rarity) {
    case 'Legendary': return 500;
    case 'Rare': return 250;
    case 'Master': return 100;
    case 'Apprentice': return 40;
    case 'Punch Skater™':
    default: return 25;
  }
}

function getPromotionRarityOrder(rarity) {
  return CARD_CLASS_PROMOTION_RULES.findIndex((rule) => rule.rarity === rarity);
}

export function resolveGameplayCardRarity(card) {
  const currentRarity = String(card?.class?.rarity ?? card?.prompts?.rarity ?? 'Punch Skater™');
  if (currentRarity === 'Legendary') {
    return currentRarity;
  }
  const xp = normalizeValue(card?.xp);
  const ozzies = normalizeValue(card?.ozzies);
  const currentIndex = Math.max(0, getPromotionRarityOrder(currentRarity));
  const earnedRarity = CARD_CLASS_PROMOTION_RULES.reduce((highest, rule) => (
    xp >= rule.minXp && ozzies >= rule.minOzzies ? rule.rarity : highest
  ), 'Punch Skater™');
  const earnedIndex = Math.max(0, getPromotionRarityOrder(earnedRarity));
  return CARD_CLASS_PROMOTION_RULES[Math.max(currentIndex, earnedIndex)]?.rarity ?? currentRarity;
}

export function promoteCardClass(card) {
  const nextRarity = resolveGameplayCardRarity(card);
  const currentRarity = String(card?.class?.rarity ?? card?.prompts?.rarity ?? 'Punch Skater™');
  if (nextRarity === currentRarity) {
    return card;
  }
  return {
    ...card,
    frameSeed: nextRarity,
    prompts: {
      ...(card?.prompts ?? {}),
      rarity: nextRarity,
    },
    class: {
      rarity: nextRarity,
      multiplier: CLASS_MULTIPLIERS[nextRarity] ?? CLASS_MULTIPLIERS['Punch Skater™'],
      badgeLabel: nextRarity,
    },
    maintenance: {
      ...(card?.maintenance ?? {}),
      state: 'active',
      chargePct: 100,
      repairMinutes: getRepairMinutesForRarity(nextRarity),
      fastTrackCreditCost: getFastTrackCreditCost(nextRarity),
    },
  };
}
