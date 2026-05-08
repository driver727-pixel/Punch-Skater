import { getAvailableJoustTactics, resolveJoust, selectDefaultJoustRider } from './joust.js';
import {
  getDistrictRivalMissionHook,
  getDistrictRivalProgressionAward,
} from './rivals.js';

const DISTRICT_WHEEL_ACCESS_RULES = {
  Airaway: {
    allowedWheelTypes: ['Urethane'],
  },
  'Glass City': {
    allowedWheelTypes: ['Urethane', 'Pneumatic', 'Rubber', 'Cloud'],
  },
  'The Grid': {
    allowedWheelTypes: ['Urethane', 'Pneumatic', 'Rubber', 'Cloud'],
  },
  Batteryville: {
    allowedWheelTypes: ['Pneumatic', 'Rubber', 'Cloud'],
  },
  Nightshade: {
    allowedWheelTypes: ['Pneumatic', 'Rubber', 'Cloud'],
  },
  'The Forest': {
    allowedWheelTypes: ['Pneumatic', 'Rubber'],
  },
};

export const DAILY_MISSION_BOARD_COUNT = 4;

const WEEKLY_MISSION_THEMES = [
  {
    id: 'breaker-week',
    label: 'Breaker Week',
    summary: 'Batteryville and Forest crews are paying extra for decks that can take punishment and keep freight moving.',
    featuredDistricts: ['Batteryville', 'The Forest'],
    rewardXpBonus: 20,
    rewardOzziesBonus: 12,
  },
  {
    id: 'ghost-lights',
    label: 'Ghost Lights',
    summary: 'Nightshade and Airaway are leaning on stealth routes, clean wheels, and quiet checkpoint runs.',
    featuredDistricts: ['Nightshade', 'Airaway'],
    rewardXpBonus: 18,
    rewardOzziesBonus: 10,
  },
  {
    id: 'open-territory',
    label: 'Open Territory',
    summary: 'Glass City and The Grid are flooding the map with fast exchange jobs and monitored courier traces.',
    featuredDistricts: ['Glass City', 'The Grid'],
    rewardXpBonus: 15,
    rewardOzziesBonus: 14,
  },
];

function toMissionDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function getNextMissionResetAt(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  )).toISOString();
}

const RELAXED_MISSION_MIN_CARDS = 5;
const BASE_STAT_REDUCTION = 4;
const FORK_STAT_REDUCTION = 2;
const ACTIVE_HAND_SIZE = 3;
export const HARD_CUTOUT_COUNTER_ID = 'hard-cutout';
const MISSION_JOUST_OPTION_ID = 'district-joust';
const MISSION_JOUST_BASE_REWARDS = {
  win: { rewardXpDelta: 24, rewardOzziesDelta: 18 },
  draw: { rewardXpDelta: 10, rewardOzziesDelta: 8 },
  loss: { rewardXpDelta: 0, rewardOzziesDelta: 0 },
};
// Keep the first mission-joust rollout on the standard band unless a district explicitly opts into more pressure.
const DEFAULT_MISSION_JOUST_DIFFICULTY = 'standard';
const MISSION_JOUST_SEED_FALLBACK = 'mission-joust';
const MISSION_JOUST_TACTIC_FALLBACK = 'charge';
const MISSION_JOUST_SELECTION_FALLBACK = 'auto';

const ROUGH_ROUTE_DISTRICTS = new Set(['Batteryville', 'Nightshade', 'The Forest']);
const CAMERA_HACKER_ARCHETYPES = new Set(['The Knights Technarchy', 'D4rk $pider']);
const RAIN_MISSION_BONUS = {
  counterPowerDelta: -1,
  rewardXpDelta: 15,
  rewardOzziesDelta: 10,
};
const HEAVY_RAIN_MISSION_BONUS = {
  counterPowerDelta: -2,
  rewardXpDelta: 30,
  rewardOzziesDelta: 20,
};

function getMissionThreatSummary(mission) {
  switch (mission.district) {
    case 'Airaway':
      return 'Rival Eyes lock the checkpoint glass and force a live counter before the lane seals.';
    case 'Batteryville':
      return 'A yard boss reroutes the freight line and dares the crew to improvise under pressure.';
    case 'The Grid':
      return "Cascade cameras wake up mid-run and trace the crew unless someone blinds the net.";
    case 'Nightshade':
      return 'Tunnel lookouts catch a shadow of the crew and force a hush-or-heat decision.';
    case 'The Forest':
      return 'The route turns slick and splintered, demanding rough-route control before the bridge gives way.';
    case 'Glass City':
      return 'Broker surveillance floods the exchange, forcing a cutout before the rivals collapse the lane.';
    default:
      return 'The district throws a live problem at the crew the second the run starts to feel safe.';
  }
}

const MISSION_JOUST_RIVAL_FALLBACKS = {
  'The Forest': {
    label: 'Rootline joust',
    intro: 'A root bridge guide blocks the mudline and insists on a balance-first duel for passage.',
    summary: 'Clear the bridge guide in a quick joust for a little extra gratitude from the route.',
    rival: {
      id: 'forest-rootline-guide',
      name: 'Knot Runner',
      archetype: 'Wooders',
      crew: 'Wooders',
      district: 'The Forest',
      stats: { speed: 6, range: 5, rangeNm: 5, stealth: 5, grit: 8 },
      joust: {
        lance: 6,
        shield: 8,
        hype: 6,
        gear: {
          boardType: 'Street',
          lanceType: 'kinetic',
          shieldType: 'riot',
          armorTag: 'root-guard barkplate',
        },
        traits: ['Riot Shield'],
      },
    },
  },
};

function getMissionJoustConfig(mission) {
  const rivalHook = getDistrictRivalMissionHook(mission.district);
  if (rivalHook) {
    return {
      label: rivalHook.label,
      intro: rivalHook.intro,
      summary: rivalHook.summary,
      difficulty: rivalHook.difficulty,
      rivalId: rivalHook.rivalId,
      rival: rivalHook.rivalCard,
    };
  }
  return MISSION_JOUST_RIVAL_FALLBACKS[mission.district];
}

function buildMissionJoustOption(mission) {
  const config = getMissionJoustConfig(mission);
  return {
    id: MISSION_JOUST_OPTION_ID,
    label: config.label,
    description: config.summary,
    encounterType: 'joust',
    joustDifficulty: config.difficulty ?? DEFAULT_MISSION_JOUST_DIFFICULTY,
    joustPrompt: config.intro,
    minimumCounterPower: 0,
    successSummary: `${config.label} cracked open a bonus lane for the crew.`,
    failureSummary: `${config.label} came up short, so the crew settled for the base contract only.`,
  };
}

function dedupeCounterTags(tags) {
  return [...new Set(tags)];
}

