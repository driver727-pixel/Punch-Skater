import { createSeededRandom } from "./prng";
import { normalizeJoustProfile } from "./jousting";
import type {
  BossModifierSummary,
  CardPayload,
  ForgedBoardComponents,
  ForgedCardStats,
  JoustCardProfile,
  JoustCardSnapshot,
  JoustDifficulty,
  JoustModifierBreakdown,
  JoustResolution,
  JoustTactic,
  JoustTacticProfile,
} from "./types";

type SnapshotInput = CardPayload | Partial<JoustCardSnapshot> | null | undefined;
type SupportedStat = keyof ForgedCardStats | keyof Pick<JoustCardProfile, "lance" | "shield" | "hype">;

interface TacticConfig extends JoustTacticProfile {
  attackBase?: number;
  defenseBase?: number;
  attackStats?: SupportedStat[];
  defenseStats?: SupportedStat[];
}

interface DifficultyConfig {
  lanceDelta: number;
  shieldDelta: number;
  aiPickCount: number;
  rewardMultiplier: number;
}

const ALL_TACTICS: JoustTactic[] = ["charge", "guard", "feint", "counter", "boost", "trickStrike"];
const FEINT_STEALTH_MIN = 6;
const BOOST_SPEED_MIN = 7;
const SUPPORT_BONUS_DIVISOR = 2;

const TACTICS: Record<JoustTactic, TacticConfig> = {
  charge: {
    id: "charge",
    label: "Charge",
    flavor: "Send it.",
    beats: ["feint"],
    attackBase: 1,
    attackStats: ["speed"],
  },
  guard: {
    id: "guard",
    label: "Guard",
    flavor: "Hold the line, mate.",
    beats: ["charge"],
    defenseBase: 1,
    defenseStats: ["grit"],
  },
  feint: {
    id: "feint",
    label: "Feint",
    flavor: "Dodgy as.",
    beats: ["counter", "guard"],
    attackStats: ["stealth", "speed"],
  },
  counter: {
    id: "counter",
    label: "Counter",
    flavor: "Have a crack.",
    beats: ["charge", "boost"],
    attackStats: ["lance", "shield"],
    defenseBase: 1,
    defenseStats: ["shield"],
  },
  boost: {
    id: "boost",
    label: "Boost",
    flavor: "Full noise.",
    beats: ["guard"],
    attackStats: ["speed"],
  },
  trickStrike: {
    id: "trickStrike",
    label: "Trick Strike",
    flavor: "Showpony.",
    beats: ["guard", "boost"],
    attackStats: ["hype", "lance"],
  },
};

export const JOUST_TACTICS: JoustTacticProfile[] = ALL_TACTICS.map((id) => ({
  id,
  label: TACTICS[id].label,
  flavor: TACTICS[id].flavor,
  beats: [...TACTICS[id].beats],
}));

export const JOUST_DIFFICULTIES: Record<JoustDifficulty, DifficultyConfig> = {
  easy: { lanceDelta: -1, shieldDelta: -1, aiPickCount: 3, rewardMultiplier: 0.9 },
  standard: { lanceDelta: 0, shieldDelta: 0, aiPickCount: 2, rewardMultiplier: 1 },
  hard: { lanceDelta: 1, shieldDelta: 1, aiPickCount: 1, rewardMultiplier: 1.2 },
  boss: { lanceDelta: 2, shieldDelta: 2, aiPickCount: 1, rewardMultiplier: 1.5 },
};

function clampJoustStat(value: unknown, fallback = 5): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function toMultiplier(value: number): number {
  return Math.round(value * 100) / 100;
}

const BATTERY_STAT_BONUSES: Record<string, Partial<ForgedCardStats>> = {
  SlimStealth: { stealth: 2 },
  DoubleStack: { grit: 1, range: 1, rangeNm: 1 },
  TopPeli: { range: 2, rangeNm: 2, stealth: 1 },
};

interface JoustBossRule extends BossModifierSummary {
  bossName: string;
}

