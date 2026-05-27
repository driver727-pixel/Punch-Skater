import { FieldValue } from 'firebase-admin/firestore';
import rateLimit from 'express-rate-limit';
import {
  HARD_CUTOUT_COUNTER_ID,
  applyMissionRivalRecord,
  buildMissionActiveRunState,
  createDailyMissionBoardPayload,
  evaluateMissionDeck,
  getMissionJoustTactics,
  getMissionEncounter,
  getMissionEffectiveRewards,
  resolveMissionCounterChoice,
} from '../lib/missions.js';
import { generateDistrictWorld } from '../lib/mazeGenerator.js';

const COLLECTION = 'missions';
const PROFILE_COLLECTION = 'userProfiles';
const SYSTEM = 'mission_board';
const SCHEMA_VERSION = 2;
const DEFAULT_FAILURE_LOCK_MINUTES = 15;
const FAL_PROXY_TIMEOUT_MS = 300_000;
const DEFAULT_FAL_IMAGE_MODEL_URL = 'https://fal.run/fal-ai/flux-lora';
const MISSION_MAP_IMAGE_SIZE = { width: 1024, height: 1024 };
const COURIER_TOKEN_IMAGE_SIZE = { width: 512, height: 512 };
const MISSIONS_BACKDROP_PROMPT_VERSION = 'missions-backdrop-v1';
const MISSIONS_SPRITE_PROMPT_VERSION = 'missions-sprite-v1';
const MIN_FAL_DIMENSION = 64;
const WORLD_COLLECTION = 'missionWorlds';
const ACTIVE_RUN_COLLECTION = 'missionActiveRuns';
const WORLD_VISUALS_COLLECTION = 'missionWorldVisuals';
const MAX_FAL_DIMENSION = 1536;
const MIN_INFERENCE_STEPS = 1;
const MAX_INFERENCE_STEPS = 50;
const MIN_GUIDANCE_SCALE = 1;
const MAX_GUIDANCE_SCALE = 20;

const MISSION_FAILURE_CONSEQUENCES = {
  Airaway: {
    kind: 'repair',
    state: 'in_shop',
    summary: 'took an injury timeout',
    label: 'Injury timeout',
    recapDisposition: 'lag',
  },
  Batteryville: {
    kind: 'repair',
    state: 'in_shop',
    summary: 'is stuck in a breakdown repair',
    label: 'Breakdown repair',
    recapDisposition: 'lag',
  },
  'The Grid': {
    kind: 'offline',
    state: 'in_shop',
    summary: 'was hacked offline on the trace',
    label: 'Trace hack',
    recapDisposition: 'offline',
  },
  Nightshade: {
    kind: 'impound',
    state: 'impounded',
    summary: 'was impounded in the Murk',
    label: 'Impound hold',
    recapDisposition: 'drop',
  },
  'The Forest': {
    kind: 'repair',
    state: 'in_shop',
    summary: 'needs rough-route repairs',
    label: 'Rough-route repair',
    recapDisposition: 'lag',
  },
  'Glass City': {
    kind: 'impound',
    state: 'impounded',
    summary: 'was arrested at the exchange',
    label: 'Exchange arrest',
    recapDisposition: 'drop',
  },
};

function sortMissionBoardEntries(missions) {
  return [...missions].sort((a, b) => {
    const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.title ?? '').localeCompare(String(b.title ?? ''));
  });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeMissionProxyText(value, fieldName, { required = false, maxLength = 4_000 } = {}) {
  const trimmed = typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
  if (!trimmed) {
    if (required) {
      throw Object.assign(new Error(`${fieldName} is required.`), { statusCode: 400 });
    }
    return undefined;
  }
  return trimmed;
}

function sanitizeMissionProxyInteger(value, { fieldName, minimum, maximum } = {}) {
  if (value == null || value === '') return undefined;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw Object.assign(new Error(`${fieldName} must be an integer between ${minimum} and ${maximum}.`), { statusCode: 400 });
  }
  return parsed;
}

function sanitizeMissionProxyNumber(value, { fieldName, minimum, maximum } = {}) {
  if (value == null || value === '') return undefined;
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw Object.assign(new Error(`${fieldName} must be a number between ${minimum} and ${maximum}.`), { statusCode: 400 });
  }
  return parsed;
}

function sanitizeMissionProxyImageSize(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string') return value.trim().slice(0, 64) || fallback;
  if (!isPlainObject(value)) {
    throw Object.assign(new Error('image_size must be a preset string or a width/height object.'), { statusCode: 400 });
  }
  const width = sanitizeMissionProxyInteger(value.width, {
    fieldName: 'image_size.width',
    minimum: MIN_FAL_DIMENSION,
    maximum: MAX_FAL_DIMENSION,
  });
  const height = sanitizeMissionProxyInteger(value.height, {
    fieldName: 'image_size.height',
    minimum: MIN_FAL_DIMENSION,
    maximum: MAX_FAL_DIMENSION,
  });
  if (!width || !height) {
    throw Object.assign(new Error('image_size.width and image_size.height are required.'), { statusCode: 400 });
  }
  return {
    width,
    height,
  };
}

function sanitizeMissionFalProxyBody(body = {}, defaults = {}) {
  if (!isPlainObject(body)) {
    throw Object.assign(new Error('Request body must be a JSON object.'), { statusCode: 400 });
  }

  return {
    prompt: sanitizeMissionProxyText(body.prompt, 'prompt', { required: true }),
    negative_prompt: sanitizeMissionProxyText(body.negative_prompt, 'negative_prompt'),
    seed: sanitizeMissionProxyInteger(body.seed, {
      fieldName: 'seed',
      minimum: 0,
      maximum: 4_294_967_295,
    }),
    image_size: sanitizeMissionProxyImageSize(body.image_size, defaults.imageSize),
    num_inference_steps: sanitizeMissionProxyInteger(body.num_inference_steps, {
      fieldName: 'num_inference_steps',
      minimum: MIN_INFERENCE_STEPS,
      maximum: MAX_INFERENCE_STEPS,
    }),
    guidance_scale: sanitizeMissionProxyNumber(body.guidance_scale, {
      fieldName: 'guidance_scale',
      minimum: MIN_GUIDANCE_SCALE,
      maximum: MAX_GUIDANCE_SCALE,
    }),
    fal_profile: 'default',
    output_format: 'png',
    enable_safety_checker: true,
    num_images: 1,
  };
}