function normalizeWeatherSummary(summary) {
  return String(summary ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getMissionWeatherImpact(weather) {
  if (!weather) return null;
  const summary = normalizeWeatherSummary(weather.summary);
  if (summary === 'heavy rain') {
    return {
      id: 'storm-surge',
      label: 'Storm Surge',
      summary: `Heavy rain is flooding the route. Live counters lose 2 power, but the contract pays +${HEAVY_RAIN_MISSION_BONUS.rewardXpDelta} XP and +${HEAVY_RAIN_MISSION_BONUS.rewardOzziesDelta} Ozzies.`,
      counterPowerDelta: HEAVY_RAIN_MISSION_BONUS.counterPowerDelta,
      rewardXpDelta: HEAVY_RAIN_MISSION_BONUS.rewardXpDelta,
      rewardOzziesDelta: HEAVY_RAIN_MISSION_BONUS.rewardOzziesDelta,
      source: 'Heavy rain',
    };
  }
  if (summary === 'rain' || (Number(weather.rainMm) || 0) > 0) {
    // Prefer the upstream summary, but fall back to the measured rain amount so the
    // mission layer still reacts if the summary lags behind the latest rainfall value.
    return {
      id: 'rain-slick-route',
      label: 'Rain-Slick Route',
      summary: `Rain is making the route riskier. Live counters lose 1 power, but the contract pays +${RAIN_MISSION_BONUS.rewardXpDelta} XP and +${RAIN_MISSION_BONUS.rewardOzziesDelta} Ozzies.`,
      counterPowerDelta: RAIN_MISSION_BONUS.counterPowerDelta,
      rewardXpDelta: RAIN_MISSION_BONUS.rewardXpDelta,
      rewardOzziesDelta: RAIN_MISSION_BONUS.rewardOzziesDelta,
      source: 'Rain',
    };
  }
  return null;
}

function mapRequirementToCounterTags(requirement) {
  switch (requirement.type) {
    case 'wheel_type': {
      const wheels = requirement.wheelTypes ?? [];
      const tags = [];
      if (wheels.includes('Urethane')) tags.push('mainline_speed');
      if (wheels.some((wheel) => wheel === 'Pneumatic' || wheel === 'Rubber')) tags.push('rough_route', 'shockproof');
      if (wheels.includes('Cloud')) tags.push('regen_brake');
      return dedupeCounterTags(tags);
    }
    case 'district_card':
    case 'district_access':
      return ['local_knowledge'];
    case 'archetype':
    case 'faction':
      return requirement.archetype === 'The Knights Technarchy' || requirement.faction === 'The Knights Technarchy'
        ? ['camera_blind']
        : ['quiet_line'];
    case 'stat_total':
      switch (requirement.stat) {
        case 'speed':
          return ['mainline_speed'];
        case 'range':
          return ['long_range'];
        case 'stealth':
          return ['quiet_line', 'camera_blind'];
        case 'grit':
          return ['heavy_push', 'shockproof'];
        default:
          return [];
      }
    default:
      return [];
  }
}

function inferEncounterOptionTags(option) {
  return dedupeCounterTags((option.requirements ?? []).flatMap((requirement) => mapRequirementToCounterTags(requirement)));
}

function inferEncounterOptionPower(option) {
  const requirementCount = option.requirements?.length ?? 0;
  return Math.max(1, 1 + Math.floor(requirementCount / 2));
}

function getCardCounterTags(card, mission) {
  const tags = [];
  const wheels = card?.board?.config?.wheels;
  if (wheels === 'Urethane') tags.push('mainline_speed');
  if (wheels === 'Pneumatic' || wheels === 'Rubber') tags.push('rough_route', 'shockproof');
  if (wheels === 'Cloud') tags.push('regen_brake');
  if ((Number(card?.stats?.speed) || 0) >= 7) tags.push('mainline_speed');
  if ((Number(card?.stats?.range) || 0) >= 7) tags.push('long_range');
  if ((Number(card?.stats?.stealth) || 0) >= 7) tags.push('quiet_line');
  if ((Number(card?.stats?.grit) || 0) >= 7) tags.push('heavy_push');
  if (CAMERA_HACKER_ARCHETYPES.has(card?.prompts?.archetype) || CAMERA_HACKER_ARCHETYPES.has(card?.identity?.crew)) {
    tags.push('camera_blind');
  }
  if (card?.prompts?.district === mission.district) tags.push('local_knowledge');
  return dedupeCounterTags(tags);
}

function buildMissionStatusEffects(cards, mission, weather) {
  const urethaneCount = cards.filter((card) => card?.board?.config?.wheels === 'Urethane').length;
  const roughRouteCount = cards.filter((card) => ['Pneumatic', 'Rubber'].includes(card?.board?.config?.wheels)).length;
  const averageRange = cards.length > 0
    ? cards.reduce((sum, card) => sum + (Number(card?.stats?.range) || 0), 0) / cards.length
    : 0;
  const effects = [];
  const weatherImpact = getMissionWeatherImpact(weather);

  if (weatherImpact) {
    effects.push({
      id: weatherImpact.id,
      label: weatherImpact.label,
      summary: weatherImpact.summary,
      kind: 'penalty',
      powerDelta: weatherImpact.counterPowerDelta,
      source: weatherImpact.source,
    });
  }

  if (urethaneCount >= 2 && (mission.district === 'Airaway' || mission.district === 'Glass City')) {
    effects.push({
      id: 'mainline-burst',
      label: 'Mainline Burst',
      summary: "Street wheels are eating the clean lane and raising the crew's response ceiling.",
      kind: 'bonus',
      stat: 'speed',
      powerDelta: 2,
      source: 'Urethane wheels',
    });
  }
  if (urethaneCount >= 2 && weather?.rainMm && weather.rainMm >= 2 && ROUGH_ROUTE_DISTRICTS.has(mission.district)) {
    effects.push({
      id: 'speed-wobbles',
      label: 'Speed Wobbles',
      summary: 'Street wheels are sketchy on wet rough lanes, so late-run counters lose bite.',
      kind: 'penalty',
      stat: 'speed',
      powerDelta: -2,
      source: 'Rain-soaked access lines',
    });
  }
  if (roughRouteCount >= 2 && ROUGH_ROUTE_DISTRICTS.has(mission.district)) {
    effects.push({
      id: 'rough-route-traction',
      label: 'Rough-Route Traction',
      summary: 'Heavy wheels keep the deck planted through the ugly lines.',
      kind: 'bonus',
      stat: 'grit',
      powerDelta: 2,
      source: 'Pneumatic / Rubber wheels',
    });
  }
  if (averageRange <= 5.5) {
    effects.push({
      id: 'battery-sag',
      label: 'Battery Sag',
      summary: "The crew is squeezing its pack range, so the final leg hits softer than the launch.",
      kind: 'penalty',
      stat: 'range',
      powerDelta: -1,
      source: 'Thin reserve range',
    });
  }
  if (hasMissionRegenCapableSetup(cards)) {
    effects.push({
      id: 'regen-braking',
      label: 'Regen Braking',
      summary: 'The crew can claw back momentum mid-run with risky braking lines.',
      kind: 'bonus',
      stat: 'range',
      powerDelta: 1,
      source: 'Utility wheel setup',
    });
  }

  return effects;
}

function hasMissionRegenCapableSetup(cards) {
  return cards.some((card) => (
    card?.board?.config?.wheels === 'Cloud'
    || (
      (card?.board?.config?.wheels === 'Pneumatic' || card?.board?.config?.wheels === 'Rubber')
      && (Number(card?.stats?.speed) || 0) >= 6
    )
  ));
}

function buildMissionSynergyTags(cards, mission) {
  const hasCameraBlind = cards.some((card) => getCardCounterTags(card, mission).includes('camera_blind'));
  const hasHeavyBoard = cards.some((card) => getCardCounterTags(card, mission).some((tag) => tag === 'rough_route' || tag === 'heavy_push'));
  const hasQuietLocal = cards.some((card) => getCardCounterTags(card, mission).includes('quiet_line'))
    && cards.some((card) => getCardCounterTags(card, mission).includes('local_knowledge'));
  const hasRegenRig = cards.some((card) => getCardCounterTags(card, mission).includes('regen_brake'))
    && cards.some((card) => getCardCounterTags(card, mission).includes('mainline_speed'));
  const tags = [];
  if (hasCameraBlind && hasHeavyBoard) tags.push('camera_blind', 'heavy_push');
  if (hasQuietLocal) tags.push('local_knowledge', 'quiet_line');
  if (hasRegenRig) tags.push('regen_brake');
  return dedupeCounterTags(tags);
}

function buildMissionActiveCards(cards) {
  return cards.slice(0, ACTIVE_HAND_SIZE);
}

function getMissionOptionPower(option, activeCards, mission, statusEffects, synergyTags) {
  const requiredTags = option.requiredTags ?? [];
  const activeTags = activeCards.flatMap((card) => getCardCounterTags(card, mission));
  const matchingTags = requiredTags.filter((tag) => activeTags.includes(tag) || synergyTags.includes(tag));
  const effectPower = statusEffects.reduce((sum, effect) => sum + (Number(effect?.powerDelta) || 0), 0);
  return matchingTags.length + effectPower;
}

function enrichEncounterOptions(encounter, activeCards, mission, statusEffects, synergyTags) {
  return {
    ...encounter,
    options: encounter.options.map((option) => {
      const currentPower = getMissionOptionPower(option, activeCards, mission, statusEffects, synergyTags);
      const requiredTags = option.requiredTags ?? [];
      const available = option.encounterType === 'joust'
        ? activeCards.length > 0
        : requiredTags.every((tag) => (
          activeCards.some((card) => getCardCounterTags(card, mission).includes(tag)) || synergyTags.includes(tag)
        )) && currentPower >= (option.minimumCounterPower ?? 1);
      return {
        ...option,
        requiredTags,
        currentPower,
        available,
      };
    }),
  };
}

function pluralize(count, singular, customPlural = `${singular}s`) {
  return count === 1 ? singular : customPlural;
}

function capitalize(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildMissionRequirementLabel(requirement) {
  const count = requirement.count ?? 0;
  switch (requirement.type) {
    case 'min_cards':
      return `Bring at least ${count} cards for the run.`;
    case 'district_access':
      return `At least ${count} ${pluralize(count, 'courier')} can enter ${requirement.district}.`;
    case 'wheel_type':
      return `Run at least ${count} ${pluralize(count, 'courier')} with ${(requirement.wheelTypes ?? []).join(' / ')} wheels.`;
    case 'archetype':
      return `Include ${count} ${requirement.archetype} ${pluralize(count, 'courier')}.`;
    case 'faction':
      return `Include ${count} ${requirement.faction} ${pluralize(count, 'courier')}.`;
    case 'stat_total':
      return `Reach ${count} total ${capitalize(requirement.stat)} across the deck.`;
    case 'district_card':
      return `Include ${count} ${requirement.district} ${pluralize(count, 'local')} in the deck.`;
    default:
      throw new Error(`Unknown mission requirement type: ${requirement.type}`);
  }
}

function relaxMissionRequirement(requirement, { specialistFloor, statReduction }) {
  const count = requirement.count ?? 0;
  let nextCount = count;
  switch (requirement.type) {
    case 'min_cards':
      nextCount = Math.min(count, RELAXED_MISSION_MIN_CARDS);
      break;
    case 'district_access':
    case 'wheel_type':
      nextCount = Math.max(1, count - 1);
      break;
    case 'district_card':
    case 'archetype':
    case 'faction':
      nextCount = Math.max(specialistFloor, count - 1);
      break;
    case 'stat_total':
      nextCount = Math.max(1, count - statReduction);
      break;
    default:
      throw new Error(`Unknown mission requirement type: ${requirement.type}`);
  }

  if (nextCount <= 0) return null;
  const relaxedRequirement = { ...requirement, count: nextCount };
  return {
    ...relaxedRequirement,
    label: buildMissionRequirementLabel(relaxedRequirement),
  };
}

function relaxMissionRequirements(requirements, options) {
  return requirements
    .map((requirement) => relaxMissionRequirement(requirement, options))
    .filter(Boolean);
}

/**
 * Stable FNV-1a hash used to deterministically shuffle daily mission boards
 * without storing extra ordering state server-side.
 */
function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getWeeklyMissionTheme(now = new Date().toISOString()) {
  const date = now instanceof Date ? now : new Date(now);
  const weekIndex = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / (7 * 86_400_000));
  return WEEKLY_MISSION_THEMES[weekIndex % WEEKLY_MISSION_THEMES.length];
}

const BASE_MISSION_BOARD_DEFINITIONS = [
  {
    definitionId: "batteryville-breaker-yard",
    sortOrder: 0,
    title: "Breaker Yard Relay",
    tagline: "Shift freight through Batteryville without losing your axle.",
    description:
      "Batteryville only respects decks that can absorb punishment. Bring a full squad, keep your line moving, and prove your couriers can survive the scrapyard lanes.",
    district: "Batteryville",
    rewardXp: 180,
    rewardOzzies: 90,
    requirements: [
      { type: "min_cards", label: "Bring a full six-card deck.", count: 6 },
      { type: "district_access", label: "At least 2 couriers can enter Batteryville.", count: 2, district: "Batteryville" },
      { type: "district_card", label: "Include 1 Batteryville local in the deck.", count: 1, district: "Batteryville" },
      { type: "stat_total", label: "Reach 28 total Grit across the deck.", count: 28, stat: "grit" },
    ],
    fork: {
      badge: "Fork in the road",
      prompt: "Do you punch through the crusher lane for more cash, or ride the service rails for a cleaner relay?",
      options: [
        {
          id: "crusher-lane",
          label: "Crusher lane",
          description: "Take the loud scrapyard route for a fatter Ozzy bag.",
          rewardOzziesDelta: 35,
          requirements: [{ type: "stat_total", label: "Reach 32 total Grit across the deck.", count: 32, stat: "grit" }],
        },
        {
          id: "service-rails",
          label: "Service rails",
          description: "Stay low and ride the worker lines with more Batteryville locals.",
          rewardXpDelta: 25,
          requirements: [{ type: "district_card", label: "Include 2 Batteryville locals in the deck.", count: 2, district: "Batteryville" }],
        },
      ],
    },
  },
  {
    definitionId: "nightshade-tunnel-run",
    sortOrder: 1,
    title: "Nightshade Tunnel Run",
    tagline: "Quiet wheels, clean shadows, no witnesses.",
    description:
      "The Murk doesn't care about brute force. It rewards couriers who can ride rough access lines, stay hidden, and finish the drop before the tunnel crews notice.",
    district: "Nightshade",
    rewardXp: 190,
    rewardOzzies: 110,
    requirements: [
      { type: "min_cards", label: "Bring a full six-card deck.", count: 6 },
      { type: "district_access", label: "At least 2 couriers can enter Nightshade.", count: 2, district: "Nightshade" },
      { type: "stat_total", label: "Reach 28 total Stealth across the deck.", count: 28, stat: "stealth" },
    ],
    fork: {
      badge: "Fork in the road",
      prompt: "Run the tunnel drift for extra heat, or ghost the courier chain for a softer landing?",
      options: [
        {
          id: "tunnel-drift",
          label: "Tunnel drift",
          description: "Push deeper into the shadows and get paid for every silent inch.",
          rewardOzziesDelta: 30,
          requirements: [{ type: "stat_total", label: "Reach 32 total Stealth across the deck.", count: 32, stat: "stealth" }],
        },
        {
          id: "ghost-chain",
          label: "Ghost chain",
          description: "Work with the locals and keep the route invisible end to end.",
          rewardXpDelta: 20,
          requirements: [{ type: "district_card", label: "Include 1 Nightshade local in the deck.", count: 1, district: "Nightshade" }],
        },
      ],
    },
  },
  {
    definitionId: "airaway-sky-lane",
    sortOrder: 2,
    title: "Airaway Sky-Lane",
    tagline: "Only street-quiet rigs make it through the checkpoint glass.",
    description:
      "Airaway chews up loud hardware. Build a clean, fast deck with enough street-wheel couriers to get through the scanners before the corp towers close the route.",
    district: "Airaway",
    rewardXp: 170,
    rewardOzzies: 85,
    requirements: [
      { type: "min_cards", label: "Bring a full six-card deck.", count: 6 },
      { type: "wheel_type", label: "Run at least 2 street-wheel couriers.", count: 2, wheelTypes: ["Urethane"] },
      { type: "district_access", label: "At least 1 courier can enter Airaway.", count: 1, district: "Airaway" },
      { type: "stat_total", label: "Reach 24 total Speed across the deck.", count: 24, stat: "speed" },
    ],
    fork: {
      badge: "Fork in the road",
      prompt: "Spoof the checkpoint scanners for better intel, or sprint the rooftops before the sky-lane closes?",
      options: [
        {
          id: "scanner-spoof",
          label: "Scanner spoof",
          description: "Bring more clean street wheels and leave with extra mission XP.",
          rewardXpDelta: 25,
          requirements: [{ type: "wheel_type", label: "Run at least 3 street-wheel couriers.", count: 3, wheelTypes: ["Urethane"] }],
        },
        {
          id: "rooftop-sprint",
          label: "Rooftop sprint",
          description: "Hammer the fast line and cash out before corporate closes the route.",
          rewardOzziesDelta: 30,
          requirements: [{ type: "stat_total", label: "Reach 28 total Speed across the deck.", count: 28, stat: "speed" }],
        },
      ],
    },
  },
  {
    definitionId: "grid-trace",
    sortOrder: 3,
    title: "Grid Trace Job",
    tagline: "Cascade's cameras never blink. Your deck shouldn't either.",
    description:
      "The Grid is a surveillance maze. Run a fast stack with at least one Technarchy operative and enough district-ready hardware to stay ahead of the trace.",
    district: "The Grid",
    rewardXp: 220,
    rewardOzzies: 125,
    requirements: [
      { type: "min_cards", label: "Bring a full six-card deck.", count: 6 },
      { type: "district_access", label: "At least 2 couriers can enter The Grid.", count: 2, district: "The Grid" },
      { type: "archetype", label: "Include 1 Knights Technarchy courier.", count: 1, archetype: "The Knights Technarchy" },
      { type: "stat_total", label: "Reach 30 total Speed across the deck.", count: 30, stat: "speed" },
    ],
    fork: {
      badge: "Fork in the road",
      prompt: "Do you pull a data snatch for extra Ozzies, or cut the blackout line for more rep and XP?",
      options: [
        {
          id: "data-snatch",
          label: "Data snatch",
          description: "Bring another Technarchy rider and sell the trace logs on the side.",
          rewardOzziesDelta: 40,
          requirements: [{ type: "archetype", label: "Include 2 Knights Technarchy couriers.", count: 2, archetype: "The Knights Technarchy" }],
        },
        {
          id: "blackout-line",
          label: "Blackout line",
          description: "Outrun the cameras entirely and bank more mission XP.",
          rewardXpDelta: 25,
          requirements: [{ type: "stat_total", label: "Reach 34 total Speed across the deck.", count: 34, stat: "speed" }],
        },
      ],
    },
  },
  {
    definitionId: "forest-rootline",
    sortOrder: 4,
    title: "Rootline Extraction",
    tagline: "Bring rough-route wheels or leave the package in the roots.",
    description:
      "The Forest only opens to decks built for root bridges and wet timber lanes. If your riders can't bite into the route, the job dies before it starts.",
    district: "The Forest",
    rewardXp: 210,
    rewardOzzies: 120,
    requirements: [
      { type: "min_cards", label: "Bring a full six-card deck.", count: 6 },
      { type: "wheel_type", label: "Run at least 2 rough-route wheel setups.", count: 2, wheelTypes: ["Pneumatic", "Rubber"] },
      { type: "district_access", label: "At least 2 couriers can enter The Forest.", count: 2, district: "The Forest" },
      { type: "district_card", label: "Include 1 Forest local in the deck.", count: 1, district: "The Forest" },
    ],
    fork: {
      badge: "Fork in the road",
      prompt: "Cross the root bridge for better pay, or take the rain trench and build rep with a tougher crew?",
      options: [
        {
          id: "root-bridge",
          label: "Root bridge",
          description: "Leverage local guides and squeeze more Ozzies out of the extraction.",
          rewardOzziesDelta: 35,
          requirements: [{ type: "district_card", label: "Include 2 Forest locals in the deck.", count: 2, district: "The Forest" }],
        },
        {
          id: "rain-trench",
          label: "Rain trench",
          description: "Muscle through the mud line and come back with extra XP.",
          rewardXpDelta: 20,
          requirements: [{ type: "stat_total", label: "Reach 30 total Grit across the deck.", count: 30, stat: "grit" }],
        },
      ],
    },
  },
  {
    definitionId: "glass-city-exchange",
    sortOrder: 5,
    title: "Glass City Exchange",
    tagline: "Any wheel can enter. Not every deck can finish the route.",
    description:
      "Glass City is open territory, which means everyone wants the payout. Bring enough ride-ready couriers and the range to finish the exchange before a rival cuts in.",
    district: "Glass City",
    rewardXp: 160,
    rewardOzzies: 80,
    requirements: [
      { type: "min_cards", label: "Bring a full six-card deck.", count: 6 },
      { type: "district_access", label: "At least 3 couriers can enter Glass City.", count: 3, district: "Glass City" },
      { type: "district_card", label: "Include 1 Glass City local in the deck.", count: 1, district: "Glass City" },
      { type: "stat_total", label: "Reach 28 total Range across the deck.", count: 28, stat: "range" },
    ],
    fork: {
      badge: "Fork in the road",
      prompt: "Make the broker handshake for safer XP, or run the hard cutout for a riskier payout?",
      options: [
        {
          id: "broker-handshake",
          label: "Broker handshake",
          description: "Stack more local knowledge and leave with extra mission XP.",
          rewardXpDelta: 25,
          requirements: [{ type: "district_card", label: "Include 2 Glass City locals in the deck.", count: 2, district: "Glass City" }],
        },
        {
          id: "hard-cutout",
          label: "Hard cutout",
          description: "Stretch the range and take the bigger cash route through open territory.",
          rewardOzziesDelta: 35,
          requirements: [{ type: "stat_total", label: "Reach 32 total Range across the deck.", count: 32, stat: "range" }],
        },
      ],
    },
  },
  {
    definitionId: "batteryville-switchyard-uprising",
    sortOrder: 6,
    title: "Switchyard Uprising",
    tagline: "Smuggle strike pay through Batteryville before HexChain shuts every switch.",
    description:
      "Batteryville's recycler crews are moving against HexChain. Load a deck that can carry money, proof drives, and enough grit to keep the switchyard open long enough for the workers to disappear.",
    district: "Batteryville",
    rewardXp: 250,
    rewardOzzies: 145,
    requirements: [
      { type: "min_cards", label: "Bring a full six-card deck.", count: 6 },
      { type: "district_access", label: "At least 3 couriers can enter Batteryville.", count: 3, district: "Batteryville" },
      { type: "district_card", label: "Include 2 Batteryville locals in the deck.", count: 2, district: "Batteryville" },
      { type: "stat_total", label: "Reach 30 total Grit across the deck.", count: 30, stat: "grit" },
      { type: "stat_total", label: "Reach 24 total Range across the deck.", count: 24, stat: "range" },
    ],
    fork: {
      badge: "Pressure point",
      prompt: "Back the recycler line, bribe a yard boss for a fast payout, or carry the proof drives to a Grid vault for a split reward?",
      options: [
        {
          id: "recycler-line",
          label: "Recycler line",
          description: "Protect the workers and bank extra mission XP with a local-heavy deck.",
          rewardXpDelta: 40,
          requirements: [
            { type: "district_card", label: "Include 3 Batteryville locals in the deck.", count: 3, district: "Batteryville" },
            { type: "wheel_type", label: "Run at least 2 shock-proof wheel setups.", count: 2, wheelTypes: ["Rubber", "Cloud"] },
          ],
        },
        {
          id: "yard-boss-bribe",
          label: "Yard boss bribe",
          description: "Push the hard cash route through the loudest lanes before the bosses change sides.",
          rewardOzziesDelta: 55,
          requirements: [
            { type: "stat_total", label: "Reach 34 total Grit across the deck.", count: 34, stat: "grit" },
            { type: "stat_total", label: "Reach 28 total Range across the deck.", count: 28, stat: "range" },
          ],
        },
        {
          id: "proof-vault",
          label: "Proof vault",
          description: "Escort the drives to a trusted Grid vault for a split payout and cleaner story ending.",
          rewardXpDelta: 20,
          rewardOzziesDelta: 20,
          requirements: [
            { type: "archetype", label: "Include 1 Knights Technarchy courier.", count: 1, archetype: "The Knights Technarchy" },
            { type: "stat_total", label: "Reach 26 total Speed across the deck.", count: 26, stat: "speed" },
          ],
        },
      ],
    },
  },
  {
    definitionId: "nightshade-moonrise-echo",
    sortOrder: 7,
    title: "Moonrise Echo Run",
    tagline: "Carry the rave signal through the Murk before the booth goes dark.",
    description:
      "The Moonrisers are replaying the night Skids first got noticed, and every crew in Nightshade wants control of the broadcast. Build a deck that can move fast, stay quiet, and survive a crowded tunnel.",
    district: "Nightshade",
    rewardXp: 275,
    rewardOzzies: 105,
    requirements: [
      { type: "min_cards", label: "Bring a full six-card deck.", count: 6 },
      { type: "district_access", label: "At least 3 couriers can enter Nightshade.", count: 3, district: "Nightshade" },
      { type: "district_card", label: "Include 2 Nightshade locals in the deck.", count: 2, district: "Nightshade" },
      { type: "stat_total", label: "Reach 30 total Stealth across the deck.", count: 30, stat: "stealth" },
      { type: "stat_total", label: "Reach 24 total Speed across the deck.", count: 24, stat: "speed" },
    ],
    fork: {
      badge: "Rave split",
      prompt: "Ride the strobe rush for more XP, take the hush route for cash, or broker a crew handshake for a balanced return?",
      options: [
        {
          id: "strobe-rush",
          label: "Strobe rush",
          description: "Keep the signal loud, outrun the heat, and leave with a bigger reputation payout.",
          rewardXpDelta: 45,
          requirements: [
            { type: "stat_total", label: "Reach 30 total Speed across the deck.", count: 30, stat: "speed" },
            { type: "wheel_type", label: "Run at least 2 tunnel-tuned wheel setups.", count: 2, wheelTypes: ["Rubber", "Cloud", "Pneumatic"] },
          ],
        },
        {
          id: "hush-route",
          label: "Hush route",
          description: "Cut the lights, keep the rave alive, and collect the bigger Ozzy bag from the back room.",
          rewardOzziesDelta: 45,
          requirements: [
            { type: "stat_total", label: "Reach 34 total Stealth across the deck.", count: 34, stat: "stealth" },
            { type: "district_card", label: "Include 3 Nightshade locals in the deck.", count: 3, district: "Nightshade" },
          ],
        },
        {
          id: "crew-handshake",
          label: "Crew handshake",
          description: "Split the route with friendly fixers for a steadier payout and cleaner exit.",
          rewardXpDelta: 20,
          rewardOzziesDelta: 20,
          requirements: [
            { type: "archetype", label: "Include 1 Qu111s courier.", count: 1, archetype: "Qu111s" },
            { type: "stat_total", label: "Reach 26 total Range across the deck.", count: 26, stat: "range" },
          ],
        },
      ],
    },
  },
  {
    definitionId: "airaway-coldchain-pass",
    sortOrder: 8,
    title: "Coldchain Contractor Pass",
    tagline: "Lift a sealed med-crate through Airaway before the cloned badge fails.",
    description:
      "A black-clinic buyer wants a coldchain med-crate lifted through Airaway's private corridors. You need clean wheels, a quiet deck, and a backup route for the moment the contractor pass burns out.",
    district: "Airaway",
    rewardXp: 215,
    rewardOzzies: 150,
    requirements: [
      { type: "min_cards", label: "Bring a full six-card deck.", count: 6 },
      { type: "wheel_type", label: "Run at least 2 street-wheel couriers.", count: 2, wheelTypes: ["Urethane"] },
      { type: "district_access", label: "At least 2 couriers can enter Airaway.", count: 2, district: "Airaway" },
      { type: "stat_total", label: "Reach 28 total Speed across the deck.", count: 28, stat: "speed" },
      { type: "stat_total", label: "Reach 22 total Stealth across the deck.", count: 22, stat: "stealth" },
    ],
    fork: {
      badge: "Corp breach",
      prompt: "Do you keep the badge clone stable for XP, make an executive drop for cash, or dive a maintenance chute for a split reward?",
      options: [
        {
          id: "badge-clone",
          label: "Badge clone",
          description: "Keep the fake credentials live long enough to deliver clean and leave smarter.",
          rewardXpDelta: 35,
          requirements: [
            { type: "wheel_type", label: "Run at least 3 street-wheel couriers.", count: 3, wheelTypes: ["Urethane"] },
            { type: "stat_total", label: "Reach 26 total Stealth across the deck.", count: 26, stat: "stealth" },
          ],
        },
        {
          id: "executive-drop",
          label: "Executive drop",
          description: "Hit the richer tower route and cash out before the glass bridges lock.",
          rewardOzziesDelta: 60,
          requirements: [
            { type: "stat_total", label: "Reach 32 total Speed across the deck.", count: 32, stat: "speed" },
            { type: "stat_total", label: "Reach 26 total Range across the deck.", count: 26, stat: "range" },
          ],
        },
        {
          id: "maintenance-chute",
          label: "Maintenance chute",
          description: "Use the worker shafts for a split payout that rewards utility over flash.",
          rewardXpDelta: 20,
          rewardOzziesDelta: 25,
          requirements: [
            { type: "district_card", label: "Include 2 Airaway locals in the deck.", count: 2, district: "Airaway" },
            { type: "stat_total", label: "Reach 24 total Grit across the deck.", count: 24, stat: "grit" },
          ],
        },
      ],
    },
  },
  {
    definitionId: "grid-parent-trace",
    sortOrder: 9,
    title: "Parent Trace Protocol",
    tagline: "Follow the vanished worker IDs before Cascade purges the trail.",
    description:
      "A buried Grid archive has surfaced with the same worker signatures tied to Skids' missing parents. This run is part heist, part memorial, and part proof that Cascade never really deletes anything.",
    district: "The Grid",
    rewardXp: 320,
    rewardOzzies: 95,
    requirements: [
      { type: "min_cards", label: "Bring a full six-card deck.", count: 6 },
      { type: "district_access", label: "At least 3 couriers can enter The Grid.", count: 3, district: "The Grid" },
      { type: "archetype", label: "Include 1 Knights Technarchy courier.", count: 1, archetype: "The Knights Technarchy" },
      { type: "stat_total", label: "Reach 30 total Speed across the deck.", count: 30, stat: "speed" },
      { type: "stat_total", label: "Reach 24 total Stealth across the deck.", count: 24, stat: "stealth" },
    ],
    fork: {
      badge: "Archive fracture",
      prompt: "Rip the archive for cash, ghost-query it for lore-heavy XP, or trace the worker line back through Batteryville for a split payout?",
      options: [
        {
          id: "archive-heist",
          label: "Archive heist",
          description: "Steal the saleable pieces of the archive and leave the rest smoking behind you.",
          rewardOzziesDelta: 45,
          requirements: [
            { type: "archetype", label: "Include 2 Knights Technarchy couriers.", count: 2, archetype: "The Knights Technarchy" },
            { type: "stat_total", label: "Reach 30 total Range across the deck.", count: 30, stat: "range" },
          ],
        },
        {
          id: "ghost-query",
          label: "Ghost query",
          description: "Stay quiet, pull the buried worker story intact, and come back with the bigger XP reward.",
          rewardXpDelta: 50,
          requirements: [
            { type: "stat_total", label: "Reach 34 total Stealth across the deck.", count: 34, stat: "stealth" },
            { type: "district_card", label: "Include 1 Nightshade local in the deck.", count: 1, district: "Nightshade" },
          ],
        },
        {
          id: "worker-trace",
          label: "Worker trace",
          description: "Follow the IDs back to the Batteryville yards for a split reward and a cleaner answer.",
          rewardXpDelta: 20,
          rewardOzziesDelta: 25,
          requirements: [
            { type: "district_card", label: "Include 2 Batteryville locals in the deck.", count: 2, district: "Batteryville" },
            { type: "stat_total", label: "Reach 28 total Grit across the deck.", count: 28, stat: "grit" },
          ],
        },
      ],
    },
  },
];

export const MISSION_BOARD_DEFINITIONS = BASE_MISSION_BOARD_DEFINITIONS.map((definition) => ({
  ...definition,
  requirements: relaxMissionRequirements(definition.requirements, {
    specialistFloor: 0,
    statReduction: BASE_STAT_REDUCTION,
  }),
  fork: definition.fork
    ? {
      ...definition.fork,
      options: definition.fork.options.map((option) => ({
        ...option,
        requirements: relaxMissionRequirements(option.requirements ?? [], {
          specialistFloor: 1,
          statReduction: FORK_STAT_REDUCTION,
        }),
      })),
    }
    : definition.fork,
}));

function getRequirementTarget(requirement) {
  return typeof requirement.count === 'number' ? requirement.count : 0;
}

function buildWeatherMap(weatherPayload) {
  return Object.fromEntries((weatherPayload?.districts ?? []).map((entry) => [entry.district, entry]));
}

function isMissionCardReady(card, nowMs = Date.now()) {
  const maintenance = card?.maintenance;
  if (!maintenance || maintenance.state === 'active') return true;
  if (!maintenance.repairEndsAt) return false;
  const repairEndsMs = Date.parse(maintenance.repairEndsAt);
  return Number.isFinite(repairEndsMs) && repairEndsMs <= nowMs;
}

function canCardAccessDistrict(card, district, weatherByDistrict) {
  const wheelType = card?.board?.config?.wheels;
  void weatherByDistrict;
  const allowedWheelTypes = DISTRICT_WHEEL_ACCESS_RULES[district]?.allowedWheelTypes ?? [];
  if (!allowedWheelTypes.includes(wheelType)) {
    return false;
  }
  return true;
}

function buildRequirementResult(requirement, current, detail) {
  const needed = getRequirementTarget(requirement);
  return {
    requirement,
    met: current >= needed,
    current,
    needed,
    detail,
  };
}

export function getMissionForkOption(mission, selectedForkOptionId = null) {
  const options = mission?.fork?.options ?? [];
  if (options.length === 0) {
    return null;
  }
  const resolvedId = selectedForkOptionId ?? mission?.selectedForkOptionId ?? null;
  if (!resolvedId) {
    return null;
  }
  return options.find((option) => option.id === resolvedId) ?? null;
}

export function getMissionEncounter(mission) {
  if (mission?.encounter?.options?.length) return mission.encounter;
  const fork = mission?.fork;
  if (!fork?.options?.length) return null;
  return {
    id: `${mission.definitionId}-live-encounter`,
    badge: fork.badge,
    prompt: fork.prompt,
    threat: getMissionThreatSummary(mission),
    options: [
      ...fork.options.map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description,
        encounterType: 'counter',
        requirements: option.requirements,
        ...(option.rewardXpDelta !== undefined && { rewardXpDelta: option.rewardXpDelta }),
        ...(option.rewardOzziesDelta !== undefined && { rewardOzziesDelta: option.rewardOzziesDelta }),
        requiredTags: inferEncounterOptionTags(option),
        minimumCounterPower: inferEncounterOptionPower(option),
        successSummary: `${option.label} lands clean and turns the pressure back on the district.`,
        failureSummary: `${option.label} slips, forcing the crew into a hard cutout.`,
      })),
      buildMissionJoustOption(mission),
    ],
  };
}