export const JOUST_BOSS_RULES: Record<string, JoustBossRule> = {
  "batteryville-jax-voltage": {
    id: "jax-overload-lane",
    bossName: "Jax Voltage",
    label: "Overload Lane",
    summary: "Boost tactics into Jax lose 2 attack as breaker-yard surges short the lane.",
  },
  "airaway-mina-chrome": {
    id: "mina-compliance-lock",
    bossName: "Mina Chrome",
    label: "Compliance Lock",
    summary: "Mina gains +2 defense while guarding against Charge or Trick Strike lines.",
  },
  "nightshade-rook-wraith": {
    id: "rook-ghost-route",
    bossName: "Rook Wraith",
    label: "Ghost Route",
    summary: "Guard and Counter reads into Rook's Feint lose 1 attack and 2 speed.",
  },
  "grid-vex-static": {
    id: "vex-signal-jam",
    bossName: "Vex Static",
    label: "Signal Jam",
    summary: "Counter and Boost tactics into Vex lose 2 attack and cannot claim speed tie-breaks.",
  },
  "glass-city-nova-saint": {
    id: "nova-crowd-drag",
    bossName: "Nova Saint",
    label: "Crowd Drag",
    summary: "Nova passively reduces Urethane wheel speed by 15%.",
  },
  "forest-moss-kade": {
    id: "moss-off-grid-null",
    bossName: "Moss Kade",
    label: "Off-Grid Null",
    summary: "The Forest final boss disables player battery stat bonuses before tactics resolve.",
  },
};

const BOSS_NAME_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(JOUST_BOSS_RULES).map(([key, rule]) => [rule.bossName.toLowerCase(), key]),
);

function getBossRuleKey(rival: Partial<JoustCardSnapshot> | null | undefined): string | null {
  if (typeof rival?.id === "string" && JOUST_BOSS_RULES[rival.id]) return rival.id;
  const name = typeof rival?.name === "string" ? rival.name.toLowerCase() : "";
  return BOSS_NAME_TO_KEY[name] ?? null;
}

export function getJoustBossRule(rival: Partial<JoustCardSnapshot> | null | undefined): JoustBossRule | null {
  const key = getBossRuleKey(rival);
  return key ? JOUST_BOSS_RULES[key] : null;
}

export function getJoustBossModifiers(rival: Partial<JoustCardSnapshot> | null | undefined): BossModifierSummary[] {
  const rule = getJoustBossRule(rival);
  return rule ? [{ id: rule.id, label: rule.label, summary: rule.summary }] : [];
}

function getBoardConfigValue(card: SnapshotInput | JoustCardSnapshot, key: keyof ForgedBoardComponents): string | null {
  if (!card || typeof card !== "object") return null;
  if ("board" in card) {
    return card.board?.config?.[key] ?? card.board?.components?.[key] ?? null;
  }
  return card.boardComponents?.[key] ?? null;
}

function getCardWheels(card: SnapshotInput | JoustCardSnapshot): string | null {
  return getBoardConfigValue(card, "wheels");
}

function getCardBattery(card: SnapshotInput | JoustCardSnapshot): string | null {
  return getBoardConfigValue(card, "battery");
}

function subtractStats(stats: ForgedCardStats, deltas: Partial<ForgedCardStats>): ForgedCardStats {
  const next = { ...stats };
  for (const [stat, amount] of Object.entries(deltas)) {
    const key = stat as keyof ForgedCardStats;
    next[key] = clampJoustStat((next[key] ?? 5) - (amount ?? 0), 5);
  }
  if ("range" in deltas && !("rangeNm" in deltas)) next.rangeNm = next.range;
  return next;
}

function cloneCardWithStats(card: JoustCardSnapshot, stats: ForgedCardStats): JoustCardSnapshot {
  return {
    ...card,
    stats: { ...stats },
    joust: { ...card.joust, gear: { ...card.joust.gear }, traits: [...card.joust.traits] },
    ...(card.boardComponents ? { boardComponents: { ...card.boardComponents } } : {}),
  };
}

