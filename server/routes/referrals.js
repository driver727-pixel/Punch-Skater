const REFERRAL_CLAIMS_COLLECTION = 'referralClaims';
const REFERRAL_STATS_COLLECTION = 'referralStats';

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function registerReferralRoutes(app, {
  adminDb,
  referralRateLimit,
  authenticateFirebaseUser,
  FieldValue,
  referralClaimCap = 3,
}) {
  async function authenticateReferralCaller(req, res, next) {
    try {
      req.caller = await authenticateFirebaseUser(req);
      next();
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
    }
  }

  app.get('/api/referrals/credits', referralRateLimit, authenticateReferralCaller, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Referrals are not configured on this server.' });
      return;
    }

    const caller = req.caller;
    try {
      const statsRef = adminDb.collection(REFERRAL_STATS_COLLECTION).doc(caller.uid);
      const statsSnap = await statsRef.get();
      const count = statsSnap.exists ? Number(statsSnap.data()?.claimCount ?? 0) : 0;
      res.json({ count });
    } catch (error) {
      console.error('Referral credit count error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to load referral credits.' });
    }
  });

  app.post('/api/referrals/claim', referralRateLimit, authenticateReferralCaller, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Referrals are not configured on this server.' });
      return;
    }

    if (!isPlainObject(req.body)) {
      res.status(400).json({ error: 'Referral claim payload is required.' });
      return;
    }

    const caller = req.caller;
    const referrerUid = typeof req.body.referrerUid === 'string' ? req.body.referrerUid.trim() : '';
    if (!referrerUid) {
      res.status(400).json({ error: 'referrerUid is required.' });
      return;
    }
    if (caller.uid === referrerUid) {
      res.status(400).json({ error: 'You cannot claim your own referral link.' });
      return;
    }

    const claimId = `${referrerUid}_${caller.uid}`;
    const claimRef = adminDb.collection(REFERRAL_CLAIMS_COLLECTION).doc(claimId);
    const statsRef = adminDb.collection(REFERRAL_STATS_COLLECTION).doc(referrerUid);
    const cap = Number.isFinite(referralClaimCap) && referralClaimCap > 0 ? Math.floor(referralClaimCap) : 3;

    try {
      const result = await adminDb.runTransaction(async (tx) => {
        const claimSnap = await tx.get(claimRef);
        if (claimSnap.exists) {
          const statsSnap = await tx.get(statsRef);
          const count = statsSnap.exists ? Number(statsSnap.data()?.claimCount ?? 0) : 0;
          return { claimed: false, count };
        }

        const statsSnap = await tx.get(statsRef);
        const currentCount = statsSnap.exists ? Number(statsSnap.data()?.claimCount ?? 0) : 0;
        if (currentCount >= cap) {
          throw Object.assign(new Error('This referrer has reached their referral credit cap.'), { statusCode: 409 });
        }

        const nextCount = currentCount + 1;
        tx.set(claimRef, {
          referrerUid,
          visitorKey: caller.uid,
          claimedAt: FieldValue.serverTimestamp(),
        });
        tx.set(statsRef, {
          referrerUid,
          claimCount: nextCount,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { claimed: true, count: nextCount };
      });

      res.json(result);
    } catch (error) {
      console.error('Referral claim error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to claim referral credit.' });
    }
  });
}