function getMissionEncounterOption(mission, selectedCounterOptionId = null) {
  const encounter = getMissionEncounter(mission);
  if (!encounter) return null;
  const resolvedId = selectedCounterOptionId
    ?? mission?.selectedCounterOptionId
    ?? mission?.activeRun?.selectedCounterOptionId
    ?? mission?.selectedForkOptionId
    ?? null;
  if (!resolvedId || resolvedId === HARD_CUTOUT_COUNTER_ID) return null;
  return encounter.options.find((option) => option.id === resolvedId) ?? null;
}

function getMissionJoustOption(mission, selectedCounterOptionId = null) {
  const option = getMissionEncounterOption(mission, selectedCounterOptionId);
  return option?.encounterType === 'joust' ? option : null;
}

function getMissionActiveJoustRider(deck, activeRun) {
  const activeIds = new Set(activeRun?.activeCardIds ?? []);
  const cards = Array.isArray(deck?.cards) ? deck.cards.filter((card) => isMissionCardReady(card)) : [];
  const activeCards = activeIds.size > 0
    ? cards.filter((card) => activeIds.has(card.id))
    : [];
  if (activeCards.length === 0) return null;
  return selectDefaultJoustRider(activeCards);
}

export function getMissionJoustTactics(deck, activeRun) {
  const rider = getMissionActiveJoustRider(deck, activeRun);
  return rider ? getAvailableJoustTactics(rider) : [];
}

