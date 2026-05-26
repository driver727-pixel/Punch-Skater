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

const COLLECTION = 'missions';
const PROFILE_COLLECTION = 'userProfiles';
const SYSTEM = 'mission_board';
const SCHEMA_VERSION = 2;
const DEFAULT_FAILURE_LOCK_MINUTES = 15;
const FAL_PROXY_TIMEOUT_MS = 300_000;
const DEFAULT_FAL_IMAGE_MODEL_URL = 'https://fal.run/fal-ai/flux-lora';
const MISSION_MAP_IMAGE_SIZE = { width: 1024, height: 1024 };
const COURIER_TOKEN_IMAGE_SIZE = { width: 512, height: 512 };
const MIN_FAL_DIMENSION = 64;
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

        if (!evaluation.eligible) {
          const failureRisk = buildMissionFailureRisk(mission, deck, now);
          const failureReasons = evaluation.results.filter((result) => !result.met).map((result) => result.detail);
          const updatedMission = {
            ...mission,
            selectedDeckId: deckId,
            selectedDeckName: evaluation.deckName,
            selectedCounterOptionId: null,
            activeRun: null,
            lastRunAt: now,
            lastRunSucceeded: false,
            lastRunSummary: failureRisk ? `${evaluation.summary} ${failureRisk.summary}` : evaluation.summary,
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
}
