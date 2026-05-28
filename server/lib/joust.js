const ALL_TACTICS = ['charge', 'guard', 'feint', 'counter', 'boost', 'trickStrike'];
const FEINT_STEALTH_MIN = 6;
const BOOST_SPEED_MIN = 7;
const SUPPORT_BONUS_DIVISOR = 2;

const TACTICS = {
  charge: {
    id: 'charge',
    label: 'Charge',
    flavor: 'Send it.',
    beats: ['feint'],
    attackBase: 1,
    attackStats: ['speed'],
  },
  guard: {
    id: 'guard',
    label: 'Guard',
    flavor: 'Hold the line, mate.',
    beats: ['charge'],
    defenseBase: 1,
    defenseStats: ['grit'],
  },
  feint: {
    id: 'feint',
    label: 'Feint',
    flavor: 'Dodgy as.',
    beats: ['counter', 'guard'],
    attackStats: ['stealth', 'speed'],
  },
  counter: {
    id: 'counter',
    label: 'Counter',
    flavor: 'Have a crack.',
    beats: ['charge', 'boost'],
    attackStats: ['lance', 'shield'],
    defenseBase: 1,
    defenseStats: ['shield'],
  },
  boost: {
    id: 'boost',
    label: 'Boost',
    flavor: 'Full noise.',
    beats: ['guard'],
    attackStats: ['speed'],
  },
  trickStrike: {
    id: 'trickStrike',
    label: 'Trick Strike',
    flavor: 'Showpony.',
    beats: ['guard', 'boost'],
    attackStats: ['hype', 'lance'],
  },
};

export const JOUST_TACTICS = ALL_TACTICS.map((id) => ({
  id,
  label: TACTICS[id].label,
  flavor: TACTICS[id].flavor,
  beats: [...TACTICS[id].beats],
}));

export const JOUST_DIFFICULTIES = {
  easy: { lanceDelta: -1, shieldDelta: -1, aiPickCount: 3, rewardMultiplier: 0.9 },
  standard: { lanceDelta: 0, shieldDelta: 0, aiPickCount: 2, rewardMultiplier: 1 },
  hard: { lanceDelta: 1, shieldDelta: 1, aiPickCount: 1, rewardMultiplier: 1.2 },
  boss: { lanceDelta: 2, shieldDelta: 2, aiPickCount: 1, rewardMultiplier: 1.5 },
};

function seedFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