function getMissionJoustRewards(result) {
  return MISSION_JOUST_BASE_REWARDS[result.outcome];
}

function resolveMissionJoust(mission, deck, activeRun, playerTactic = null) {
  const rider = getMissionActiveJoustRider(deck, activeRun);
  const option = getMissionJoustOption(mission, MISSION_JOUST_OPTION_ID);
  if (!rider || !option) return null;
  const config = getMissionJoustConfig(mission);
  const [defaultTactic = MISSION_JOUST_TACTIC_FALLBACK] = getAvailableJoustTactics(rider);
  const resolution = resolveJoust(rider, config.rival, {
    playerTactic: playerTactic ?? defaultTactic,
    difficulty: option.joustDifficulty ?? DEFAULT_MISSION_JOUST_DIFFICULTY,
    seed: `${mission.id}:${activeRun?.launchedAt ?? MISSION_JOUST_SEED_FALLBACK}:${rider.id}:${playerTactic ?? MISSION_JOUST_SELECTION_FALLBACK}`,
  });
  const rewards = getMissionJoustRewards(resolution);
  const progressionAward = config.rivalId
    ? getDistrictRivalProgressionAward(config.rivalId, resolution.outcome)
    : null;
  return {
    playerCardId: resolution.player.id,
    playerName: resolution.player.name,
    rivalName: resolution.rival.name,
    ...(config.rivalId ? { rivalId: config.rivalId } : {}),
    playerTactic: resolution.playerTactic,
    rivalTactic: resolution.rivalTactic,
    difficulty: resolution.difficulty,
    outcome: resolution.outcome,
    strike: resolution.strike,
    narration: resolution.narration,
    rewardXpBonus: rewards.rewardXpDelta,
    rewardOzziesBonus: rewards.rewardOzziesDelta,
    ...(progressionAward
      ? {
        loreUnlockIds: progressionAward.codexEntryIds,
        cardRewardId: progressionAward.cardRewardId,
        districtReputationDelta: progressionAward.districtReputationDelta,
      }
      : {}),
  };
}

