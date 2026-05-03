import { FieldValue } from 'firebase-admin/firestore';
import {
  createMissionBoardEntries,
  evaluateMissionDeck,
  getMissionEffectiveRewards,
  MISSION_BOARD_DEFINITIONS,
} from '../lib/missions.js';

const COLLECTION = 'missions';
const PROFILE_COLLECTION = 'userProfiles';
const SYSTEM = 'mission_board';
const SCHEMA_VERSION = 2;

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
      const desiredEntries = createMissionBoardEntries(caller.uid, now);
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
        missions: sortMissionBoardEntries(desiredEntries.map((entry) => ({
          ...(existingById.get(entry.id) ?? {}),
          ...entry,
        }))),
        progression: getProgression(profileSnap.data()),
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
    const requestedForkOptionId = typeof req.body?.forkOptionId === 'string' ? req.body.forkOptionId.trim() : '';
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
        if (requestedForkOptionId && !(mission.fork?.options ?? []).some((option) => option.id === requestedForkOptionId)) {
          throw Object.assign(new Error('Selected mission path is invalid.'), { statusCode: 400 });
        }

        const deck = deckSnap.data();
        const selectedForkOptionId = requestedForkOptionId || mission.selectedForkOptionId || mission.fork?.options?.[0]?.id || null;
        const evaluation = evaluateMissionDeck(deck, mission, weatherPayload, selectedForkOptionId);
        const rewards = getMissionEffectiveRewards(mission, selectedForkOptionId);
        const profile = profileSnap.exists ? profileSnap.data() : {};
        const progression = getProgression(profile);
        const now = new Date().toISOString();

        if (mission.status === 'completed') {
          return {
            mission,
            evaluation,
            progression,
            rewardGranted: false,
          };
        }

        if (!evaluation.eligible) {
          const updatedMission = {
            ...mission,
            selectedDeckId: deckId,
            selectedDeckName: evaluation.deckName,
            selectedForkOptionId,
            lastRunAt: now,
            lastRunSucceeded: false,
            lastRunSummary: evaluation.summary,
            lastRunFailureReasons: evaluation.results.filter((result) => !result.met).map((result) => result.detail),
            updatedAt: now,
          };
          tx.set(missionRef, updatedMission, { merge: true });
          return {
            mission: updatedMission,
            evaluation,
            progression,
            rewardGranted: false,
          };
        }

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
          selectedForkOptionId,
          completedAt: now,
          lastRunAt: now,
          lastRunSucceeded: true,
          lastRunSummary: evaluation.summary,
          lastRunFailureReasons: [],
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
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('Mission run error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to resolve mission.' });
    }
  });
}

export { MISSION_BOARD_DEFINITIONS };