async function parseFalProxyError(upstream) {
  const text = await upstream.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function extractFalImageUrl(payload) {
  if (!isPlainObject(payload)) return null;
  if (payload.image && typeof payload.image === 'object' && typeof payload.image.url === 'string') {
    return payload.image.url;
  }
  if (typeof payload.image_url === 'string') return payload.image_url;
  if (Array.isArray(payload.images) && payload.images[0] && typeof payload.images[0] === 'object' && typeof payload.images[0].url === 'string') {
    return payload.images[0].url;
  }
  return null;
}

function buildMissionsBackdropPrompt(world) {
  const districtSummary = Array.from(new Set(
    (world?.contracts ?? [])
      .map((contract) => typeof contract?.district === 'string' ? contract.district : null)
      .filter(Boolean),
  )).join(', ') || 'The Grid';
  return [
    'Top-down tactical district map backdrop for a neon courier mission interface.',
    `District blend: ${districtSummary}.`,
    `Daily seed context: ${world?.boardDateKey ?? 'undated mission board'}.`,
    'Show roads, intersections, route-friendly alleys, and landmark silhouettes with readable negative space for route overlays.',
    'Cyberpunk night mood with electric cyan and magenta accents, subtle scanline texture.',
    'No characters, no riders, no vehicles, no text labels, no logos, no watermark.',
    'PG, safe-for-work, high contrast, crisp details.',
  ].join(' ');
}

function pickSpriteSourceCard(decks, preferredDeckId) {
  const normalizedDecks = Array.isArray(decks) ? decks.filter(Boolean) : [];
  const preferredDeck = normalizedDecks.find((deck) => deck?.id === preferredDeckId);
  const orderedDecks = preferredDeck ? [preferredDeck, ...normalizedDecks.filter((deck) => deck?.id !== preferredDeckId)] : normalizedDecks;
  for (const deck of orderedDecks) {
    if (!Array.isArray(deck?.cards)) continue;
    const card = deck.cards.find((entry) => entry && typeof entry === 'object');
    if (card) return card;
  }
  return null;
}

function buildExtractionContract(card) {
  const sourceImageUrl = typeof card?.characterImageUrl === 'string' && card.characterImageUrl
    ? card.characterImageUrl
    : typeof card?.backgroundImageUrl === 'string' && card.backgroundImageUrl
      ? card.backgroundImageUrl
      : typeof card?.frameImageUrl === 'string' && card.frameImageUrl
        ? card.frameImageUrl
        : null;
  return {
    version: 'character-layer-contract-v1',
    sourceType: card ? 'forged_card' : 'fallback',
    sourceCardId: typeof card?.id === 'string' ? card.id : null,
    sourceImageUrl,
    extractionStatus: sourceImageUrl ? 'pass_through' : 'fallback_marker',
    subjectBounds: {
      x: 0.25,
      y: 0.1,
      width: 0.5,
      height: 0.8,
    },
  };
}

function buildMissionsSpritePrompt(card) {
  const identityName = typeof card?.identity?.name === 'string' && card.identity.name ? card.identity.name : 'District Courier';
  const crew = typeof card?.identity?.crew === 'string' && card.identity.crew ? card.identity.crew : 'independent crew';
  const archetype = typeof card?.prompts?.archetype === 'string' && card.prompts.archetype ? card.prompts.archetype : 'street runner';
  const style = typeof card?.prompts?.style === 'string' && card.prompts.style ? card.prompts.style : 'Street';
  return [
    'Single full-body courier sprite for map traversal UI.',
    `Character: ${identityName}, ${archetype}, crew ${crew}, outfit style ${style}.`,
    'Pose angled forward as if actively moving between checkpoints.',
    'Transparent or flat neutral background, centered silhouette, no props, no extra people, no text, no logo.',
    'Clean comic-book rendering, high readability at small sizes.',
    'SFW, PG rated.',
  ].join(' ');
}

function toGraphNodeMap(nodes) {
  const nodeById = new Map();
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (node?.id) nodeById.set(node.id, node);
  }
  return nodeById;
}

function graphEdgeKey(from, to) {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

function toGraphAdjacency(edges, nodeIds) {
  const adjacency = new Map();
  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, new Set());
  }
  for (const edge of Array.isArray(edges) ? edges : []) {
    if (!edge?.from || !edge?.to) continue;
    if (edge.from === edge.to || !nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    adjacency.get(edge.from).add(edge.to);
    adjacency.get(edge.to).add(edge.from);
  }
  return adjacency;
}

function manhattanDistance(a, b) {
  return Math.abs((Number(a?.x) || 0) - (Number(b?.x) || 0)) + Math.abs((Number(a?.y) || 0) - (Number(b?.y) || 0));
}

function findRouteAStar(nodes, edges, startId, goalId) {
  if (!startId || !goalId) return [];
  if (startId === goalId) return [startId];
  const nodeById = toGraphNodeMap(nodes);
  if (!nodeById.has(startId) || !nodeById.has(goalId)) return [];
  const nodeIds = new Set(nodeById.keys());
  const adjacency = toGraphAdjacency(edges, nodeIds);
  const openSet = new Set([startId]);
  const cameFrom = new Map();
  const gScore = new Map([[startId, 0]]);
  const fScore = new Map([[startId, manhattanDistance(nodeById.get(startId), nodeById.get(goalId))]]);

  while (openSet.size > 0) {
    let currentId = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidateId of openSet) {
      const score = fScore.get(candidateId) ?? Number.POSITIVE_INFINITY;
      if (score < bestScore) {
        bestScore = score;
        currentId = candidateId;
      }
    }
    if (!currentId) break;
    if (currentId === goalId) {
      const path = [goalId];
      let cursor = goalId;
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor);
        path.unshift(cursor);
      }
      return routeUsesValidEdges(edges, path, nodeIds) ? path : [];
    }
    openSet.delete(currentId);
    for (const neighborId of (adjacency.get(currentId) ?? [])) {
      if (!nodeById.has(neighborId)) continue;
      const tentativeG = (gScore.get(currentId) ?? Number.POSITIVE_INFINITY) + 1;
      if (tentativeG >= (gScore.get(neighborId) ?? Number.POSITIVE_INFINITY)) continue;
      cameFrom.set(neighborId, currentId);
      gScore.set(neighborId, tentativeG);
      fScore.set(neighborId, tentativeG + manhattanDistance(nodeById.get(neighborId), nodeById.get(goalId)));
      openSet.add(neighborId);
    }
  }
  return [];
}

