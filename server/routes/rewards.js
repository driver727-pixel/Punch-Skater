import { FieldValue } from 'firebase-admin/firestore';
import {
  buildDailyReward,
  DAILY_STREAK_COLLECTION,
  resolveDailyRewardState,
  toDateKey,
} from '../dailyRewards.js';
import {
  COLLECTION_MILESTONES,
  COLLECTION_REWARD_SCHEMA_VERSION,
  applyCollectionMilestoneClaim,
  defaultCollectionActivityStats,
  evaluateCollectionRewards,
  normalizeCollectionRewardsState,
} from '../lib/collectionRewards.js';

const PROFILE_COLLECTION = 'userProfiles';
const USER_COLLECTION = 'users';
const SIGNUP_BONUS_RARITY = 'Rare';

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeProgression(profile) {
  return {
    missionXp: Math.max(0, Number(profile?.missionXp) || 0),
    missionOzzies: Math.max(0, Number(profile?.missionOzzies) || 0),
  };
}

function validateSignupBonusCard(card) {
  if (!isPlainObject(card)) {
    return { ok: false, error: 'signupBonusCard payload is required.' };
  }
  if (typeof card.id !== 'string' || card.id.trim() === '') {
    return { ok: false, error: 'signupBonusCard.id must be a non-empty string.' };
  }
  if (card?.prompts?.rarity !== SIGNUP_BONUS_RARITY || card?.class?.rarity !== SIGNUP_BONUS_RARITY) {
    return { ok: false, error: 'Signup bonus cards must be Rare class cards.' };
  }
  return { ok: true };
}

function getCollectionActivityStats(profile, streak) {
  return defaultCollectionActivityStats({
    missions: profile?.completedMissionCount ?? profile?.missionCompletions,
    trades: profile?.completedTradeCount ?? profile?.tradeCount,
    battles: profile?.battleParticipationCount ?? profile?.battleCount,
    dailyStreak: streak?.longestStreak ?? streak?.currentStreak,
    eventParticipations: profile?.eventParticipationCount,
  });
}

async function readUserCards(adminDb, uid) {
  const snap = await adminDb.collection(USER_COLLECTION).doc(uid).collection('cards').get();
  return snap.docs.map((docSnap) => docSnap.data()).filter((card) => isPlainObject(card));
}

function buildCollectionRewardsPayload({ cards, profile, streak }) {
  const state = normalizeCollectionRewardsState(profile?.collectionRewards);
  const activity = getCollectionActivityStats(profile, streak);
  return {
    schemaVersion: COLLECTION_REWARD_SCHEMA_VERSION,
    evaluation: evaluateCollectionRewards(cards, state, activity),
  };
}

