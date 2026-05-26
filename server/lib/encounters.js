const TRAVEL_ENCOUNTER_DEFINITIONS = [
  {
    id: 'drone-sweep',
    weight: 5,
    title: 'Drone Sweep',
    badge: 'AIR RISK',
    prompt: 'Security drones lock onto your lane. How do you break line-of-sight?',
    options: [
      { id: 'duck-service-tunnel', label: 'Duck into service tunnel', summary: 'You break contact and keep momentum.', rewardXpDelta: 8, rewardOzziesDelta: 10, outcomeTag: 'clean-escape' },
      { id: 'jam-drone-feed', label: 'Jam the drone feed', summary: 'You spoof the feed but lose time in static.', rewardXpDelta: 5, rewardOzziesDelta: 6, outcomeTag: 'jammed' },
    ],
  },
  {
    id: 'checkpoint-shake',
    weight: 4,
    title: 'Checkpoint Shake',
    badge: 'CIVIC CHECK',
    prompt: 'A temporary checkpoint blocks the main route.',
    options: [
      { id: 'flash-transit-pass', label: 'Flash a forged pass', summary: 'You pass the line before they verify details.', rewardXpDelta: 7, rewardOzziesDelta: 8, outcomeTag: 'bluff-pass' },
      { id: 'side-alley-detour', label: 'Take a side alley', summary: 'You avoid scrutiny at the cost of pace.', rewardXpDelta: 4, rewardOzziesDelta: 5, outcomeTag: 'detour' },
    ],
  },
  {
    id: 'rival-trail',
    weight: 3,
    title: 'Rival Tail',
    badge: 'PRESSURE',
    prompt: 'A rival courier tracks your path and closes in.',
    options: [
      { id: 'burst-acceleration', label: 'Burst acceleration', summary: 'You create distance and keep the package secure.', rewardXpDelta: 9, rewardOzziesDelta: 7, outcomeTag: 'outran-rival' },
      { id: 'fake-turn', label: 'Fake a turn and cut back', summary: 'You lose them in the intersections.', rewardXpDelta: 6, rewardOzziesDelta: 6, outcomeTag: 'misdirected' },
    ],
  },
  {
    id: 'signal-jam',
    weight: 2,
    title: 'Signal Jam',
    badge: 'COMMS DOWN',
    prompt: 'Your nav feed drops to noise right on the checkpoint marker.',
    options: [
      { id: 'manual-landmarks', label: 'Run by landmarks', summary: 'You keep moving with old-school bearings.', rewardXpDelta: 6, rewardOzziesDelta: 5, outcomeTag: 'manual-nav' },
      { id: 'reboot-link', label: 'Hard reboot uplink', summary: 'The map recovers but costs precious seconds.', rewardXpDelta: 4, rewardOzziesDelta: 4, outcomeTag: 'relinked' },
    ],
  },
];

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function createDeterministicRoll(seed) {
  const hash = hashString(seed);
  return (hash % 10_000) / 10_000;
}

function pickWeightedEncounter(seed) {
  const totalWeight = TRAVEL_ENCOUNTER_DEFINITIONS.reduce((sum, entry) => sum + Math.max(0, entry.weight ?? 0), 0);
  if (totalWeight <= 0) return null;
  const roll = createDeterministicRoll(seed) * totalWeight;
  let cursor = 0;
  for (const entry of TRAVEL_ENCOUNTER_DEFINITIONS) {
    cursor += Math.max(0, entry.weight ?? 0);
    if (roll <= cursor) {
      return entry;
    }
  }
  return TRAVEL_ENCOUNTER_DEFINITIONS[TRAVEL_ENCOUNTER_DEFINITIONS.length - 1] ?? null;
}

export function shouldTriggerCheckpointEncounter({
  checkpointNodeIndex,
  routeLength,
  travelPhase,
  runId,
}) {
  if (!Number.isInteger(checkpointNodeIndex) || !Number.isInteger(routeLength) || routeLength < 2) return false;
  if (checkpointNodeIndex <= 0 || checkpointNodeIndex >= routeLength - 1) return false;
  if (checkpointNodeIndex % 2 !== 0) return false;
  const chance = travelPhase === 'TRAVELING_OUTBOUND' ? 0.52 : 0.42;
  const roll = createDeterministicRoll(`${runId}|${travelPhase}|checkpoint|${checkpointNodeIndex}`);
  return roll < chance;
}

export function buildCheckpointEncounter({
  runId,
  boardDateKey,
  travelPhase,
  checkpointNodeIndex,
  nodeId,
}) {
  const definition = pickWeightedEncounter(`${runId}|${boardDateKey}|${travelPhase}|${nodeId}|${checkpointNodeIndex}`);
  if (!definition) return null;
  const startedAt = new Date().toISOString();
  return {
    encounterId: `${runId}_enc_${checkpointNodeIndex}_${Date.now()}`,
    definitionId: definition.id,
    title: definition.title,
    badge: definition.badge,
    prompt: definition.prompt,
    options: definition.options.map((option) => ({
      id: option.id,
      label: option.label,
      summary: option.summary,
      rewardXpDelta: option.rewardXpDelta ?? 0,
      rewardOzziesDelta: option.rewardOzziesDelta ?? 0,
      outcomeTag: option.outcomeTag ?? null,
    })),
    trigger: {
      travelPhase,
      checkpointNodeIndex,
      nodeId,
      triggeredAt: startedAt,
    },
    startedAt,
  };
}

export function resolveCheckpointEncounter(encounter, optionId) {
  const options = Array.isArray(encounter?.options) ? encounter.options : [];
  const selected = options.find((option) => option.id === optionId) ?? options[0] ?? null;
  if (!selected) {
    return {
      selectedOptionId: null,
      summary: 'Encounter resolved with no selectable option.',
      rewardXpDelta: 0,
      rewardOzziesDelta: 0,
      outcomeTag: null,
      resolvedAt: new Date().toISOString(),
    };
  }
  return {
    selectedOptionId: selected.id,
    summary: selected.summary,
    rewardXpDelta: selected.rewardXpDelta ?? 0,
    rewardOzziesDelta: selected.rewardOzziesDelta ?? 0,
    outcomeTag: selected.outcomeTag ?? null,
    resolvedAt: new Date().toISOString(),
  };
}