export function getMissionEffectiveRewards(mission, selectedCounterOptionId = null, weatherPayload = null) {
  const selectedOption = getMissionEncounterOption(mission, selectedCounterOptionId)
    ?? getMissionForkOption(mission, selectedCounterOptionId);
  const weatherByDistrict = Array.isArray(weatherPayload?.districts)
    ? buildWeatherMap(weatherPayload)
    : (weatherPayload ?? {});
  const weatherImpact = getMissionWeatherImpact(weatherByDistrict[mission.district] ?? null);
  return {
    rewardXp: (Number(mission?.rewardXp) || 0) + (Number(selectedOption?.rewardXpDelta) || 0) + (Number(weatherImpact?.rewardXpDelta) || 0),
    rewardOzzies: (Number(mission?.rewardOzzies) || 0) + (Number(selectedOption?.rewardOzziesDelta) || 0) + (Number(weatherImpact?.rewardOzziesDelta) || 0),
  };
}

export function getMissionEffectiveRequirements(mission, selectedCounterOptionId = null) {
  const selectedOption = getMissionEncounterOption(mission, selectedCounterOptionId)
    ?? getMissionForkOption(mission, selectedCounterOptionId);
  return [...(mission?.requirements ?? []), ...(selectedOption?.requirements ?? [])];
}