export function registerRewardRoutes(app, {
  adminDb,
  rewardRateLimit,
  authenticateFirebaseUser,
}) {
  async function authenticateRewardCaller(req, res, next) {
    try {
      req.caller = await authenticateFirebaseUser(req);
      next();
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
    }
  }

  app.post('/api/player-rewards/sync', rewardRateLimit, authenticateRewardCaller, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Player rewards are not configured on this server.' });
      return;
    }

    const signupBonusCard = req.body?.signupBonusCard;
    const todayDateKey = toDateKey();
    const caller = req.caller;

    try {
      const result = await adminDb.runTransaction(async (tx) => {
        const profileRef = adminDb.collection(PROFILE_COLLECTION).doc(caller.uid);
        const streakRef = adminDb.collection(DAILY_STREAK_COLLECTION).doc(caller.uid);
        const [profileSnap, streakSnap] = await Promise.all([
          tx.get(profileRef),
          tx.get(streakRef),
        ]);

        const profile = profileSnap.exists ? profileSnap.data() : {};
        const streak = streakSnap.exists ? streakSnap.data() : {};
        const progression = normalizeProgression(profile);

        let signupBonusGranted = false;
        let signupBonusCardId = typeof profile?.signupBonusCardId === 'string' ? profile.signupBonusCardId : '';

        if (!profile?.signupRareCardClaimedAt) {
          const validation = validateSignupBonusCard(signupBonusCard);
          if (!validation.ok) {
            throw Object.assign(new Error(validation.error), { statusCode: 400 });
          }
          signupBonusCardId = signupBonusCard.id;
          tx.set(
            adminDb.collection(USER_COLLECTION).doc(caller.uid).collection('cards').doc(signupBonusCardId),
            signupBonusCard,
            { merge: false },
          );
          tx.set(profileRef, {
            signupRareCardClaimedAt: FieldValue.serverTimestamp(),
            signupBonusCardId,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          signupBonusGranted = true;
        }

        const streakState = resolveDailyRewardState(streak, todayDateKey);
        let nextProgression = progression;
        if (!streakState.claimedToday) {
          nextProgression = {
            missionXp: progression.missionXp + streakState.reward.xp,
            missionOzzies: progression.missionOzzies + streakState.reward.ozzies,
          };
          tx.set(streakRef, {
            uid: caller.uid,
            currentStreak: streakState.currentStreak,
            longestStreak: streakState.longestStreak,
            lastClaimDate: streakState.lastClaimDate,
            totalClaims: streakState.totalClaims,
            updatedAt: todayDateKey,
            _updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          tx.set(profileRef, {
            missionXp: nextProgression.missionXp,
            missionOzzies: nextProgression.missionOzzies,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        return {
          signupBonusGranted,
          signupBonusCardId,
          dailyReward: {
            claimed: !streakState.claimedToday,
            claimedToday: true,
            currentStreak: streakState.currentStreak,
            longestStreak: streakState.longestStreak,
            totalClaims: streakState.totalClaims,
            lastClaimDate: streakState.lastClaimDate,
            rewardXp: streakState.reward.xp,
            rewardOzzies: streakState.reward.ozzies,
            nextRewardXp: buildDailyReward(streakState.currentStreak + 1).xp,
            nextRewardOzzies: buildDailyReward(streakState.currentStreak + 1).ozzies,
          },
          progression: nextProgression,
        };
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('Player reward sync error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to sync player rewards.' });
    }
  });

  // lgtm[js/missing-rate-limiting] rewardRateLimit is applied before authentication and route handling.
  app.get('/api/collection-rewards', rewardRateLimit, authenticateRewardCaller, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Collection rewards are not configured on this server.' });
      return;
    }

    try {
      const caller = req.caller;
      const [profileSnap, streakSnap, cards] = await Promise.all([
        adminDb.collection(PROFILE_COLLECTION).doc(caller.uid).get(),
        adminDb.collection(DAILY_STREAK_COLLECTION).doc(caller.uid).get(),
        readUserCards(adminDb, caller.uid),
      ]);
      const profile = profileSnap.exists ? profileSnap.data() : {};
      const streak = streakSnap.exists ? streakSnap.data() : {};
      res.status(200).json(buildCollectionRewardsPayload({ cards, profile, streak }));
    } catch (error) {
      console.error('Collection reward preview error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to load collection rewards.' });
    }
  });

  // lgtm[js/missing-rate-limiting] rewardRateLimit is applied before authentication and route handling.
  app.post('/api/collection-rewards/claim', rewardRateLimit, authenticateRewardCaller, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Collection rewards are not configured on this server.' });
      return;
    }

    const milestoneId = typeof req.body?.milestoneId === 'string' ? req.body.milestoneId.trim() : '';
    const milestone = COLLECTION_MILESTONES.find((entry) => entry.id === milestoneId);
    if (!milestone) {
      res.status(400).json({ error: 'Unknown collection reward milestone.' });
      return;
    }

    try {
      const caller = req.caller;
      const [profileSnap, streakSnap, cards] = await Promise.all([
        adminDb.collection(PROFILE_COLLECTION).doc(caller.uid).get(),
        adminDb.collection(DAILY_STREAK_COLLECTION).doc(caller.uid).get(),
        readUserCards(adminDb, caller.uid),
      ]);
      const profile = profileSnap.exists ? profileSnap.data() : {};
      const streak = streakSnap.exists ? streakSnap.data() : {};
      const activity = getCollectionActivityStats(profile, streak);
      const evaluation = evaluateCollectionRewards(cards, profile?.collectionRewards, activity);
      const progress = evaluation.milestones.find((entry) => entry.milestone.id === milestoneId);

      if (!progress?.eligible) {
        res.status(403).json({ error: 'Collection reward milestone is not complete yet.' });
        return;
      }

      const result = await adminDb.runTransaction(async (tx) => {
        const profileRef = adminDb.collection(PROFILE_COLLECTION).doc(caller.uid);
        const nextProfileSnap = await tx.get(profileRef);
        const nextProfile = nextProfileSnap.exists ? nextProfileSnap.data() : {};
        const claim = applyCollectionMilestoneClaim(nextProfile?.collectionRewards, milestoneId);

        if (claim.alreadyClaimed) {
          return {
            alreadyClaimed: true,
            rewards: [],
            state: claim.state,
          };
        }

        tx.set(profileRef, {
          collectionRewards: claim.state,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(
          adminDb.collection(USER_COLLECTION).doc(caller.uid).collection('rewardClaims').doc(milestoneId),
          {
            milestoneId,
            rewardIds: claim.rewards.map((reward) => reward.id),
            rewardTypes: claim.rewards.map((reward) => reward.kind),
            source: 'collection_rewards',
            seasonId: milestone.seasonal ? `collection-v${COLLECTION_REWARD_SCHEMA_VERSION}` : null,
            grantedAt: FieldValue.serverTimestamp(),
          },
          { merge: false },
        );

        return {
          alreadyClaimed: false,
          rewards: claim.rewards,
          state: claim.state,
        };
      });

      res.status(200).json({
        schemaVersion: COLLECTION_REWARD_SCHEMA_VERSION,
        claimed: !result.alreadyClaimed,
        alreadyClaimed: result.alreadyClaimed,
        milestoneId,
        rewards: result.rewards,
        evaluation: evaluateCollectionRewards(cards, result.state, activity),
      });
    } catch (error) {
      console.error('Collection reward claim error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to claim collection reward.' });
    }
  });
}
