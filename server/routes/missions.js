import { FieldValue } from 'firebase-admin/firestore';
import {
  HARD_CUTOUT_COUNTER_ID,
  buildMissionActiveRunState,
  createDailyMissionBoardPayload,
  evaluateMissionDeck,
  getMissionEncounter,
  getMissionEffectiveRewards,
  resolveMissionCounterChoice,
} from '../lib/missions.js';

const COLLECTION = 'missions';
const PROFILE_COLLECTION = 'userProfiles';
const SYSTEM = 'mission_board';
const SCHEMA_VERSION = 2;
const DEFAULT_FAILURE_LOCK_MINUTES = 15;

const MISSION_FAILURE_CONSEQUENCES = {
  Airaway: {
    state: 'in_shop',
    summary: 'took an injury timeout',
    label: 'Injury timeout',
  },
  Batteryville: {
    state: 'in_shop',
    summary: 'is stuck in a breakdown repair',
    label: 'Breakdown repair',
  },
  'The Grid': {
    state: 'impounded',
    summary: 'got hit with a trace arrest',
    label: 'Trace arrest',
  },
  Nightshade: {
    state: 'impounded',
    summary: 'was impounded in the Murk',
    label: 'Impound hold',
  },
  'The Forest': {
    state: 'in_shop',
    summary: 'needs rough-route repairs',
    label: 'Rough-route repair',
  },
  'Glass City': {
    state: 'impounded',
    summary: 'was arrested at the exchange',
    label: 'Exchange arrest',
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

function getProgression(profile) {
  return {
    missionXp: Number(profile?.missionXp) || 0,
    missionOzzies: Number(profile?.missionOzzies) || 0,
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

function buildMissionFailureRisk(mission, deck, now) {
  const cards = Array.isArray(deck?.cards) ? deck.cards : [];
  const nowMs = Date.parse(now);
  const riskedCard = cards.find((card) => isMissionCardReady(card, nowMs));
  if (!riskedCard?.id) return null;

  const consequence = MISSION_FAILURE_CONSEQUENCES[mission?.district] ?? {
    state: 'in_shop',
    summary: 'needs repairs after the wipeout',
    label: 'Mission fallout',
  };
  const repairMinutes = Number(riskedCard?.maintenance?.repairMinutes) || DEFAULT_FAILURE_LOCK_MINUTES;
  const lockMinutes = Math.min(Math.max(repairMinutes, 5), DEFAULT_FAILURE_LOCK_MINUTES);
  const recoveryAt = new Date(nowMs + lockMinutes * 60_000).toISOString();
  const cardName = typeof riskedCard?.identity?.name === 'string' && riskedCard.identity.name.trim()
    ? riskedCard.identity.name.trim()
    : 'One courier';
  const affectedCard = {
    ...riskedCard,
    maintenance: {
      ...(riskedCard.maintenance ?? {}),
      state: consequence.state,
      repairMinutes: lockMinutes,
      repairEndsAt: recoveryAt,
    },
  };

  return {
    affectedCard,
    summary: `${cardName} ${consequence.summary} for the next ${lockMinutes} minutes.`,
    detail: `${consequence.label}: ${cardName} is unavailable for the next ${lockMinutes} minutes.`,
    updatedDeck: {
      ...deck,
      cards: cards.map((card) => (card?.id === affectedCard.id ? affectedCard : card)),
      updatedAt: now,
    },
  };
}

export function registerMissionRoutes(app, {
  adminDb,
  missionRateLimit,
  authenticateFirebaseUser,
  districtWeatherService,
}) {
  app.use('/api/missions/board', missionRateLimit);
  app.use('/api/missions/run', missionRateLimit);

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
      const missionSnap = await adminDb.collection(COLLECTION).where('uid', '==', caller.uid).get();
      const existingBoardEntries = missionSnap.docs
        .map((doc) => doc.data())
        .filter((entry) => entry?.system === SYSTEM && entry?.schemaVersion === SCHEMA_VERSION);

      const now = new Date().toISOString();
      const dailyBoard = createDailyMissionBoardPayload(caller.uid, now);
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

      const profileSnap = await adminDb.collection(PROFILE_COLLECTION).doc(caller.uid).get();
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

          const resolution = resolveMissionCounterChoice(mission, activeRun, requestedChoiceId);
          const rewards = resolution.hardCutout
            ? {
              rewardXp: Math.max(0, mission.rewardXp + resolution.rewardXpDelta),
              rewardOzzies: Math.max(0, mission.rewardOzzies + resolution.rewardOzziesDelta),
            }
            : getMissionEffectiveRewards(mission, resolution.selectedOption?.id ?? null, weatherPayload);
          const nextProgression = {
            missionXp: progression.missionXp + rewards.rewardXp,
            missionOzzies: progression.missionOzzies + rewards.rewardOzzies,
          };
          const updatedMission = {
            ...mission,
            status: 'completed',
            progress: 1,
            selectedDeckId: deckId,
            selectedDeckName: evaluation.deckName,
            selectedForkOptionId: resolution.selectedOption?.id ?? mission.selectedForkOptionId,
            selectedCounterOptionId: resolution.selectedOption?.id ?? HARD_CUTOUT_COUNTER_ID,
            activeRun: {
              ...activeRun,
              phase: 'resolved',
              resolvedAt: now,
              selectedCounterOptionId: resolution.selectedOption?.id ?? HARD_CUTOUT_COUNTER_ID,
              summary: resolution.summary,
            },
            completedAt: now,
            lastRunAt: now,
            lastRunSucceeded: true,
            lastRunSummary: resolution.summary,
            lastRunFailureReasons: resolution.hardCutout ? ['Hard cutout: the crew got home, but the payout got clipped.'] : [],
            lastRunEffects: activeRun.statusEffects ?? evaluation.statusEffects ?? [],
            lastRunRewardXp: rewards.rewardXp,
            lastRunRewardOzzies: rewards.rewardOzzies,
            updatedAt: now,
          };

          tx.set(missionRef, updatedMission, { merge: true });
          tx.set(profileRef, {
            missionXp: nextProgression.missionXp,
            missionOzzies: nextProgression.missionOzzies,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          return {
            mission: updatedMission,
            evaluation: evaluateMissionDeck(deck, updatedMission, weatherPayload, resolution.selectedOption?.id ?? null),
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

        const liveRun = buildMissionActiveRunState(deck, mission, weatherPayload, now);
        if (!liveRun) {
          const rewards = getMissionEffectiveRewards(mission, null, weatherPayload);
          const nextProgression = {
            missionXp: progression.missionXp + rewards.rewardXp,
            missionOzzies: progression.missionOzzies + rewards.rewardOzzies,
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
            lastRunRewardXp: rewards.rewardXp,
            lastRunRewardOzzies: rewards.rewardOzzies,
            updatedAt: now,
          };

          tx.set(missionRef, updatedMission, { merge: true });
          tx.set(profileRef, {
            missionXp: nextProgression.missionXp,
            missionOzzies: nextProgression.missionOzzies,
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
