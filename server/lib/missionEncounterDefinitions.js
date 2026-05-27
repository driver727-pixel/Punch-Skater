const TRAVEL_ENCOUNTER_VERSION = 'travel-encounters-v1';
const DEFAULT_NONE_WEIGHT = 120;
const CONTRACT_ENCOUNTER_WEIGHT = 90;

const TRAVEL_ENCOUNTER_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'street-static',
    badge: '⚡',
    prompt: 'A burst of street static scrambles the route beacon at this checkpoint.',
    threat: 'Signal interference',
    weight: 24,
    legs: ['outbound', 'inbound'],
    options: Object.freeze([
      Object.freeze({
        id: 'steady-push',
        label: 'Steady push',
        description: 'Keep the pace controlled and hold the plotted line.',
        rewardXpDelta: 5,
        rewardOzziesDelta: 0,
        successSummary: 'The crew held the line through the static.',
        failureSummary: 'The static cost a little momentum, but the run stayed intact.',
      }),
      Object.freeze({
        id: 'hard-cut',
        label: 'Hard cut',
        description: 'Cut across the noise and chase a faster reconnect.',
        rewardXpDelta: 10,
        rewardOzziesDelta: 5,
        successSummary: 'The hard cut reconnected the route beacon cleanly.',
        failureSummary: 'The cutout got rough, but no card damage was applied.',
      }),
    ]),
  }),
  Object.freeze({
    id: 'rival-spotter',
    badge: '👁',
    prompt: 'A rival spotter tails the checkpoint and tries to read your return path.',
    threat: 'Rival pressure',
    weight: 18,
    legs: ['outbound', 'inbound'],
    options: Object.freeze([
      Object.freeze({
        id: 'ghost-line',
        label: 'Ghost line',
        description: 'Drop visibility and continue without giving up the contract route.',
        rewardXpDelta: 8,
        rewardOzziesDelta: 0,
        successSummary: 'The spotter lost the crew in the side glow.',
        failureSummary: 'The spotter kept pace briefly, then peeled off before the next leg.',
      }),
      Object.freeze({
        id: 'bait-and-roll',
        label: 'Bait and roll',
        description: 'Show a false route and roll back to the checkpoint line.',
        rewardXpDelta: 4,
        rewardOzziesDelta: 8,
        successSummary: 'The bait route bought a clean lane and a little extra cash.',
        failureSummary: 'The bait route was messy, but the run stayed resumable.',
      }),
    ]),
  }),
  Object.freeze({
    id: 'market-squeeze',
    badge: '¤',
    prompt: 'Checkpoint crowds squeeze the lane while a vendor offers a shortcut marker.',
    threat: 'Crowded lane',
    weight: 14,
    legs: ['outbound'],
    options: Object.freeze([
      Object.freeze({
        id: 'buy-marker',
        label: 'Buy the marker',
        description: 'Take the local marker and keep the outbound line readable.',
        rewardXpDelta: 0,
        rewardOzziesDelta: -5,
        successSummary: 'The marker kept the outbound route readable.',
        failureSummary: 'The marker was overpriced, but it did not harm the card.',
      }),
      Object.freeze({
        id: 'thread-crowd',
        label: 'Thread the crowd',
        description: 'Slip through the crowd and protect the payout.',
        rewardXpDelta: 8,
        rewardOzziesDelta: 5,
        successSummary: 'The crew threaded the crowd without losing the package.',
        failureSummary: 'The crowd slowed the push, but the run survived.',
      }),
    ]),
  }),
  Object.freeze({
    id: 'return-surge',
    badge: '↩',
    prompt: 'The homebound lane surges with cross traffic as the Workshop beacon comes back online.',
    threat: 'Return surge',
    weight: 16,
    legs: ['inbound'],
    options: Object.freeze([
      Object.freeze({
        id: 'hold-return-line',
        label: 'Hold return line',
        description: 'Keep the Workshop vector stable and accept the slower lane.',
        rewardXpDelta: 4,
        rewardOzziesDelta: 0,
        successSummary: 'The return line stayed stable through the surge.',
        failureSummary: 'The return surge slowed the crew without adding penalties.',
      }),
      Object.freeze({
        id: 'surf-surge',
        label: 'Surf the surge',
        description: 'Ride the traffic wave for a cleaner final approach.',
        rewardXpDelta: 10,
        rewardOzziesDelta: 4,
        successSummary: 'The crew surfed the surge into a cleaner home lane.',
        failureSummary: 'The surge got choppy, but the Workshop route remained intact.',
      }),
    ]),
  }),
]);

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeLeg(phase) {
  if (phase === 'TRAVELING_INBOUND') return 'inbound';
  if (phase === 'TRAVELING_OUTBOUND') return 'outbound';
  return null;
}