export function buildMissionActiveRunState(deck, mission, weatherPayload = null, launchedAt = new Date().toISOString()) {
  const encounter = getMissionEncounter(mission);
  if (!encounter) return null;
  const weatherByDistrict = buildWeatherMap(weatherPayload);
  const readyCards = Array.isArray(deck?.cards) ? deck.cards.filter((card) => isMissionCardReady(card)) : [];
  const activeCards = buildMissionActiveCards(readyCards);
  const weather = weatherByDistrict[mission.district] ?? null;
  const statusEffects = buildMissionStatusEffects(readyCards, mission, weather);
  const synergyTags = buildMissionSynergyTags(readyCards, mission);
  const enrichedEncounter = enrichEncounterOptions(encounter, activeCards, mission, statusEffects, synergyTags);
  return {
    phase: 'event',
    launchedAt,
    deckId: typeof deck?.id === 'string' ? deck.id : '',
    deckName: typeof deck?.name === 'string' ? deck.name : 'Unnamed Deck',
    encounterId: enrichedEncounter.id,
    activeCardIds: activeCards.map((card) => card.id),
    synergyTags,
    statusEffects,
    availableCounterOptionIds: enrichedEncounter.options.filter((option) => option.available).map((option) => option.id),
    counterPower: statusEffects.reduce((sum, effect) => sum + (Number(effect?.powerDelta) || 0), 0),
    summary: enrichedEncounter.threat,
  };
}