function applyBossStatOverrides(
  player: JoustCardSnapshot,
  rival: JoustCardSnapshot,
  modifiers: JoustModifierBreakdown[],
): JoustCardSnapshot {
  const key = getBossRuleKey(rival);
  if (key !== "forest-moss-kade") return player;
  const battery = getCardBattery(player);
  const batteryBonuses = battery ? BATTERY_STAT_BONUSES[battery] : null;
  if (!batteryBonuses) return player;
  modifiers.push({
    source: "Moss Kade — Off-Grid Null",
    amount: -Object.values(batteryBonuses).reduce((sum, value) => sum + (value ?? 0), 0),
    target: "rule",
  });
  return cloneCardWithStats(player, subtractStats(player.stats, batteryBonuses));
}

function hasUrethaneWheels(card: SnapshotInput | JoustCardSnapshot): boolean {
  return getCardWheels(card) === "Urethane";
}

function hasSpeedTieBreakSuppression(modifiers: JoustModifierBreakdown[]): boolean {
  return modifiers.some((modifier) => modifier.target === "speed" && modifier.source === "Vex Static — Signal Jam tie-break");
}

function applyBossStrikeOverrides({
  player,
  rival,
  playerTactic,
  rivalTactic,
  playerModifiers,
  rivalModifiers,
}: {
  player: JoustCardSnapshot;
  rival: JoustCardSnapshot;
  playerTactic: JoustTactic;
  rivalTactic: JoustTactic;
  playerModifiers: JoustModifierBreakdown[];
  rivalModifiers: JoustModifierBreakdown[];
}): { attackDelta: number; defenseDelta: number; playerSpeedMultiplier: number } {
  const key = getBossRuleKey(rival);
  const overrides = { attackDelta: 0, defenseDelta: 0, playerSpeedMultiplier: 1 };
  switch (key) {
    case "batteryville-jax-voltage":
      if (playerTactic === "boost") {
        overrides.attackDelta -= 2;
        playerModifiers.push({ source: "Jax Voltage — Overload Lane", amount: -2, target: "attack" });
      }
      break;
    case "airaway-mina-chrome":
      if (rivalTactic === "guard" && (playerTactic === "charge" || playerTactic === "trickStrike")) {
        overrides.defenseDelta += 2;
        rivalModifiers.push({ source: "Mina Chrome — Compliance Lock", amount: 2, target: "defense" });
      }
      break;
    case "nightshade-rook-wraith":
      if (rivalTactic === "feint" && (playerTactic === "guard" || playerTactic === "counter")) {
        overrides.attackDelta -= 1;
        playerModifiers.push({ source: "Rook Wraith — Ghost Route", amount: -1, target: "attack" });
        playerModifiers.push({ source: "Rook Wraith — Ghost Route", amount: -2, target: "speed" });
      }
      break;
    case "grid-vex-static":
      if (playerTactic === "counter" || playerTactic === "boost") {
        overrides.attackDelta -= 2;
        playerModifiers.push({ source: "Vex Static — Signal Jam", amount: -2, target: "attack" });
        playerModifiers.push({ source: "Vex Static — Signal Jam tie-break", amount: -1, target: "speed" });
      }
      break;
    case "glass-city-nova-saint":
      if (hasUrethaneWheels(player)) {
        overrides.playerSpeedMultiplier = 0.85;
        playerModifiers.push({ source: "Nova Saint — Crowd Drag", amount: -15, target: "speed" });
      }
      break;
    default:
      break;
  }
  return overrides;
}

function hasCardPayloadShape(value: SnapshotInput): value is CardPayload {
  return Boolean(value && typeof value === "object" && "prompts" in value && "board" in value && "stats" in value);
}