function mulberry32(seed) {
  let s = seed | 0;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeededRandom(seed) {
  const rng = mulberry32(seedFromString(String(seed || 'joust-seed')));
  return {
    range(min, max) {
      return Math.floor(rng() * (max - min + 1)) + min;
    },
  };
}

function clampJoustStat(value, fallback = 5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function toMultiplier(value) {
  return Math.round(value * 100) / 100;
}

const BATTERY_STAT_BONUSES = Object.freeze({
  SlimStealth: { stealth: 2 },
  DoubleStack: { grit: 1, range: 1, rangeNm: 1 },
  TopPeli: { range: 2, rangeNm: 2, stealth: 1 },
});

export const JOUST_BOSS_RULES = Object.freeze({
  'batteryville-jax-voltage': {
    id: 'jax-overload-lane',
    bossName: 'Jax Voltage',
    label: 'Overload Lane',
    summary: 'Boost tactics into Jax lose 2 attack as breaker-yard surges short the lane.',
  },
  'airaway-mina-chrome': {
    id: 'mina-compliance-lock',
    bossName: 'Mina Chrome',
    label: 'Compliance Lock',
    summary: 'Mina gains +2 defense while guarding against Charge or Trick Strike lines.',
  },
  'nightshade-rook-wraith': {
    id: 'rook-ghost-route',
    bossName: 'Rook Wraith',
    label: 'Ghost Route',
    summary: "Guard and Counter reads into Rook's Feint lose 1 attack and 2 speed.",
  },
  'grid-vex-static': {
    id: 'vex-signal-jam',
    bossName: 'Vex Static',
    label: 'Signal Jam',
    summary: 'Counter and Boost tactics into Vex lose 2 attack and cannot claim speed tie-breaks.',
  },
  'glass-city-nova-saint': {
    id: 'nova-crowd-drag',
    bossName: 'Nova Saint',
    label: 'Crowd Drag',
    summary: 'Nova passively reduces Urethane wheel speed by 15%.',
  },
  'forest-moss-kade': {
    id: 'moss-off-grid-null',
    bossName: 'Moss Kade',
    label: 'Off-Grid Null',
    summary: 'The Forest final boss disables player battery stat bonuses before tactics resolve.',
  },
});

const BOSS_NAME_TO_KEY = Object.freeze(Object.fromEntries(
  Object.entries(JOUST_BOSS_RULES).map(([key, rule]) => [rule.bossName.toLowerCase(), key]),
));

function getBossRuleKey(rival) {
  const id = typeof rival?.id === 'string' ? rival.id : '';
  if (JOUST_BOSS_RULES[id]) return id;
  const name = typeof rival?.name === 'string' ? rival.name.toLowerCase() : '';
  return BOSS_NAME_TO_KEY[name] ?? null;
}

export function getJoustBossRule(rival) {
  const key = getBossRuleKey(rival);
  return key ? JOUST_BOSS_RULES[key] : null;
}

export function getJoustBossModifiers(rival) {
  const rule = getJoustBossRule(rival);
  return rule ? [{ id: rule.id, label: rule.label, summary: rule.summary }] : [];
}

function getBoardConfigValue(card, key) {
  return card?.board?.config?.[key] ?? card?.board?.components?.[key] ?? card?.boardComponents?.[key] ?? null;
}

function getCardWheels(card) {
  return getBoardConfigValue(card, 'wheels');
}

function getCardBattery(card) {
  return getBoardConfigValue(card, 'battery');
}

function subtractStats(stats, deltas) {
  const next = { ...stats };
  for (const [stat, amount] of Object.entries(deltas ?? {})) {
    next[stat] = clampJoustStat((next[stat] ?? 5) - amount, 5);
  }
  if ('range' in deltas && !('rangeNm' in deltas)) next.rangeNm = next.range;
  return next;
}

function cloneCardWithStats(card, stats) {
  return {
    ...card,
    stats: { ...stats },
    joust: {
      ...card.joust,
      gear: { ...card.joust.gear },
      traits: [...card.joust.traits],
    },
    boardComponents: card.boardComponents ? { ...card.boardComponents } : undefined,
  };
}

function applyBossStatOverrides(player, rival, modifiers) {
  const key = getBossRuleKey(rival);
  if (key !== 'forest-moss-kade') return player;
  const battery = getCardBattery(player);
  const batteryBonuses = BATTERY_STAT_BONUSES[battery];
  if (!batteryBonuses) return player;
  modifiers.push({ source: 'Moss Kade — Off-Grid Null', amount: -Object.values(batteryBonuses).reduce((sum, value) => sum + value, 0), target: 'rule' });
  return cloneCardWithStats(player, subtractStats(player.stats, batteryBonuses));
}

function hasUrethaneWheels(card) {
  return getCardWheels(card) === 'Urethane';
}

function hasSpeedTieBreakSuppression(modifiers) {
  return modifiers.some((modifier) => modifier.target === 'speed' && modifier.source === 'Vex Static — Signal Jam tie-break');
}

function applyBossStrikeOverrides({ player, rival, playerTactic, rivalTactic, playerModifiers, rivalModifiers }) {
  const key = getBossRuleKey(rival);
  const overrides = { attackDelta: 0, defenseDelta: 0, playerSpeedMultiplier: 1 };
  switch (key) {
    case 'batteryville-jax-voltage':
      if (playerTactic === 'boost') {
        overrides.attackDelta -= 2;
        playerModifiers.push({ source: 'Jax Voltage — Overload Lane', amount: -2, target: 'attack' });
      }
      break;
    case 'airaway-mina-chrome':
      if (rivalTactic === 'guard' && (playerTactic === 'charge' || playerTactic === 'trickStrike')) {
        overrides.defenseDelta += 2;
        rivalModifiers.push({ source: 'Mina Chrome — Compliance Lock', amount: 2, target: 'defense' });
      }
      break;
    case 'nightshade-rook-wraith':
      if (rivalTactic === 'feint' && (playerTactic === 'guard' || playerTactic === 'counter')) {
        overrides.attackDelta -= 1;
        playerModifiers.push({ source: 'Rook Wraith — Ghost Route', amount: -1, target: 'attack' });
        playerModifiers.push({ source: 'Rook Wraith — Ghost Route', amount: -2, target: 'speed' });
      }
      break;
    case 'grid-vex-static':
      if (playerTactic === 'counter' || playerTactic === 'boost') {
        overrides.attackDelta -= 2;
        playerModifiers.push({ source: 'Vex Static — Signal Jam', amount: -2, target: 'attack' });
        playerModifiers.push({ source: 'Vex Static — Signal Jam tie-break', amount: -1, target: 'speed' });
      }
      break;
    case 'glass-city-nova-saint':
      if (hasUrethaneWheels(player)) {
        overrides.playerSpeedMultiplier = 0.85;
        playerModifiers.push({ source: 'Nova Saint — Crowd Drag', amount: -15, target: 'speed' });
      }
      break;
    default:
      break;
  }
  return overrides;
}

function hasCardPayloadShape(card) {
  return Boolean(card && typeof card === 'object' && card.prompts && card.board && card.stats);
}

function normalizeJoustProfile(card, stats) {
  const raw = card?.joust ?? null;
  return {
    lance: clampJoustStat(raw?.lance ?? (stats.speed + stats.grit) / 2),
    shield: clampJoustStat(raw?.shield ?? (stats.grit + stats.stealth) / 2),
    hype: clampJoustStat(raw?.hype ?? (stats.speed + stats.stealth + stats.range) / 3),
    gear: {
      boardType: typeof raw?.gear?.boardType === 'string' ? raw.gear.boardType : 'Street',
      lanceType: typeof raw?.gear?.lanceType === 'string' ? raw.gear.lanceType : 'kinetic',
      shieldType: typeof raw?.gear?.shieldType === 'string' ? raw.gear.shieldType : 'riot',
      armorTag: typeof raw?.gear?.armorTag === 'string' ? raw.gear.armorTag : 'street shell',
    },
    traits: Array.isArray(raw?.traits)
      ? raw.traits.filter((trait) => typeof trait === 'string' && trait.trim().length > 0).slice(0, 4)
      : [],
  };
}

export function createJoustCardSnapshot(card) {
  const rawStats = card?.stats ?? null;
  const stats = {
    speed: clampJoustStat(rawStats?.speed, 5),
    range: clampJoustStat(rawStats?.range, 5),
    rangeNm: clampJoustStat(rawStats?.rangeNm ?? rawStats?.range, 5),
    stealth: clampJoustStat(rawStats?.stealth, 5),
    grit: clampJoustStat(rawStats?.grit, 5),
  };
  const joust = normalizeJoustProfile(card, stats);
  return {
    id: typeof card?.id === 'string' ? card.id : 'unknown-joust-card',
    name: hasCardPayloadShape(card)
      ? card.identity?.name ?? card.id ?? 'Unknown rider'
      : typeof card?.name === 'string'
        ? card.name
        : typeof card?.id === 'string'
          ? card.id
          : 'Unknown rider',
    archetype: hasCardPayloadShape(card) ? card.prompts?.archetype : card?.archetype,
    crew: hasCardPayloadShape(card) ? card.identity?.crew : card?.crew,
    district: hasCardPayloadShape(card) ? card.prompts?.district : card?.district,
    stats,
    joust,
    ...(card?.board?.components || card?.board?.config
      ? {
        boardComponents: {
          ...(card.board.config ?? {}),
          ...(card.board.components ?? {}),
        },
      }
      : card?.boardComponents
        ? { boardComponents: { ...card.boardComponents } }
        : {}),
  };
}

function getStatValue(card, stat) {
  switch (stat) {
    case 'speed':
    case 'range':
    case 'rangeNm':
    case 'stealth':
    case 'grit':
      return card.stats[stat];
    case 'lance':
    case 'shield':
    case 'hype':
      return card.joust[stat];
    default:
      return 5;
  }
}

function buildSupportBonus(card, stats) {
  if (!stats?.length) return 0;
  const average = stats.reduce((sum, stat) => sum + getStatValue(card, stat), 0) / stats.length;
  return Math.max(-2, Math.min(2, Math.round((average - 5) / SUPPORT_BONUS_DIVISOR)));
}

function pushModifier(modifiers, target, source, amount) {
  if (!amount) return;
  modifiers.push({ source, amount, target });
}

function applyTraitModifiers(card, tactic, modifiers) {
  let attack = 0;
  let defense = 0;
  let speed = 0;

  for (const trait of card.joust.traits) {
    switch (trait) {
      case 'Boost Charge':
        if (tactic === 'boost') {
          attack += 1;
          pushModifier(modifiers, 'attack', trait, 1);
        }
        break;
      case 'Street Parry':
        if (tactic === 'counter') {
          defense += 1;
          pushModifier(modifiers, 'defense', trait, 1);
        }
        break;
      case 'Magnetic Guard':
        if (tactic === 'guard') {
          defense += 2;
          pushModifier(modifiers, 'defense', trait, 2);
        }
        break;
      case 'Heavy Lance':
        if (tactic === 'charge') {
          attack += 2;
          pushModifier(modifiers, 'attack', trait, 2);
        }
        speed -= 1;
        pushModifier(modifiers, 'speed', `${trait} drag`, -1);
        break;
      case 'Riot Shield':
        if (tactic === 'guard') {
          defense += 1;
          pushModifier(modifiers, 'defense', trait, 1);
        }
        break;
      case 'Neon Flourish':
        if (tactic === 'trickStrike') {
          attack += 1;
          pushModifier(modifiers, 'attack', trait, 1);
        }
        break;
      default:
        break;
    }
  }

  return { attack, defense, speed };
}

function getAvailableTactics(card) {
  return ALL_TACTICS.filter((tactic) => {
    if (tactic === 'feint') return card.stats.stealth >= FEINT_STEALTH_MIN;
    if (tactic === 'boost') return card.stats.speed >= BOOST_SPEED_MIN;
    return true;
  });
}

export function getAvailableJoustTactics(card) {
  return getAvailableTactics(createJoustCardSnapshot(card));
}

function normalizeSelectedTactic(card, tactic) {
  const available = getAvailableTactics(card);
  return available.includes(tactic) ? tactic : available[0];
}

function applyDifficulty(card, difficulty) {
  const config = JOUST_DIFFICULTIES[difficulty];
  return {
    ...card,
    stats: { ...card.stats },
    joust: {
      ...card.joust,
      lance: clampJoustStat(card.joust.lance + config.lanceDelta),
      shield: clampJoustStat(card.joust.shield + config.shieldDelta),
      gear: { ...card.joust.gear },
      traits: [...card.joust.traits],
    },
  };
}

function getTacticAdvantage(playerTactic, rivalTactic) {
  if (TACTICS[playerTactic].beats.includes(rivalTactic)) return 2;
  if (TACTICS[rivalTactic].beats.includes(playerTactic)) return -2;
  return 0;
}

function buildPressure(card, tactic, modifiers) {
  const config = TACTICS[tactic];
  const attackBase = config.attackBase ?? 0;
  const support = buildSupportBonus(card, config.attackStats);
  pushModifier(modifiers, 'attack', `${config.label} lane`, attackBase);
  pushModifier(modifiers, 'attack', `${config.label} support`, support);
  const traitBonus = applyTraitModifiers(card, tactic, modifiers);
  return {
    attack: card.joust.lance + attackBase + support + traitBonus.attack,
    speedDelta: traitBonus.speed,
  };
}

function buildGuard(card, tactic, modifiers) {
  const config = TACTICS[tactic];
  const defenseBase = config.defenseBase ?? 0;
  const support = buildSupportBonus(card, config.defenseStats);
  pushModifier(modifiers, 'defense', `${config.label} shell`, defenseBase);
  pushModifier(modifiers, 'defense', `${config.label} support`, support);
  const traitBonus = applyTraitModifiers(card, tactic, modifiers);
  return {
    defense: card.joust.shield + defenseBase + support + traitBonus.defense,
    speedDelta: traitBonus.speed,
  };
}

function predictStrike(player, rival, playerTactic, rivalTactic, randomRoll) {
  const playerModifiers = [];
  const rivalModifiers = [];
  const playerForRules = applyBossStatOverrides(player, rival, playerModifiers);
  const attack = buildPressure(playerForRules, playerTactic, playerModifiers);
  const defense = buildGuard(rival, rivalTactic, rivalModifiers);
  const boss = applyBossStrikeOverrides({
    player: playerForRules,
    rival,
    playerTactic,
    rivalTactic,
    playerModifiers,
    rivalModifiers,
  });
  const advantage = getTacticAdvantage(playerTactic, rivalTactic);
  const playerSpeed = (playerForRules.stats.speed + attack.speedDelta) * boss.playerSpeedMultiplier;
  const rivalSpeed = rival.stats.speed + defense.speedDelta;
  const speedTieBreak = playerSpeed > rivalSpeed && !hasSpeedTieBreakSuppression(playerModifiers) ? 1 : 0;
  const finalAttack = attack.attack + boss.attackDelta;
  const finalDefense = defense.defense + boss.defenseDelta;
  const strike = finalAttack - finalDefense + advantage + speedTieBreak + randomRoll;
  return {
    attack: finalAttack,
    defense: finalDefense,
    advantage,
    speedTieBreak,
    strike,
    playerModifiers,
    rivalModifiers,
    player: playerForRules,
  };
}

export function selectDefaultJoustRider(cards) {
  if (!cards?.length) return null;
  return cards
    .map((card) => createJoustCardSnapshot(card))
    .sort((left, right) => (
      right.joust.lance - left.joust.lance
      || right.stats.speed - left.stats.speed
      || right.joust.hype - left.joust.hype
      || left.id.localeCompare(right.id)
    ))[0];
}

function resolveRivalJoustTacticForSnapshots(player, rival, playerTactic, seed, difficulty) {
  const resolvedPlayerTactic = normalizeSelectedTactic(player, playerTactic);
  const available = getAvailableTactics(rival);
  const ranked = available
    .map((tactic) => ({
      tactic,
      strike: predictStrike(player, rival, resolvedPlayerTactic, tactic, 0).strike,
    }))
    .sort((left, right) => left.strike - right.strike || ALL_TACTICS.indexOf(left.tactic) - ALL_TACTICS.indexOf(right.tactic));
  const shortlist = ranked.slice(0, Math.max(1, Math.min(JOUST_DIFFICULTIES[difficulty].aiPickCount, ranked.length)));
  const rng = createSeededRandom(`${seed}::rival-tactic`);
  return shortlist[rng.range(0, shortlist.length - 1)].tactic;
}

export function resolveRivalJoustTactic(playerCard, rivalCard, playerTactic, seed, difficulty = 'standard') {
  const player = createJoustCardSnapshot(playerCard);
  const rival = applyDifficulty(createJoustCardSnapshot(rivalCard), difficulty);
  return resolveRivalJoustTacticForSnapshots(player, rival, playerTactic, seed, difficulty);
}

function buildNarration({ outcome, strike, player, rival }) {
  if (outcome === 'draw') {
    return `Knife-edge pass — ${player.name} and ${rival.name} split the lane clean down the middle.`;
  }
  if (outcome === 'win') {
    return strike >= 4
      ? `Clean read — ${player.name} sent it and cracked ${rival.name}'s line.`
      : `${player.name} nicked the pass by a wheel and kept the crowd humming.`;
  }
  return strike <= -4
    ? `${rival.name} read it cold and shut the lane down hard.`
    : `${rival.name} pinched the exchange at the last second.`;
}

export function resolveJoust(
  playerCard,
  rivalCard,
  {
    playerTactic,
    difficulty = 'standard',
    rivalTactic,
    seed = 'joust-seed',
  },
) {
  const player = createJoustCardSnapshot(playerCard);
  const rival = applyDifficulty(createJoustCardSnapshot(rivalCard), difficulty);
  const resolvedPlayerTactic = normalizeSelectedTactic(player, playerTactic);
  const resolvedRivalTactic = rivalTactic
    ? normalizeSelectedTactic(rival, rivalTactic)
    : resolveRivalJoustTacticForSnapshots(player, rival, resolvedPlayerTactic, seed, difficulty);
  const rng = createSeededRandom(`${seed}::strike`);
  const randomRoll = rng.range(-1, 1);
  const breakdown = predictStrike(player, rival, resolvedPlayerTactic, resolvedRivalTactic, randomRoll);
  const outcome = breakdown.strike > 0 ? 'win' : breakdown.strike < 0 ? 'loss' : 'draw';
  return {
    seed,
    difficulty,
    player: breakdown.player,
    rival,
    playerTactic: resolvedPlayerTactic,
    rivalTactic: resolvedRivalTactic,
    strike: breakdown.strike,
    outcome,
    narration: buildNarration({ outcome, strike: breakdown.strike, player, rival }),
    breakdown: {
      attack: breakdown.attack,
      defense: breakdown.defense,
      advantage: breakdown.advantage,
      speedTieBreak: breakdown.speedTieBreak,
      randomRoll,
      strike: breakdown.strike,
      playerModifiers: breakdown.playerModifiers,
      rivalModifiers: breakdown.rivalModifiers,
    },
    rewardHints: {
      styleMultiplier: toMultiplier(1 + Math.max(0, player.joust.hype - 5) * 0.05),
      difficultyMultiplier: JOUST_DIFFICULTIES[difficulty].rewardMultiplier,
    },
  };
}