function routeUsesValidEdges(edges, routeNodeIds, validNodeIds) {
  if (!Array.isArray(routeNodeIds) || routeNodeIds.length < 2) return true;
  const edgeSet = new Set();
  for (const edge of Array.isArray(edges) ? edges : []) {
    if (!edge?.from || !edge?.to) continue;
    if (edge.from === edge.to) continue;
    if (validNodeIds && (!validNodeIds.has(edge.from) || !validNodeIds.has(edge.to))) continue;
    edgeSet.add(graphEdgeKey(edge.from, edge.to));
  }
  for (let i = 1; i < routeNodeIds.length; i++) {
    const from = routeNodeIds[i - 1];
    const to = routeNodeIds[i];
    if (!from || !to || from === to) return false;
    if (validNodeIds && (!validNodeIds.has(from) || !validNodeIds.has(to))) return false;
    if (!edgeSet.has(graphEdgeKey(from, to))) return false;
  }
  return true;
}

function generateSeedFromString(value) {
  const basis = typeof value === 'string' ? value : String(value ?? '');
  return basis
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 4294967295;
}

async function requestFalImage({
  FAL_KEY,
  buildFalImageRequest,
  resolveFalProfile,
  normalizeFalProfile,
  body,
  profile = 'default',
  rawBody = false,
}) {
  const normalizedProfile = normalizeFalProfile(profile);
  const profileSettings = resolveFalProfile(normalizedProfile);
  const resolvedBody = rawBody
    ? body
    : await buildFalImageRequest({ ...body, fal_profile: normalizedProfile });
  const upstream = await fetch(profileSettings.modelUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${FAL_KEY}`,
    },
    body: JSON.stringify(resolvedBody),
    signal: AbortSignal.timeout(FAL_PROXY_TIMEOUT_MS),
  });
  if (!upstream.ok) {
    throw Object.assign(new Error(`fal.ai request failed with ${upstream.status}.`), { statusCode: upstream.status });
  }
  const payload = await upstream.json();
  const imageUrl = extractFalImageUrl(payload);
  if (!imageUrl) throw new Error('fal.ai response did not include an image URL.');
  return imageUrl;
}

async function handleMissionFalProxyRequest(req, res, {
  FAL_KEY,
  authenticateFirebaseUser,
  buildFalImageRequest,
  resolveFalProfile,
  normalizeFalProfile,
  imageSize,
  label,
}) {
  try {
    if (!FAL_KEY) {
      res.status(503).json({ error: `${label} generation is not configured.` });
      return;
    }

    await authenticateFirebaseUser(req);
    const sanitizedBody = sanitizeMissionFalProxyBody(req.body, { imageSize });
    const normalizedProfile = normalizeFalProfile('default');
    const profileSettings = resolveFalProfile(normalizedProfile);
    const upstream = await fetch(profileSettings.modelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${FAL_KEY}`,
      },
      body: JSON.stringify(await buildFalImageRequest(sanitizedBody)),
      signal: AbortSignal.timeout(FAL_PROXY_TIMEOUT_MS),
    });

    if (!upstream.ok) {
      res.status(upstream.status).json(await parseFalProxyError(upstream));
      return;
    }

    res.json(await upstream.json());
  } catch (error) {
    console.error(`${label} proxy error:`, error);
    res.status(error.statusCode ?? 500).json({ error: error.message ?? `${label} proxy failed.` });
  }
}

function getProgression(profile) {
  return {
    missionXp: Number(profile?.missionXp) || 0,
    missionOzzies: Number(profile?.missionOzzies) || 0,
    districtReputation: Number(profile?.districtReputation) || 0,
    defeatedRivalIds: Array.isArray(profile?.defeatedRivalIds)
      ? profile.defeatedRivalIds.filter((value) => typeof value === 'string')
      : [],
    codexUnlockIds: Array.isArray(profile?.codexUnlockIds)
      ? profile.codexUnlockIds.filter((value) => typeof value === 'string')
      : [],
    rivalRecords: profile?.rivalRecords && typeof profile.rivalRecords === 'object'
      ? Object.fromEntries(
        Object.entries(profile.rivalRecords).filter(([, value]) => value && typeof value === 'object'),
      )
      : {},
  };
}

function getMissionDefinitionFields(entry) {
  return {
    schemaVersion: entry.schemaVersion,
    definitionId: entry.definitionId,
    sortOrder: entry.sortOrder,
    title: entry.title,
    tagline: entry.tagline,
    description: entry.description,
    district: entry.district,
    rewardXp: entry.rewardXp,
    rewardOzzies: entry.rewardOzzies,
    requirements: entry.requirements,
    fork: entry.fork,
    encounter: entry.encounter,
  };
}

function isMissionBlindEntry(mission) {
  return mission?.isScanned === false;
}

function getMissionBlindEntryDetail(mission) {
  const title = typeof mission?.title === 'string' ? mission.title : 'this mission node';
  return `Blind entry: ${title} has not been scanned, so the courier route fails before the live counter can open.`;
}

function isMissionCardReady(card, nowMs = Date.now()) {
  const maintenance = card?.maintenance;
  if (!maintenance || maintenance.state === 'active') return true;
  if (!maintenance.repairEndsAt) return false;
  const repairEndsMs = Date.parse(maintenance.repairEndsAt);
  return Number.isFinite(repairEndsMs) && repairEndsMs <= nowMs;
}

function getMissionFailureConsequence(mission) {
  return MISSION_FAILURE_CONSEQUENCES[mission?.district] ?? {
    kind: 'repair',
    state: 'in_shop',
    summary: 'needs repairs after the wipeout',
    label: 'Mission fallout',
    recapDisposition: 'lag',
  };
}

function getMissionOutcomeCardName(card) {
  return typeof card?.identity?.name === 'string' && card.identity.name.trim()
    ? card.identity.name.trim()
    : 'One courier';
}