function getFallbackJoustProfile(card: SnapshotInput, stats: ForgedCardStats): JoustCardProfile {
  const raw = card && typeof card === "object" && "joust" in card ? card.joust : null;
  return {
    lance: clampJoustStat(raw?.lance ?? (stats.speed + stats.grit) / 2),
    shield: clampJoustStat(raw?.shield ?? (stats.grit + stats.stealth) / 2),
    hype: clampJoustStat(raw?.hype ?? (stats.speed + stats.stealth + stats.range) / 3),
    gear: {
      boardType: typeof raw?.gear?.boardType === "string" ? raw.gear.boardType : "Street",
      lanceType: typeof raw?.gear?.lanceType === "string" ? raw.gear.lanceType : "kinetic",
      shieldType: typeof raw?.gear?.shieldType === "string" ? raw.gear.shieldType : "riot",
      armorTag: typeof raw?.gear?.armorTag === "string" ? raw.gear.armorTag : "street shell",
    },
    traits: Array.isArray(raw?.traits)
      ? raw.traits.filter((trait): trait is string => typeof trait === "string" && trait.trim().length > 0).slice(0, 4)
      : [],
  };
}

export function createJoustCardSnapshot(card: SnapshotInput): JoustCardSnapshot {
  const rawStats = card && typeof card === "object" && "stats" in card ? card.stats : null;
  const stats: ForgedCardStats = {
    speed: clampJoustStat(rawStats?.speed, 5),
    range: clampJoustStat(rawStats?.range, 5),
    rangeNm: clampJoustStat(rawStats?.rangeNm ?? rawStats?.range, 5),
    stealth: clampJoustStat(rawStats?.stealth, 5),
    grit: clampJoustStat(rawStats?.grit, 5),
  };
  const joust = hasCardPayloadShape(card) ? normalizeJoustProfile(card) : getFallbackJoustProfile(card, stats);
  return {
    id: typeof card?.id === "string" ? card.id : "unknown-joust-card",
    name: hasCardPayloadShape(card)
      ? card.identity.name
      : typeof card?.name === "string"
        ? card.name
        : typeof card?.id === "string"
          ? card.id
          : "Unknown rider",
    archetype: hasCardPayloadShape(card) ? card.prompts.archetype : card?.archetype,
    crew: hasCardPayloadShape(card) ? card.identity.crew : card?.crew,
    district: hasCardPayloadShape(card) ? card.prompts.district : card?.district,
    stats,
    joust,
    ...(hasCardPayloadShape(card)
      ? { boardComponents: { ...card.board.config, ...card.board.components } }
      : card?.boardComponents
        ? { boardComponents: { ...card.boardComponents } }
        : {}),
  };
}

function getStatValue(card: JoustCardSnapshot, stat: SupportedStat): number {
  switch (stat) {
    case "speed":
    case "range":
    case "rangeNm":
    case "stealth":
    case "grit":
      return card.stats[stat];
    case "lance":
    case "shield":
    case "hype":
      return card.joust[stat];
    default:
      return 5;
  }
}

function buildSupportBonus(card: JoustCardSnapshot, stats: SupportedStat[] | undefined): number {
  if (!stats || stats.length === 0) return 0;
  const average = stats.reduce((sum, stat) => sum + getStatValue(card, stat), 0) / stats.length;
  return Math.max(-2, Math.min(2, Math.round((average - 5) / SUPPORT_BONUS_DIVISOR)));
}

function pushModifier(
  modifiers: JoustModifierBreakdown[],
  target: JoustModifierBreakdown["target"],
  source: string,
  amount: number,
): void {
  if (!amount) return;
  modifiers.push({ source, amount, target });
}