export function resolveMissionCounterChoice(mission, deck, activeRun, counterOptionId = null, playerTactic = null) {
  const encounter = getMissionEncounter(mission);
  const selectedId = counterOptionId ?? activeRun?.selectedCounterOptionId ?? mission?.selectedCounterOptionId ?? null;
  if (!encounter || !selectedId || selectedId === HARD_CUTOUT_COUNTER_ID) {
    return {
      selectedOption: null,
      hardCutout: true,
      rewardXpDelta: -20,
      rewardOzziesDelta: -20,
      summary: 'The crew had to take a hard cutout when the live counter window closed.',
      joustResult: null,
    };
  }
  const selectedOption = encounter.options.find((option) => option.id === selectedId) ?? null;
  if (!selectedOption) {
    return {
      selectedOption: null,
      hardCutout: true,
      rewardXpDelta: -20,
      rewardOzziesDelta: -20,
      summary: 'The live counter fizzled, so the crew escaped through a hard cutout.',
      joustResult: null,
    };
  }
  if (selectedOption.encounterType === 'joust') {
    const joustResult = resolveMissionJoust(mission, deck, activeRun, playerTactic);
    const rewards = joustResult ? getMissionJoustRewards(joustResult) : MISSION_JOUST_BASE_REWARDS.loss;
    return {
      selectedOption,
      hardCutout: false,
      rewardXpDelta: rewards.rewardXpDelta,
      rewardOzziesDelta: rewards.rewardOzziesDelta,
      summary: joustResult?.narration ?? `${selectedOption.label} settled into a cautious draw.`,
      joustResult,
    };
  }
  return {
    selectedOption,
    hardCutout: false,
    rewardXpDelta: Number(selectedOption.rewardXpDelta) || 0,
    rewardOzziesDelta: Number(selectedOption.rewardOzziesDelta) || 0,
    summary: selectedOption.successSummary ?? `${selectedOption.label} kept the run moving.`,
    joustResult: null,
  };
}

function applyWeeklyThemeToDefinition(definition, theme) {
  const isFeatured = theme.featuredDistricts.includes(definition.district);
  if (!isFeatured) {
    return definition;
  }
  const trimmedTagline = definition.tagline.trimEnd();
  return {
    ...definition,
    rewardXp: definition.rewardXp + theme.rewardXpBonus,
    rewardOzzies: definition.rewardOzzies + theme.rewardOzziesBonus,
    tagline: `${trimmedTagline}${trimmedTagline.endsWith(".") ? "" : "."} ${theme.label} bonus live today.`,
  };
}

function createMissionEntry(uid, definition, now, id) {
  const missionShape = {
    definitionId: definition.definitionId,
    district: definition.district,
    fork: definition.fork,
    encounter: definition.encounter,
  };
  return {
    id,
    uid,
    system: 'mission_board',
    schemaVersion: 2,
    status: 'active',
    progress: 0,
    target: 1,
    createdAt: now,
    updatedAt: now,
    ...definition,
    encounter: definition.encounter ?? getMissionEncounter(missionShape),
  };
}

export function createMissionBoardEntries(uid, now = new Date().toISOString()) {
  return MISSION_BOARD_DEFINITIONS.map((definition) => (
    createMissionEntry(uid, definition, now, `${uid}_${definition.definitionId}`)
  ));
}

function createDailyMissionBoardEntry(uid, boardDateKey, now, definition) {
  return createMissionEntry(uid, definition, now, `${uid}_${boardDateKey}_${definition.definitionId}`);
}

function hasPlayableMissionForDecks(missions, decks, weatherPayload = null) {
  if (!Array.isArray(decks) || decks.length === 0) return false;
  return missions.some((mission) => decks.some((deck) => evaluateMissionDeck(deck, mission, weatherPayload).eligible));
}