export function buildMissionCardOutcomeUpdate(mission, deck, now, options = {}) {
  const cards = Array.isArray(deck?.cards) ? deck.cards : [];
  const nowMs = Date.parse(now);
  const activeCardIds = new Set(Array.isArray(options.activeCardIds) ? options.activeCardIds : []);
  const candidateCardId = typeof options.cardId === 'string' && options.cardId.trim() ? options.cardId.trim() : null;
  const preferredCard = candidateCardId
    ? cards.find((card) => card?.id === candidateCardId)
    : null;
  const activeCard = activeCardIds.size > 0
    ? cards.find((card) => activeCardIds.has(card?.id) && isMissionCardReady(card, nowMs))
    : null;
  const riskedCard = preferredCard
    ?? activeCard
    ?? cards.find((card) => isMissionCardReady(card, nowMs));
  if (!riskedCard?.id) return null;

  const consequence = getMissionFailureConsequence(mission);
  const repairMinutes = Number(riskedCard?.maintenance?.repairMinutes) || DEFAULT_FAILURE_LOCK_MINUTES;
  const lockMinutes = Math.min(Math.max(repairMinutes, 5), DEFAULT_FAILURE_LOCK_MINUTES);
  const recoveryAt = new Date(nowMs + lockMinutes * 60_000).toISOString();
  const cardName = getMissionOutcomeCardName(riskedCard);
  const affectedCard = {
    ...riskedCard,
    maintenance: {
      ...(riskedCard.maintenance ?? {}),
      state: consequence.state,
      chargePct: consequence.kind === 'offline' ? 0 : (riskedCard?.maintenance?.chargePct ?? 100),
      repairMinutes: lockMinutes,
      repairEndsAt: recoveryAt,
    },
  };
  const summary = `${cardName} ${consequence.summary} for the next ${lockMinutes} minutes.`;
  const detail = `${consequence.label}: ${cardName} is unavailable for the next ${lockMinutes} minutes.`;

  return {
    affectedCard,
    summary,
    detail,
    outcomes: [{
      cardId: affectedCard.id,
      cardName,
      outcomeKind: consequence.kind,
      maintenanceState: consequence.state,
      recapDisposition: consequence.recapDisposition,
      label: consequence.label,
      summary,
      detail,
      repairEndsAt: recoveryAt,
    }],
    updatedDeck: {
      ...deck,
      cards: cards.map((card) => (card?.id === affectedCard.id ? affectedCard : card)),
      updatedAt: now,
    },
  };
}

export function buildMissionFailureRisk(mission, deck, now) {
  return buildMissionCardOutcomeUpdate(mission, deck, now);
}

export function buildMissionResolutionRisk(mission, deck, activeRun, resolution, now) {
  const negativeResolution = resolution?.hardCutout
    || (resolution?.joustResult && resolution.joustResult.outcome !== 'win');
  if (!negativeResolution) return null;
  return buildMissionCardOutcomeUpdate(mission, deck, now, {
    cardId: resolution?.joustResult?.playerCardId ?? null,
    activeCardIds: activeRun?.activeCardIds ?? [],
  });
}