function applyTraitModifiers(
  card: JoustCardSnapshot,
  tactic: JoustTactic,
  modifiers: JoustModifierBreakdown[],
): { attack: number; defense: number; speed: number } {
  let attack = 0;
  let defense = 0;
  let speed = 0;

  for (const trait of card.joust.traits) {
    switch (trait) {
      case "Boost Charge":
        if (tactic === "boost") {
          attack += 1;
          pushModifier(modifiers, "attack", trait, 1);
        }
        break;
      case "Street Parry":
        if (tactic === "counter") {
          defense += 1;
          pushModifier(modifiers, "defense", trait, 1);
        }
        break;
      case "Magnetic Guard":
        if (tactic === "guard") {
          defense += 2;
          pushModifier(modifiers, "defense", trait, 2);
        }
        break;
      case "Heavy Lance":
        if (tactic === "charge") {
          attack += 2;
          pushModifier(modifiers, "attack", trait, 2);
        }
        speed -= 1;
        pushModifier(modifiers, "speed", `${trait} drag`, -1);
        break;
      case "Riot Shield":
        if (tactic === "guard") {
          defense += 1;
          pushModifier(modifiers, "defense", trait, 1);
        }
        break;
      case "Neon Flourish":
        if (tactic === "trickStrike") {
          attack += 1;
          pushModifier(modifiers, "attack", trait, 1);
        }
        break;
      default:
        break;
    }
  }

  return { attack, defense, speed };
}

function getAvailableTactics(card: JoustCardSnapshot): JoustTactic[] {
  return ALL_TACTICS.filter((tactic) => {
    if (tactic === "feint") return card.stats.stealth >= FEINT_STEALTH_MIN;
    if (tactic === "boost") return card.stats.speed >= BOOST_SPEED_MIN;
    return true;
  });
}

export function getAvailableJoustTactics(card: SnapshotInput): JoustTactic[] {
  return getAvailableTactics(createJoustCardSnapshot(card));
}

function normalizeSelectedTactic(card: JoustCardSnapshot, tactic: JoustTactic): JoustTactic {
  const available = getAvailableTactics(card);
  return available.includes(tactic) ? tactic : available[0];
}

function applyDifficulty(card: JoustCardSnapshot, difficulty: JoustDifficulty): JoustCardSnapshot {
  const config = JOUST_DIFFICULTIES[difficulty];
  return {
    ...card,
    joust: {
      ...card.joust,
      lance: clampJoustStat(card.joust.lance + config.lanceDelta),
      shield: clampJoustStat(card.joust.shield + config.shieldDelta),
      gear: { ...card.joust.gear },
      traits: [...card.joust.traits],
    },
    stats: { ...card.stats },
  };
}

function getTacticAdvantage(playerTactic: JoustTactic, rivalTactic: JoustTactic): number {
  if (TACTICS[playerTactic].beats.includes(rivalTactic)) return 2;
  if (TACTICS[rivalTactic].beats.includes(playerTactic)) return -2;
  return 0;
}

function buildPressure(
  card: JoustCardSnapshot,
  tactic: JoustTactic,
  modifiers: JoustModifierBreakdown[],
): { attack: number; speedDelta: number } {
  const config = TACTICS[tactic];
  const attackBase = config.attackBase ?? 0;
  const support = buildSupportBonus(card, config.attackStats);
  pushModifier(modifiers, "attack", `${config.label} lane`, attackBase);
  pushModifier(modifiers, "attack", `${config.label} support`, support);
  const traitBonus = applyTraitModifiers(card, tactic, modifiers);
  return {
    attack: card.joust.lance + attackBase + support + traitBonus.attack,
    speedDelta: traitBonus.speed,
  };
}

function buildGuard(
  card: JoustCardSnapshot,
  tactic: JoustTactic,
  modifiers: JoustModifierBreakdown[],
): { defense: number; speedDelta: number } {
  const config = TACTICS[tactic];
  const defenseBase = config.defenseBase ?? 0;
  const support = buildSupportBonus(card, config.defenseStats);
  pushModifier(modifiers, "defense", `${config.label} shell`, defenseBase);
  pushModifier(modifiers, "defense", `${config.label} support`, support);
  const traitBonus = applyTraitModifiers(card, tactic, modifiers);
  return {
    defense: card.joust.shield + defenseBase + support + traitBonus.defense,
    speedDelta: traitBonus.speed,
  };
}