function pickFallbackMissionReplacementIndex(definitions, featuredDistricts) {
  const featuredDistrictList = Array.isArray(featuredDistricts) ? featuredDistricts : [];
  for (let index = definitions.length - 1; index >= 0; index -= 1) {
    if (!featuredDistrictList.includes(definitions[index].district)) {
      return index;
    }
  }
  return Math.max(0, definitions.length - 1);
}

function ensurePlayableDailyMissionDefinitions(
  uid,
  boardDateKey,
  now,
  weeklyTheme,
  definitions,
  decks = [],
  weatherPayload = null,
) {
  if (!Array.isArray(definitions) || definitions.length === 0 || !Array.isArray(decks) || decks.length === 0) {
    return definitions;
  }

  const selectedEntries = definitions.map((definition) => (
    createDailyMissionBoardEntry(uid, boardDateKey, now, definition)
  ));
  if (hasPlayableMissionForDecks(selectedEntries, decks, weatherPayload)) {
    return definitions;
  }

  const fallbackDefinition = MISSION_BOARD_DEFINITIONS
    .filter((definition) => !definitions.some((entry) => entry.definitionId === definition.definitionId))
    .map((definition) => applyWeeklyThemeToDefinition(definition, weeklyTheme))
    .find((definition) => hasPlayableMissionForDecks([
      createDailyMissionBoardEntry(uid, boardDateKey, now, definition),
    ], decks, weatherPayload));

  if (!fallbackDefinition) {
    return definitions;
  }

  const nextDefinitions = definitions.slice();
  nextDefinitions[pickFallbackMissionReplacementIndex(definitions, weeklyTheme?.featuredDistricts)] = fallbackDefinition;
  return nextDefinitions.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function createDailyMissionBoardPayload(uid, now = new Date().toISOString(), options = {}) {
  const {
    decks = [],
    weatherPayload = null,
  } = options ?? {};
  const boardDateKey = toMissionDateKey(now);
  const dailyResetAt = getNextMissionResetAt(now);
  const weeklyTheme = getWeeklyMissionTheme(now);
  const featuredDefinitions = MISSION_BOARD_DEFINITIONS
    .filter((definition) => weeklyTheme.featuredDistricts.includes(definition.district))
    .sort((a, b) => hashString(`${uid}|${boardDateKey}|featured|${a.definitionId}`) - hashString(`${uid}|${boardDateKey}|featured|${b.definitionId}`));
  const remainingDefinitions = MISSION_BOARD_DEFINITIONS
    .filter((definition) => !weeklyTheme.featuredDistricts.includes(definition.district))
    .sort((a, b) => hashString(`${uid}|${boardDateKey}|rest|${a.definitionId}`) - hashString(`${uid}|${boardDateKey}|rest|${b.definitionId}`));
  const selectedDefinitions = ensurePlayableDailyMissionDefinitions(
    uid,
    boardDateKey,
    now,
    weeklyTheme,
    [...featuredDefinitions, ...remainingDefinitions]
      .slice(0, DAILY_MISSION_BOARD_COUNT)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((definition) => applyWeeklyThemeToDefinition(definition, weeklyTheme)),
    decks,
    weatherPayload,
  );

  return {
    boardDateKey,
    dailyResetAt,
    weeklyTheme,
    missions: selectedDefinitions.map((definition) => (
      createDailyMissionBoardEntry(uid, boardDateKey, now, definition)
    )),
  };
}

export function evaluateMissionDeck(deck, mission, weatherPayload = null, selectedCounterOptionId = null) {
  const weatherByDistrict = buildWeatherMap(weatherPayload);
  const cards = Array.isArray(deck?.cards) ? deck.cards.filter((card) => isMissionCardReady(card)) : [];
  const weather = weatherByDistrict[mission.district] ?? null;
  const statusEffects = buildMissionStatusEffects(cards, mission, weather);
  const synergyTags = buildMissionSynergyTags(cards, mission);
  const activeCards = buildMissionActiveCards(cards);
  const selectedOption = getMissionEncounterOption(mission, selectedCounterOptionId)
    ?? getMissionForkOption(mission, selectedCounterOptionId);
  const results = getMissionEffectiveRequirements(mission, selectedCounterOptionId).map((requirement) => {
    switch (requirement.type) {
      case 'min_cards': {
        const current = cards.length;
        return buildRequirementResult(
          requirement,
          current,
          `${current}/${getRequirementTarget(requirement)} cards ready for the run.`,
        );
      }
      case 'district_access': {
        const district = requirement.district ?? mission.district;
        const current = cards.filter((card) => canCardAccessDistrict(card, district, weatherByDistrict)).length;
        return buildRequirementResult(
          requirement,
          current,
          `${current}/${getRequirementTarget(requirement)} couriers can currently enter ${district}.`,
        );
      }
      case 'wheel_type': {
        const allowedWheelTypes = requirement.wheelTypes ?? [];
        const current = cards.filter((card) => allowedWheelTypes.includes(card?.board?.config?.wheels)).length;
        return buildRequirementResult(
          requirement,
          current,
          `${current}/${getRequirementTarget(requirement)} couriers are running ${allowedWheelTypes.join(' / ')} wheels.`,
        );
      }
      case 'archetype': {
        const current = cards.filter((card) => card?.prompts?.archetype === requirement.archetype).length;
        return buildRequirementResult(
          requirement,
          current,
          `${current}/${getRequirementTarget(requirement)} ${requirement.archetype} couriers in the deck.`,
        );
      }
      case 'faction': {
        const current = cards.filter((card) => card?.identity?.crew === requirement.faction).length;
        return buildRequirementResult(
          requirement,
          current,
          `${current}/${getRequirementTarget(requirement)} ${requirement.faction} couriers in the deck.`,
        );
      }
      case 'stat_total': {
        const stat = requirement.stat ?? 'speed';
        const current = cards.reduce((sum, card) => sum + (Number(card?.stats?.[stat]) || 0), 0);
        return buildRequirementResult(
          requirement,
          current,
          `${current}/${getRequirementTarget(requirement)} total ${stat} across the deck.`,
        );
      }
      case 'district_card': {
        const district = requirement.district ?? mission.district;
        const current = cards.filter((card) => card?.prompts?.district === district).length;
        return buildRequirementResult(
          requirement,
          current,
          `${current}/${getRequirementTarget(requirement)} local couriers from ${district}.`,
        );
      }
      default:
        throw new Error(
          `Unknown mission requirement type: ${requirement.type}. Expected one of min_cards, district_access, wheel_type, archetype, faction, stat_total, or district_card.`,
        );
    }
  });

  const eligible = results.every((result) => result.met);
  const firstUnmet = results.find((result) => !result.met);
  const eligibleCardCount = results.find((result) => result.requirement.type === 'district_access')?.current ?? 0;

  return {
    deckId: typeof deck?.id === 'string' ? deck.id : '',
    deckName: typeof deck?.name === 'string' ? deck.name : 'Unnamed Deck',
    eligible,
    eligibleCardCount,
    summary: eligible
      ? `${typeof deck?.name === 'string' ? deck.name : 'This deck'} can clear the ${mission.title}${selectedOption ? ` via ${selectedOption.label}` : ''}.`
      : firstUnmet?.detail ?? 'This deck is missing mission requirements.',
    results,
    statusEffects,
    synergyTags,
    activeCardIds: activeCards.map((card) => card.id),
    counterPower: statusEffects.reduce((sum, effect) => sum + (Number(effect?.powerDelta) || 0), 0),
  };
}