function sanitizeEncounterOption(option) {
  return {
    id: String(option.id),
    label: String(option.label ?? option.id),
    description: String(option.description ?? ''),
    ...(option.encounterType && { encounterType: option.encounterType }),
    ...(Array.isArray(option.requirements) && { requirements: cloneJson(option.requirements) }),
    ...(Array.isArray(option.requiredTags) && { requiredTags: cloneJson(option.requiredTags) }),
    ...(Number.isFinite(option.minimumCounterPower) && { minimumCounterPower: option.minimumCounterPower }),
    ...(Number.isFinite(option.rewardXpDelta) && { rewardXpDelta: option.rewardXpDelta }),
    ...(Number.isFinite(option.rewardOzziesDelta) && { rewardOzziesDelta: option.rewardOzziesDelta }),
    ...(option.joustDifficulty && { joustDifficulty: option.joustDifficulty }),
    ...(option.joustPrompt && { joustPrompt: String(option.joustPrompt) }),
    ...(option.available !== undefined && { available: option.available !== false }),
    ...(Number.isFinite(option.currentPower) && { currentPower: option.currentPower }),
    ...(option.successSummary && { successSummary: String(option.successSummary) }),
    ...(option.failureSummary && { failureSummary: String(option.failureSummary) }),
  };
}

export function sanitizeEncounterContract(encounter) {
  if (!encounter || !Array.isArray(encounter.options) || encounter.options.length === 0) return null;
  const options = encounter.options
    .filter((option) => option && typeof option.id === 'string')
    .map(sanitizeEncounterOption);
  if (options.length === 0) return null;
  return {
    id: String(encounter.id),
    badge: String(encounter.badge ?? '⚡'),
    prompt: String(encounter.prompt ?? 'An unexpected checkpoint encounter interrupts the route.'),
    threat: String(encounter.threat ?? 'Checkpoint pressure'),
    options,
  };
}

function buildGenericCandidates(leg) {
  return TRAVEL_ENCOUNTER_DEFINITIONS
    .filter((definition) => definition.legs.includes(leg))
    .map((definition) => ({
      weight: definition.weight,
      encounter: sanitizeEncounterContract(definition),
    }))
    .filter((candidate) => candidate.encounter);
}

export function buildWeightedEncounterCandidates({ leg, contractEncounter = null } = {}) {
  const candidates = [];
  const sanitizedContractEncounter = sanitizeEncounterContract(contractEncounter);
  if (sanitizedContractEncounter) {
    candidates.push({
      weight: CONTRACT_ENCOUNTER_WEIGHT,
      encounter: sanitizedContractEncounter,
    });
  }
  candidates.push(...buildGenericCandidates(leg));
  return candidates.filter((candidate) => candidate.weight > 0);
}

export function selectWeightedEncounter(candidates, seed, noneWeight = DEFAULT_NONE_WEIGHT) {
  const weighted = [
    ...candidates.filter((candidate) => candidate?.encounter && Number(candidate.weight) > 0),
    ...(noneWeight > 0 ? [{ weight: noneWeight, encounter: null }] : []),
  ];
  const total = weighted.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (total <= 0) return null;
  let roll = hashString(seed) % total;
  for (const candidate of weighted) {
    if (roll < candidate.weight) return candidate.encounter ? cloneJson(candidate.encounter) : null;
    roll -= candidate.weight;
  }
  return null;
}

