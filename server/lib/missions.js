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

export const MISSION_BOARD_DEFINITIONS = [
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

function getRequirementTarget(requirement) {
  return typeof requirement.count === 'number' ? requirement.count : 0;
}

function buildWeatherMap(weatherPayload) {
  return Object.fromEntries((weatherPayload?.districts ?? []).map((entry) => [entry.district, entry]));
}

function canCardAccessDistrict(card, district, weatherByDistrict) {
  const wheelType = card?.board?.config?.wheels;
  const boardType = card?.board?.config?.boardType;
  const allowedWheelTypes = DISTRICT_WHEEL_ACCESS_RULES[district]?.allowedWheelTypes ?? [];
  if (!allowedWheelTypes.includes(wheelType)) {
    return false;
  }
  const weather = weatherByDistrict[district];
  if (weather?.accessRule && weather.accessRule.requiredBoardType !== boardType) {
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
  const resolvedId = selectedForkOptionId ?? mission?.selectedForkOptionId ?? options[0]?.id;
  return options.find((option) => option.id === resolvedId) ?? options[0] ?? null;
}

export function getMissionEffectiveRewards(mission, selectedForkOptionId = null) {
  const selectedOption = getMissionForkOption(mission, selectedForkOptionId);
  return {
    rewardXp: (Number(mission?.rewardXp) || 0) + (Number(selectedOption?.rewardXpDelta) || 0),
    rewardOzzies: (Number(mission?.rewardOzzies) || 0) + (Number(selectedOption?.rewardOzziesDelta) || 0),
  };
}

export function getMissionEffectiveRequirements(mission, selectedForkOptionId = null) {
  const selectedOption = getMissionForkOption(mission, selectedForkOptionId);
  return [...(mission?.requirements ?? []), ...(selectedOption?.requirements ?? [])];
}

export function createMissionBoardEntries(uid, now = new Date().toISOString()) {
  return MISSION_BOARD_DEFINITIONS.map((definition) => ({
    id: `${uid}_${definition.definitionId}`,
    uid,
    system: 'mission_board',
    schemaVersion: 2,
    status: 'active',
    progress: 0,
    target: 1,
    createdAt: now,
    updatedAt: now,
    ...definition,
  }));
}

export function evaluateMissionDeck(deck, mission, weatherPayload = null, selectedForkOptionId = null) {
  const weatherByDistrict = buildWeatherMap(weatherPayload);
  const cards = Array.isArray(deck?.cards) ? deck.cards : [];
  const selectedOption = getMissionForkOption(mission, selectedForkOptionId);
  const results = getMissionEffectiveRequirements(mission, selectedForkOptionId).map((requirement) => {
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
  };
}