export function registerMissionRoutes(app, {
  adminDb,
  missionRateLimit,
  authenticateFirebaseUser,
  districtWeatherService,
  FAL_KEY = '',
  buildFalImageRequest = async (body) => body,
  normalizeFalProfile = () => 'default',
  resolveFalProfile = () => ({ modelUrl: process.env.FAL_IMAGE_MODEL_URL || DEFAULT_FAL_IMAGE_MODEL_URL }),
}) {
  const missionFalProxyRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    skip: (req) => req?.method === 'OPTIONS',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many mission image requests — please wait a moment and try again.' },
    passOnStoreError: true,
  });
  const missionCheckpointRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    skip: (req) => req?.method === 'OPTIONS',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many mission checkpoint updates — please wait and retry.' },
    passOnStoreError: true,
  });

  app.use('/api/missions/board', missionRateLimit);
  app.use('/api/missions/run', missionRateLimit);

  const missionMapProxyOptions = {
    FAL_KEY,
    authenticateFirebaseUser,
    buildFalImageRequest,
    normalizeFalProfile,
    resolveFalProfile,
    imageSize: MISSION_MAP_IMAGE_SIZE,
    label: 'Mission map',
  };
  const courierTokenProxyOptions = {
    FAL_KEY,
    authenticateFirebaseUser,
    buildFalImageRequest,
    normalizeFalProfile,
    resolveFalProfile,
    imageSize: COURIER_TOKEN_IMAGE_SIZE,
    label: 'Mission courier token',
  };
  app.post('/api/missions/map', missionRateLimit, missionFalProxyRateLimit, async (req, res) => {
    await handleMissionFalProxyRequest(req, res, missionMapProxyOptions);
  });
  app.post('/api/missions/token', missionRateLimit, missionFalProxyRateLimit, async (req, res) => {
    await handleMissionFalProxyRequest(req, res, courierTokenProxyOptions);
  });
  app.post('/api/missions/courier-token', missionRateLimit, missionFalProxyRateLimit, async (req, res) => {
    await handleMissionFalProxyRequest(req, res, courierTokenProxyOptions);
  });

  app.get('/api/missions/board', async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Mission board is not configured on this server.' });
      return;
    }

    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    try {
      let weatherPayload = null;
      try {
        weatherPayload = districtWeatherService
          ? await districtWeatherService.getDistrictWeatherPayload()
          : null;
      } catch (error) {
        console.warn('Mission board proceeding without live weather payload:', error);
      }

      const [missionSnap, deckSnap, profileSnap] = await Promise.all([
        adminDb.collection(COLLECTION).where('uid', '==', caller.uid).get(),
        adminDb.collection('users').doc(caller.uid).collection('decks').get(),
        adminDb.collection(PROFILE_COLLECTION).doc(caller.uid).get(),
      ]);
      const existingBoardEntries = missionSnap.docs
        .map((doc) => doc.data())
        .filter((entry) => entry?.system === SYSTEM && entry?.schemaVersion === SCHEMA_VERSION);
      const decks = deckSnap.docs.map((doc) => doc.data()).filter(Boolean);

      const now = new Date().toISOString();
      const dailyBoard = createDailyMissionBoardPayload(caller.uid, now, { decks, weatherPayload });
      const desiredEntries = dailyBoard.missions;
      const existingById = new Map(existingBoardEntries.map((entry) => [entry.id, entry]));
      const missingEntries = desiredEntries.filter((entry) => !existingById.has(entry.id));
      const definitionUpdates = desiredEntries
        .filter((entry) => {
          const existing = existingById.get(entry.id);
          if (!existing) return false;
          return JSON.stringify(getMissionDefinitionFields(existing)) !== JSON.stringify(getMissionDefinitionFields(entry));
        })
        .map((entry) => ({ id: entry.id, data: getMissionDefinitionFields(entry) }));

      if (missingEntries.length > 0 || definitionUpdates.length > 0) {
        const batch = adminDb.batch();
        for (const entry of missingEntries) {
          batch.set(adminDb.collection(COLLECTION).doc(entry.id), entry, { merge: true });
        }
        for (const entry of definitionUpdates) {
          batch.set(adminDb.collection(COLLECTION).doc(entry.id), entry.data, { merge: true });
        }
        await batch.commit();
      }

      res.json({
        missions: sortMissionBoardEntries(desiredEntries.map((entry) => {
          const existing = existingById.get(entry.id);
          if (!existing) return entry;
          return { ...existing, ...getMissionDefinitionFields(entry) };
        })),
        progression: getProgression(profileSnap.data()),
        boardDateKey: dailyBoard.boardDateKey,
        dailyResetAt: dailyBoard.dailyResetAt,
        weeklyTheme: dailyBoard.weeklyTheme,
      });
    } catch (error) {
      console.error('Mission board load error:', error);
      res.status(500).json({ error: 'Failed to load mission board.' });
    }
  });

  app.post('/api/missions/run', async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Mission board is not configured on this server.' });
      return;
    }

    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    const missionId = typeof req.body?.missionId === 'string' ? req.body.missionId.trim() : '';
    const deckId = typeof req.body?.deckId === 'string' ? req.body.deckId.trim() : '';
    const requestedCounterOptionId = typeof req.body?.counterOptionId === 'string' ? req.body.counterOptionId.trim() : '';
    const requestedJoustTactic = typeof req.body?.joustTactic === 'string' ? req.body.joustTactic.trim() : '';
    const legacyForkOptionId = typeof req.body?.forkOptionId === 'string' ? req.body.forkOptionId.trim() : '';
    const requestedChoiceId = requestedCounterOptionId || legacyForkOptionId;
    if (!missionId || !deckId) {
      res.status(400).json({ error: 'missionId and deckId are required.' });
      return;
    }

    let weatherPayload = null;
    try {
      weatherPayload = districtWeatherService
        ? await districtWeatherService.getDistrictWeatherPayload()
        : null;
    } catch (error) {
      console.warn('Mission run using stale/no weather payload:', error);
    }

    try {
      const result = await adminDb.runTransaction(async (tx) => {
        const missionRef = adminDb.collection(COLLECTION).doc(missionId);
        const deckRef = adminDb.collection('users').doc(caller.uid).collection('decks').doc(deckId);
        const profileRef = adminDb.collection(PROFILE_COLLECTION).doc(caller.uid);
        const [missionSnap, deckSnap, profileSnap] = await Promise.all([
          tx.get(missionRef),
          tx.get(deckRef),
          tx.get(profileRef),
        ]);

        if (!missionSnap.exists) {
          throw Object.assign(new Error('Mission not found.'), { statusCode: 404 });
        }
        if (!deckSnap.exists) {
          throw Object.assign(new Error('Selected deck not found.'), { statusCode: 404 });
        }

        const mission = missionSnap.data();
        if (mission.uid !== caller.uid || mission.system !== SYSTEM || mission.schemaVersion !== SCHEMA_VERSION) {
          throw Object.assign(new Error('Mission not found.'), { statusCode: 404 });
        }
        const encounter = getMissionEncounter(mission);
        if (requestedChoiceId && requestedChoiceId !== HARD_CUTOUT_COUNTER_ID && !(encounter?.options ?? []).some((option) => option.id === requestedChoiceId)) {
          throw Object.assign(new Error('Selected live counter is invalid.'), { statusCode: 400 });
        }

        const deck = deckSnap.data();
        const evaluation = evaluateMissionDeck(deck, mission, weatherPayload);
        const profile = profileSnap.exists ? profileSnap.data() : {};
        const progression = getProgression(profile);
        const now = new Date().toISOString();
        const activeRun = mission.activeRun?.phase === 'event' ? mission.activeRun : null;

        if (mission.status === 'completed') {
          return {
            mission,
            evaluation,
            progression,
            rewardGranted: false,
          };
        }

        if (activeRun) {
          if (activeRun.deckId && activeRun.deckId !== deckId) {
            throw Object.assign(new Error('Resolve the live event with the deck that launched the run.'), { statusCode: 400 });
          }
          if (!requestedChoiceId) {
            return {
              mission,
              evaluation,
              progression,
              rewardGranted: false,
              awaitingChoice: true,
            };
          }
          if (requestedChoiceId !== HARD_CUTOUT_COUNTER_ID && !(activeRun.availableCounterOptionIds ?? []).includes(requestedChoiceId)) {
            throw Object.assign(new Error('The selected counter option is not available for your current hand. Take the hard cutout or pick an available response.'), { statusCode: 400 });
          }

          const selectedEncounterOption = encounter?.options?.find((option) => option.id === requestedChoiceId) ?? null;
          const availableJoustTactics = selectedEncounterOption?.encounterType === 'joust'
            ? getMissionJoustTactics(deck, activeRun)
            : [];
          if (
            selectedEncounterOption?.encounterType === 'joust'
            && requestedJoustTactic
            && !availableJoustTactics.includes(requestedJoustTactic)
          ) {
            throw Object.assign(new Error('The selected joust tactic is not available for your current rider.'), { statusCode: 400 });
          }

          const resolution = resolveMissionCounterChoice(
            mission,
            deck,
            activeRun,
            requestedChoiceId,
            requestedJoustTactic || availableJoustTactics[0] || null,
          );
          const baseRewards = getMissionEffectiveRewards(mission, null, weatherPayload);
          const rewards = {
            rewardXp: Math.max(0, baseRewards.rewardXp + resolution.rewardXpDelta),
            rewardOzzies: Math.max(0, baseRewards.rewardOzzies + resolution.rewardOzziesDelta),
          };
          const nextProgression = {
            missionXp: progression.missionXp + rewards.rewardXp,
            missionOzzies: progression.missionOzzies + rewards.rewardOzzies,
            districtReputation:
              progression.districtReputation + (resolution.joustResult?.districtReputationDelta ?? 0),
            defeatedRivalIds: resolution.joustResult?.rivalId
              ? [...new Set([...progression.defeatedRivalIds, resolution.joustResult.rivalId])]
              : progression.defeatedRivalIds,
            codexUnlockIds: resolution.joustResult?.loreUnlockIds?.length
              ? [...new Set([...progression.codexUnlockIds, ...resolution.joustResult.loreUnlockIds])]
              : progression.codexUnlockIds,
            rivalRecords: resolution.joustResult?.rivalId
              ? applyMissionRivalRecord(
                resolution.joustResult.rivalId,
                resolution.joustResult.outcome,
                progression.rivalRecords,
                now,
              )
              : progression.rivalRecords,
          };
          const resolutionRisk = buildMissionResolutionRisk(mission, deck, activeRun, resolution, now);
          const resolvedDeck = resolutionRisk?.updatedDeck ?? deck;
          const updatedMission = {
            ...mission,
            status: 'completed',
            progress: 1,
            selectedDeckId: deckId,
            selectedDeckName: evaluation.deckName,
            selectedForkOptionId: resolution.selectedOption?.id ?? mission.selectedForkOptionId ?? null,
            selectedCounterOptionId: resolution.selectedOption?.id ?? HARD_CUTOUT_COUNTER_ID,
            activeRun: {
              ...activeRun,
              phase: 'resolved',
              resolvedAt: now,
              selectedCounterOptionId: resolution.selectedOption?.id ?? HARD_CUTOUT_COUNTER_ID,
              selectedJoustTactic: resolution.joustResult?.playerTactic ?? null,
              summary: resolution.summary,
              storyBeats: resolution.storyBeats,
              boardPlaystyles: activeRun.boardPlaystyles ?? [],
              rivalPressure: resolution.rivalPressure ?? activeRun.rivalPressure ?? null,
            },
            completedAt: now,
            lastRunAt: now,
            lastRunSucceeded: true,
            lastRunSummary: resolution.summary,
            lastRunFailureReasons: resolution.hardCutout ? ['Hard cutout: the crew got home, but the payout got clipped.'] : [],
            lastRunEffects: activeRun.statusEffects ?? evaluation.statusEffects ?? [],
            lastRunCardOutcomes: resolutionRisk?.outcomes ?? [],
            lastRunRewardXp: rewards.rewardXp,
            lastRunRewardOzzies: rewards.rewardOzzies,
            lastRunJoustResult: resolution.joustResult,
            lastRunStoryBeats: resolution.storyBeats,
            lastRunRewardSignals: resolution.rewardSignals,
            lastRunBoardPlaystyles: activeRun.boardPlaystyles ?? [],
            lastRunRivalPressure: resolution.rivalPressure ?? activeRun.rivalPressure ?? null,
            updatedAt: now,
          };

          tx.set(missionRef, updatedMission, { merge: true });
          tx.set(profileRef, {
            missionXp: nextProgression.missionXp,
            missionOzzies: nextProgression.missionOzzies,
            districtReputation: nextProgression.districtReputation,
            defeatedRivalIds: nextProgression.defeatedRivalIds,
            codexUnlockIds: nextProgression.codexUnlockIds,
            rivalRecords: nextProgression.rivalRecords,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          if (resolutionRisk) {
            tx.set(deckRef, resolvedDeck, { merge: true });
            tx.set(
              adminDb.collection('users').doc(caller.uid).collection('cards').doc(resolutionRisk.affectedCard.id),
              resolutionRisk.affectedCard,
              { merge: true },
            );
          }

          return {
            mission: updatedMission,
            evaluation: evaluateMissionDeck(resolvedDeck, updatedMission, weatherPayload, resolution.selectedOption?.id ?? null),
            progression: nextProgression,
            rewardGranted: true,
          };
        }

        if (requestedChoiceId) {
          throw Object.assign(new Error('Launch the crew before trying to resolve the live event.'), { statusCode: 400 });
        }

        const blindEntry = isMissionBlindEntry(mission);
        if (blindEntry || !evaluation.eligible) {
          const failureRisk = buildMissionFailureRisk(mission, deck, now);
          const failureReasons = [
            ...evaluation.results.filter((result) => !result.met).map((result) => result.detail),
            ...(blindEntry ? [getMissionBlindEntryDetail(mission)] : []),
          ];
          const failureSummary = [
            ...(blindEntry ? ['Blind entry failed: scan the node before traveling there.'] : []),
            ...(!evaluation.eligible ? [evaluation.summary] : []),
            ...(failureRisk ? [failureRisk.summary] : []),
          ].join(' ');
          const updatedMission = {
            ...mission,
            selectedDeckId: deckId,
            selectedDeckName: evaluation.deckName,
            selectedCounterOptionId: null,
            activeRun: null,
            lastRunAt: now,
            lastRunSucceeded: false,
            lastRunSummary: failureSummary || evaluation.summary,
            lastRunFailureReasons: failureRisk ? [...failureReasons, failureRisk.detail] : failureReasons,
            lastRunEffects: evaluation.statusEffects ?? [],
            lastRunCardOutcomes: failureRisk?.outcomes ?? [],
            lastRunJoustResult: null,
            lastRunStoryBeats: [],
            lastRunRewardSignals: [],
            lastRunBoardPlaystyles: evaluation.boardPlaystyles ?? [],
            lastRunRivalPressure: null,
            updatedAt: now,
          };
          tx.set(missionRef, updatedMission, { merge: true });
          if (failureRisk) {
            tx.set(deckRef, failureRisk.updatedDeck, { merge: true });
            tx.set(
              adminDb.collection('users').doc(caller.uid).collection('cards').doc(failureRisk.affectedCard.id),
              failureRisk.affectedCard,
              { merge: true },
            );
          }
          return {
            mission: updatedMission,
            evaluation,
            progression,
            rewardGranted: false,
          };
        }

        const liveRun = buildMissionActiveRunState(deck, mission, weatherPayload, now, progression.rivalRecords);
        if (!liveRun) {
          const rewards = getMissionEffectiveRewards(mission, null, weatherPayload);
          const nextProgression = {
            missionXp: progression.missionXp + rewards.rewardXp,
            missionOzzies: progression.missionOzzies + rewards.rewardOzzies,
            districtReputation: progression.districtReputation,
            defeatedRivalIds: progression.defeatedRivalIds,
            codexUnlockIds: progression.codexUnlockIds,
            rivalRecords: progression.rivalRecords,
          };
          const updatedMission = {
            ...mission,
            status: 'completed',
            progress: 1,
            selectedDeckId: deckId,
            selectedDeckName: evaluation.deckName,
            selectedCounterOptionId: null,
            completedAt: now,
            lastRunAt: now,
            lastRunSucceeded: true,
            lastRunSummary: evaluation.summary,
            lastRunFailureReasons: [],
            lastRunEffects: evaluation.statusEffects ?? [],
            lastRunCardOutcomes: [],
            lastRunRewardXp: rewards.rewardXp,
            lastRunRewardOzzies: rewards.rewardOzzies,
            lastRunJoustResult: null,
            lastRunStoryBeats: [],
            lastRunRewardSignals: [],
            lastRunBoardPlaystyles: evaluation.boardPlaystyles ?? [],
            lastRunRivalPressure: null,
            updatedAt: now,
          };

          tx.set(missionRef, updatedMission, { merge: true });
          tx.set(profileRef, {
            missionXp: nextProgression.missionXp,
            missionOzzies: nextProgression.missionOzzies,
            districtReputation: nextProgression.districtReputation,
            defeatedRivalIds: nextProgression.defeatedRivalIds,
            codexUnlockIds: nextProgression.codexUnlockIds,
            rivalRecords: nextProgression.rivalRecords,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          return {
            mission: updatedMission,
            evaluation,
            progression: nextProgression,
            rewardGranted: true,
          };
        }

        const updatedMission = {
          ...mission,
          selectedDeckId: deckId,
          selectedDeckName: evaluation.deckName,
            selectedCounterOptionId: null,
            activeRun: liveRun,
            lastRunAt: now,
            lastRunSucceeded: false,
            lastRunSummary: liveRun.summary,
            lastRunFailureReasons: [],
            lastRunEffects: liveRun.statusEffects ?? evaluation.statusEffects ?? [],
            lastRunCardOutcomes: [],
            lastRunJoustResult: null,
            lastRunStoryBeats: liveRun.storyBeats ?? [],
            lastRunRewardSignals: [],
            lastRunBoardPlaystyles: liveRun.boardPlaystyles ?? evaluation.boardPlaystyles ?? [],
            lastRunRivalPressure: liveRun.rivalPressure ?? null,
            updatedAt: now,
          };
        tx.set(missionRef, updatedMission, { merge: true });
        return {
          mission: updatedMission,
          evaluation,
          progression,
          rewardGranted: false,
          awaitingChoice: true,
        };
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('Mission run error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to resolve mission.' });
    }
  });

  // ── District world ────────────────────────────────────────────────────────
  app.use('/api/missions/world', missionRateLimit);

  app.get('/api/missions/world', async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Mission world is not configured on this server.' });
      return;
    }

    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    try {
      const now = new Date().toISOString();
      const dailyBoard = createDailyMissionBoardPayload(caller.uid, now);
      const { boardDateKey, dailyResetAt, missions } = dailyBoard;

      const worldId = `${caller.uid}_${boardDateKey}`;
      const runId = `${worldId}_run`;

      const [worldSnap, runSnap, visualsSnap] = await Promise.all([
        adminDb.collection(WORLD_COLLECTION).doc(worldId).get(),
        adminDb.collection(ACTIVE_RUN_COLLECTION).doc(runId).get(),
        adminDb.collection(WORLD_VISUALS_COLLECTION).doc(worldId).get(),
      ]);

      let world;
      if (worldSnap.exists) {
        world = worldSnap.data();
      } else {
        world = generateDistrictWorld(caller.uid, boardDateKey, missions, dailyResetAt);
        await adminDb.collection(WORLD_COLLECTION).doc(worldId).set(world);
      }

      const activeRun = runSnap.exists ? runSnap.data() : null;
      const visuals = visualsSnap.exists ? visualsSnap.data() : null;

      res.json({ world, activeRun: activeRun ?? null, visuals: visuals ?? null });
    } catch (error) {
      console.error('Mission world load error:', error);
      res.status(500).json({ error: 'Failed to load district world.' });
    }
  });

  app.post('/api/missions/world/visuals', missionFalProxyRateLimit, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Mission world is not configured on this server.' });
      return;
    }
    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    try {
      const rawBoardDateKey = typeof req.body?.boardDateKey === 'string' ? req.body.boardDateKey.trim() : '';
      const boardDateKey = /^\d{4}-\d{2}-\d{2}$/.test(rawBoardDateKey) ? rawBoardDateKey : new Date().toISOString().slice(0, 10);
      const worldId = `${caller.uid}_${boardDateKey}`;
      const preferredDeckId = typeof req.body?.deckId === 'string' ? req.body.deckId.trim() : '';
      const visualsRef = adminDb.collection(WORLD_VISUALS_COLLECTION).doc(worldId);
      const [worldSnap, visualsSnap, decksSnap] = await Promise.all([
        adminDb.collection(WORLD_COLLECTION).doc(worldId).get(),
        visualsRef.get(),
        adminDb.collection('users').doc(caller.uid).collection('decks').get(),
      ]);
      if (!worldSnap.exists) {
        res.status(404).json({ error: 'District world not found. Load /api/missions/world first.' });
        return;
      }

      const world = worldSnap.data();
      const decks = decksSnap.docs.map((doc) => doc.data()).filter(Boolean);
      const card = pickSpriteSourceCard(decks, preferredDeckId);
      const extraction = buildExtractionContract(card);
      const spriteCacheKey = [
        caller.uid,
        extraction.sourceCardId ?? 'fallback',
        MISSIONS_SPRITE_PROMPT_VERSION,
      ].join(':');
      const backdropCacheKey = [
        caller.uid,
        boardDateKey,
        MISSIONS_BACKDROP_PROMPT_VERSION,
      ].join(':');

      const previous = visualsSnap.exists ? visualsSnap.data() : {};
      const cachedBackdropUrl = previous?.backdrop?.cacheKey === backdropCacheKey ? previous?.backdrop?.url ?? null : null;
      const cachedSpriteUrl = previous?.sprite?.cacheKey === spriteCacheKey ? previous?.sprite?.url ?? null : null;
      const visuals = {
        backdrop: {
          url: cachedBackdropUrl,
          cacheKey: backdropCacheKey,
          generatedAt: previous?.backdrop?.cacheKey === backdropCacheKey ? previous?.backdrop?.generatedAt : undefined,
          fallback: !cachedBackdropUrl,
        },
        sprite: {
          url: cachedSpriteUrl,
          cacheKey: spriteCacheKey,
          generatedAt: previous?.sprite?.cacheKey === spriteCacheKey ? previous?.sprite?.generatedAt : undefined,
          fallback: !cachedSpriteUrl,
        },
        extraction,
      };

      if (!visuals.backdrop.url && FAL_KEY) {
        try {
          const imageUrl = await requestFalImage({
            FAL_KEY,
            buildFalImageRequest,
            resolveFalProfile,
            normalizeFalProfile,
            body: {
              prompt: buildMissionsBackdropPrompt(world),
              seed: generateSeedFromString(worldId),
              image_size: MISSION_MAP_IMAGE_SIZE,
              thinking_level: 'high',
              enable_web_search: false,
              enable_safety_checker: true,
              num_images: 1,
              output_format: 'png',
            },
            profile: 'backdrop',
            rawBody: true,
          });
          visuals.backdrop = {
            url: imageUrl,
            cacheKey: backdropCacheKey,
            generatedAt: new Date().toISOString(),
            fallback: false,
          };
        } catch (error) {
          console.warn('Mission backdrop generation failed, using fallback:', error?.message ?? error);
        }
      }

      if (!visuals.sprite.url && FAL_KEY && card) {
        try {
          const imageUrl = await requestFalImage({
            FAL_KEY,
            buildFalImageRequest,
            resolveFalProfile,
            normalizeFalProfile,
            body: {
              prompt: buildMissionsSpritePrompt(card),
              seed: generateSeedFromString(spriteCacheKey),
              image_size: COURIER_TOKEN_IMAGE_SIZE,
              num_inference_steps: 24,
              guidance_scale: 3.8,
            },
            profile: 'character',
          });
          visuals.sprite = {
            url: imageUrl,
            cacheKey: spriteCacheKey,
            generatedAt: new Date().toISOString(),
            fallback: false,
          };
        } catch (error) {
          console.warn('Mission sprite generation failed, using fallback token:', error?.message ?? error);
        }
      }

      await visualsRef.set(visuals, { merge: true });
      res.json({ visuals });
    } catch (error) {
      console.error('Mission visuals error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to load mission visuals.' });
    }
  });

  app.post('/api/missions/world/run', async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Mission world is not configured on this server.' });
      return;
    }

    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    const contractId = typeof req.body?.contractId === 'string' ? req.body.contractId.trim() : '';
    // deckId is optional at this phase; deck selection UI is implemented in a later PR.
    const deckId = typeof req.body?.deckId === 'string' ? req.body.deckId.trim() : '';
    const deckName = typeof req.body?.deckName === 'string' ? req.body.deckName.trim() : 'Unknown Deck';
    if (!contractId) {
      res.status(400).json({ error: 'contractId is required.' });
      return;
    }

    try {
      const now = new Date().toISOString();
      const { boardDateKey } = createDailyMissionBoardPayload(caller.uid, now);
      const worldId = `${caller.uid}_${boardDateKey}`;
      const runId = `${worldId}_run`;

      const worldSnap = await adminDb.collection(WORLD_COLLECTION).doc(worldId).get();
      if (!worldSnap.exists) {
        res.status(404).json({ error: 'District world not found. Load /api/missions/world first.' });
        return;
      }

      const world = worldSnap.data();
      const contract = (world.contracts ?? []).find((c) => c.id === contractId);
      if (!contract) {
        res.status(404).json({ error: 'Contract not found in today\'s world.' });
        return;
      }
      if (contract.visibility === 'locked') {
        res.status(400).json({ error: 'This contract is locked and cannot be started yet.' });
        return;
      }
      const worldNodeIds = new Set(toGraphNodeMap(world.nodes ?? []).keys());
      const routeNodeIds = findRouteAStar(world.nodes ?? [], world.edges ?? [], 'workshop', contract.nodeId);
      if (routeNodeIds.length < 2 || !routeUsesValidEdges(world.edges ?? [], routeNodeIds, worldNodeIds)) {
        res.status(422).json({ error: 'Unable to calculate a valid route to this contract.' });
        return;
      }

      const runRef = adminDb.collection(ACTIVE_RUN_COLLECTION).doc(runId);
      const runSnap = await runRef.get();

      // If an active run already exists for today and is not complete/failed, return it.
      if (runSnap.exists) {
        const existing = runSnap.data();
        if (existing.phase !== 'complete' && existing.phase !== 'failed') {
          res.json({ activeRun: existing });
          return;
        }
      }

      const activeRun = {
        runId,
        uid: caller.uid,
        boardDateKey,
        phase: 'outbound',
        contractId,
        deckId,
        deckName,
        routeNodeIds,
        checkpointNodeIndex: 0,
        lastCheckpointAt: now,
        launchedAt: now,
        updatedAt: now,
      };

      await runRef.set(activeRun);
      res.status(201).json({ activeRun });
    } catch (error) {
      console.error('Mission run start error:', error);
      res.status(500).json({ error: 'Failed to start district run.' });
    }
  });

  app.post('/api/missions/world/checkpoint', missionCheckpointRateLimit, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Mission world is not configured on this server.' });
      return;
    }
    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    const runId = typeof req.body?.runId === 'string' ? req.body.runId.trim() : '';
    const nodeId = typeof req.body?.nodeId === 'string' ? req.body.nodeId.trim() : '';
    const checkpointNodeIndex = Number.isInteger(req.body?.checkpointNodeIndex) ? req.body.checkpointNodeIndex : null;
    if (!runId || !nodeId || checkpointNodeIndex == null) {
      res.status(400).json({ error: 'runId, nodeId, and checkpointNodeIndex are required.' });
      return;
    }

    try {
      const runRef = adminDb.collection(ACTIVE_RUN_COLLECTION).doc(runId);
      const snapshot = await runRef.get();
      if (!snapshot.exists) {
        res.status(404).json({ error: 'Run not found.' });
        return;
      }
      const activeRun = snapshot.data();
      if (activeRun.uid !== caller.uid) {
        res.status(403).json({ error: 'This run does not belong to the current user.' });
        return;
      }
      const routeNodeIds = Array.isArray(activeRun.routeNodeIds) ? activeRun.routeNodeIds : [];
      const currentIndex = Number.isInteger(activeRun.checkpointNodeIndex) ? activeRun.checkpointNodeIndex : 0;
      if (!routeNodeIds.length || checkpointNodeIndex !== currentIndex + 1 || checkpointNodeIndex >= routeNodeIds.length) {
        res.status(400).json({ error: 'Invalid checkpoint progression.' });
        return;
      }
      if (routeNodeIds[checkpointNodeIndex] !== nodeId) {
        res.status(400).json({ error: 'Checkpoint node does not match active route.' });
        return;
      }

      const now = new Date().toISOString();
      const nextRun = {
        ...activeRun,
        checkpointNodeIndex,
        lastCheckpointAt: now,
        updatedAt: now,
        phase: checkpointNodeIndex >= routeNodeIds.length - 1 ? 'at_poi' : activeRun.phase,
      };
      await runRef.set(nextRun, { merge: true });
      res.json({ activeRun: nextRun });
    } catch (error) {
      console.error('Mission checkpoint update error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to persist checkpoint.' });
    }
  });
}
