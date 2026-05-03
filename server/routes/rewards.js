import { FieldValue } from 'firebase-admin/firestore';
import {
  DAILY_STREAK_COLLECTION,
  resolveDailyRewardState,
  toDateKey,
} from '../dailyRewards.js';

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
            currentStreak: streakState.currentStreak,
            longestStreak: streakState.longestStreak,
            totalClaims: streakState.totalClaims,
            lastClaimDate: streakState.lastClaimDate,
            rewardXp: streakState.reward.xp,
            rewardOzzies: streakState.reward.ozzies,
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
}