function hasEncounterForLeg(activeRun, leg) {
  const history = Array.isArray(activeRun?.encounterHistory) ? activeRun.encounterHistory : [];
  return history.some((entry) => entry?.leg === leg);
}

export function pickCheckpointEncounter({
  activeRun,
  world,
  contract,
  nodeId,
  checkpointNodeIndex,
  routeNodeIds,
  noneWeight = DEFAULT_NONE_WEIGHT,
} = {}) {
  const leg = normalizeLeg(activeRun?.phase);
  if (!leg || !nodeId || !Array.isArray(routeNodeIds) || routeNodeIds.length < 3) return null;
  if (checkpointNodeIndex <= 0 || checkpointNodeIndex >= routeNodeIds.length - 1) return null;
  if (activeRun?.encounter && !activeRun.encounter.resolvedAt) return null;
  if (hasEncounterForLeg(activeRun, leg)) return null;

  const triggerKey = `${activeRun.runId}:${leg}:${checkpointNodeIndex}:${nodeId}`;
  const history = Array.isArray(activeRun?.encounterHistory) ? activeRun.encounterHistory : [];
  if (history.some((entry) => entry?.triggerKey === triggerKey)) return null;

  const candidates = buildWeightedEncounterCandidates({
    leg,
    contractEncounter: contract?.encounter ?? null,
  });
  const seed = [
    TRAVEL_ENCOUNTER_VERSION,
    world?.worldId ?? activeRun?.boardDateKey ?? '',
    activeRun?.runId ?? '',
    contract?.id ?? activeRun?.contractId ?? '',
    nodeId,
    checkpointNodeIndex,
    leg,
  ].join('|');
  const encounter = selectWeightedEncounter(candidates, seed, noneWeight);
  return encounter ? { encounter, leg, triggerKey } : null;
}

export function buildEncounterResultPayload(encounter, choiceId, resolvedAt) {
  const contract = sanitizeEncounterContract(encounter);
  if (!contract) {
    const error = new Error('Encounter contract is unavailable.');
    error.statusCode = 409;
    throw error;
  }
  const option = contract.options.find((candidate) => candidate.id === choiceId);
  if (!option) {
    const error = new Error('Encounter choice is not valid for this checkpoint.');
    error.statusCode = 400;
    throw error;
  }
  if (option.available === false) {
    const error = new Error('Encounter choice is not currently available.');
    error.statusCode = 409;
    throw error;
  }
  return {
    resultType: 'travel_encounter',
    encounterId: contract.id,
    choiceId: option.id,
    label: option.label,
    resolvedAt,
    success: true,
    summary: option.successSummary ?? `${option.label} resolved the checkpoint encounter.`,
    rewardXpDelta: Number(option.rewardXpDelta) || 0,
    rewardOzziesDelta: Number(option.rewardOzziesDelta) || 0,
  };
}

export function buildPoiResultPayload(contract, choiceId, resolvedAt) {
  const fork = contract?.fork;
  if (!fork?.options?.length) {
    if (choiceId !== 'default') {
      const error = new Error('POI choice is not valid for this contract.');
      error.statusCode = 400;
      throw error;
    }
    return {
      resultType: 'poi_resolution',
      contractId: contract?.id ?? null,
      choiceId,
      label: 'Begin return',
      resolvedAt,
      success: true,
      summary: 'Contract POI resolved. Begin the inbound trip to the Workshop.',
      rewardXpDelta: 0,
      rewardOzziesDelta: 0,
    };
  }

  const option = fork.options.find((candidate) => candidate.id === choiceId);
  if (!option) {
    const error = new Error('POI choice is not valid for this contract.');
    error.statusCode = 400;
    throw error;
  }
  return {
    resultType: 'poi_resolution',
    contractId: contract.id,
    choiceId: option.id,
    label: option.label,
    resolvedAt,
    success: true,
    summary: `${option.label} resolved the contract fork. Return to the Workshop to bank results.`,
    rewardXpDelta: Number(option.rewardXpDelta) || 0,
    rewardOzziesDelta: Number(option.rewardOzziesDelta) || 0,
  };
}
