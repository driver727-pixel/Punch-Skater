import { FieldValue } from 'firebase-admin/firestore';
import rateLimit from 'express-rate-limit';
import {
  ACTIVE_LEADERBOARD_SEASON,
  SEASONAL_SUBMISSION_COOLDOWN_MS,
  buildLeaderboardDeckSummary,
  computeCrewOzzies,
  computeCrewXp,
  computeDeckWorth,
  computeLifetimeLeaderboardScore,
  computeSeasonalRankScore,
  isSeasonActive,
  resolveSeasonalRewardTierIds,
  validateSeasonalDeck,
} from '../lib/seasonalLeaderboard.js';

const USERS_COLLECTION = 'users';
const PROFILES_COLLECTION = 'userProfiles';
const LIFETIME_LEADERBOARD_COLLECTION = 'leaderboard';
const SEASONS_COLLECTION = 'leaderboardSeasons';

const routeLocalLeaderboardRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many leaderboard submissions — please wait a moment and try again.' },
});

function buildUserDisplayName(caller, profile) {
  const profileName = typeof profile?.displayName === 'string' ? profile.displayName.trim() : '';
  if (profileName) return profileName;
  const tokenName = typeof caller?.name === 'string' ? caller.name.trim() : '';
  if (tokenName) return tokenName;
  const email = typeof caller?.email === 'string' ? caller.email.trim() : '';
  return email ? email.split('@')[0] : 'Skater';
}

function parseSubmittedAt(entry) {
  const candidates = [entry?.submittedAt, entry?.updatedAt];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const parsed = Date.parse(candidate);
    // Date.parse returns NaN for malformed strings; falling back to 0 keeps
    // downstream cooldown comparisons safe (NaN comparisons would silently
    // bypass the throttle).
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

async function countSeasonEntrants(adminDb, seasonId) {
  const entriesRef = adminDb.collection(SEASONS_COLLECTION).doc(seasonId).collection('entries');
  if (typeof entriesRef.count === 'function') {
    const snap = await entriesRef.count().get();
    return snap.data().count;
  }
  const snap = await entriesRef.select().get();
  return snap.size;
}

export function registerLeaderboardRoutes(app, {
  adminDb,
  leaderboardRateLimit,
  authenticateFirebaseUser,
}) {
  app.post('/api/leaderboard/submit', routeLocalLeaderboardRateLimit, leaderboardRateLimit, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Leaderboard submission is not configured on this server.' });
      return;
    }

    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    if (!isSeasonActive()) {
      res.status(409).json({ error: 'There is no active leaderboard season.' });
      return;
    }

    const uid = caller.uid;
    const deckId = typeof req.body?.deckId === 'string' ? req.body.deckId.trim() : '';
    if (!deckId) {
      res.status(400).json({ error: 'deckId is required.' });
      return;
    }

    try {
      const result = await adminDb.runTransaction(async (tx) => {
        const profileRef = adminDb.collection(PROFILES_COLLECTION).doc(uid);
        const deckRef = adminDb.collection(USERS_COLLECTION).doc(uid).collection('decks').doc(deckId);
        const seasonRef = adminDb.collection(SEASONS_COLLECTION).doc(ACTIVE_LEADERBOARD_SEASON.id);
        const seasonalEntryRef = seasonRef.collection('entries').doc(uid);
        const lifetimeEntryRef = adminDb.collection(LIFETIME_LEADERBOARD_COLLECTION).doc(uid);

        const [profileSnap, deckSnap, previousSeasonalSnap] = await Promise.all([
          tx.get(profileRef),
          tx.get(deckRef),
          tx.get(seasonalEntryRef),
        ]);

        if (!deckSnap.exists) {
          throw Object.assign(new Error('Selected deck was not found.'), { statusCode: 404 });
        }

        const previousSeasonalEntry = previousSeasonalSnap.exists ? previousSeasonalSnap.data() : null;
        const previousSubmittedAt = parseSubmittedAt(previousSeasonalEntry);
        if (previousSubmittedAt && Date.now() - previousSubmittedAt < SEASONAL_SUBMISSION_COOLDOWN_MS) {
          throw Object.assign(new Error('Seasonal entries can only be refreshed once every 4 hours.'), { statusCode: 429 });
        }

        const profile = profileSnap.exists ? profileSnap.data() : {};
        const deck = deckSnap.data();
        const cards = Array.isArray(deck?.cards) ? deck.cards : [];
        const validation = validateSeasonalDeck(cards);
        if (!validation.ok) {
          throw Object.assign(new Error(validation.error), { statusCode: 400 });
        }

        const summary = buildLeaderboardDeckSummary(cards);
        const crewOzzies = computeCrewOzzies(cards);
        const crewXp = computeCrewXp(cards);
        const leaderboardScore = computeLifetimeLeaderboardScore({
          deckPower: summary.deckPower,
          crewOzzies,
          crewXp,
        });
        const seasonalRankScore = computeSeasonalRankScore(summary.deckPower);
        const now = new Date().toISOString();
        const displayName = buildUserDisplayName(caller, profile);

        const baseEntry = {
          uid,
          displayName,
          deckId,
          deckName: typeof deck?.name === 'string' && deck.name.trim() ? deck.name.trim() : 'Unnamed Crew',
          cardCount: cards.length,
          deckPower: summary.deckPower,
          ozzies: computeDeckWorth(cards),
          crewOzzies,
          crewXp,
          leaderboardScore,
          strongestStat: summary.strongestStat,
          strongestStatTotal: summary.strongestStatTotal,
          synergyBonusPct: summary.synergyBonusPct,
          archetypeHint: summary.archetypeHint,
          updatedAt: now,
        };
        const seasonalEntry = {
          ...baseEntry,
          seasonId: ACTIVE_LEADERBOARD_SEASON.id,
          seasonLabel: ACTIVE_LEADERBOARD_SEASON.label,
          seasonalRankScore,
          fairPlay: {
            status: 'eligible',
            flags: [],
          },
          projectedRewardTierIds: resolveSeasonalRewardTierIds(1, 1),
          submittedAt: now,
        };

        tx.set(seasonRef, {
          ...ACTIVE_LEADERBOARD_SEASON,
          updatedAt: now,
          _ts: FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(lifetimeEntryRef, {
          ...baseEntry,
          _ts: FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(seasonalEntryRef, {
          ...seasonalEntry,
          _ts: FieldValue.serverTimestamp(),
        }, { merge: true });

        return {
          lifetimeEntry: baseEntry,
          seasonalEntry,
        };
      });

      const entrantCount = await countSeasonEntrants(adminDb, ACTIVE_LEADERBOARD_SEASON.id);
      const rankSnap = await adminDb
        .collection(SEASONS_COLLECTION)
        .doc(ACTIVE_LEADERBOARD_SEASON.id)
        .collection('entries')
        .where('seasonalRankScore', '>', result.seasonalEntry.seasonalRankScore)
        .count()
        .get();
      const rank = rankSnap.data().count + 1;
      result.seasonalEntry.projectedRewardTierIds = resolveSeasonalRewardTierIds(rank, entrantCount);
      await adminDb
        .collection(SEASONS_COLLECTION)
        .doc(ACTIVE_LEADERBOARD_SEASON.id)
        .collection('entries')
        .doc(caller.uid)
        .set({ projectedRewardTierIds: result.seasonalEntry.projectedRewardTierIds }, { merge: true });

      res.status(201).json(result);
    } catch (error) {
      console.error('Leaderboard submission error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to submit leaderboard Crew.' });
    }
  });
}