function predictStrike(
  player: JoustCardSnapshot,
  rival: JoustCardSnapshot,
  playerTactic: JoustTactic,
  rivalTactic: JoustTactic,
  randomRoll: number,
) {
  const playerModifiers: JoustModifierBreakdown[] = [];
  const rivalModifiers: JoustModifierBreakdown[] = [];
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

export function selectDefaultJoustRider(cards: readonly SnapshotInput[]): JoustCardSnapshot | null {
  if (cards.length === 0) return null;
  return cards
    .map((card) => createJoustCardSnapshot(card))
    .sort((left, right) => (
      right.joust.lance - left.joust.lance
      || right.stats.speed - left.stats.speed
      || right.joust.hype - left.joust.hype
      || left.id.localeCompare(right.id)
    ))[0];
}

function resolveRivalJoustTacticForSnapshots(
  player: JoustCardSnapshot,
  rival: JoustCardSnapshot,
  playerTactic: JoustTactic,
  seed: string,
  difficulty: JoustDifficulty,
): JoustTactic {
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

export function resolveRivalJoustTactic(
  playerCard: SnapshotInput,
  rivalCard: SnapshotInput,
  playerTactic: JoustTactic,
  seed: string,
  difficulty: JoustDifficulty = "standard",
): JoustTactic {
  const player = createJoustCardSnapshot(playerCard);
  const rival = applyDifficulty(createJoustCardSnapshot(rivalCard), difficulty);
  return resolveRivalJoustTacticForSnapshots(player, rival, playerTactic, seed, difficulty);
}

function buildNarration(result: {
  outcome: JoustResolution["outcome"];
  strike: number;
  player: JoustCardSnapshot;
  rival: JoustCardSnapshot;
}): string {
  const { outcome, strike, player, rival } = result;
  if (outcome === "draw") {
    return `Knife-edge pass — ${player.name} and ${rival.name} split the lane clean down the middle.`;
  }
  if (outcome === "win") {
    return strike >= 4
      ? `Clean read — ${player.name} sent it and cracked ${rival.name}'s line.`
      : `${player.name} nicked the pass by a wheel and kept the crowd humming.`;
  }
  return strike <= -4
    ? `${rival.name} read it cold and shut the lane down hard.`
    : `${rival.name} pinched the exchange at the last second.`;
}

export function resolveJoust(
  playerCard: SnapshotInput,
  rivalCard: SnapshotInput,
  {
    playerTactic,
    difficulty = "standard",
    rivalTactic,
    seed = "joust-seed",
  }: {
    playerTactic: JoustTactic;
    difficulty?: JoustDifficulty;
    rivalTactic?: JoustTactic;
    seed?: string;
  },
): JoustResolution {
  const player = createJoustCardSnapshot(playerCard);
  const rival = applyDifficulty(createJoustCardSnapshot(rivalCard), difficulty);
  const resolvedPlayerTactic = normalizeSelectedTactic(player, playerTactic);
  const resolvedRivalTactic = rivalTactic
    ? normalizeSelectedTactic(rival, rivalTactic)
    : resolveRivalJoustTacticForSnapshots(player, rival, resolvedPlayerTactic, seed, difficulty);
  const rng = createSeededRandom(`${seed}::strike`);
  const randomRoll = rng.range(-1, 1);
  const breakdown = predictStrike(player, rival, resolvedPlayerTactic, resolvedRivalTactic, randomRoll);
  const outcome = breakdown.strike > 0 ? "win" : breakdown.strike < 0 ? "loss" : "draw";
  const narration = buildNarration({ outcome, strike: breakdown.strike, player, rival });
  const styleMultiplier = toMultiplier(1 + Math.max(0, player.joust.hype - 5) * 0.05);

  return {
    seed,
    difficulty,
    player: breakdown.player,
    rival,
    playerTactic: resolvedPlayerTactic,
    rivalTactic: resolvedRivalTactic,
    strike: breakdown.strike,
    outcome,
    narration,
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
      styleMultiplier,
      difficultyMultiplier: JOUST_DIFFICULTIES[difficulty].rewardMultiplier,
    },
  };
}
