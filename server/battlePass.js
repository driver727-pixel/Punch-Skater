/**
 * server/battlePass.js — Battle pass progression handlers.
 *
 * Season length: 6 weeks. Max tier: 30.
 * XP is added via POST /api/battle-pass/xp and tiers advance automatically.
 */

const MAX_TIER = 30;
const XP_PER_TIER_BASE = 100;
const XP_SCALING_FACTOR = 1.15;

function xpForTier(tier) {
  if (tier <= 0) return 0;
  return Math.floor(XP_PER_TIER_BASE * Math.pow(XP_SCALING_FACTOR, tier - 1));
}

export function registerBattlePassRoutes(app, { adminDb, battlePassRateLimit, authenticateFirebaseUser, FieldValue }) {
  app.get('/api/battle-pass', battlePassRateLimit, async (req, res) => {
    try {
      const decoded = await authenticateFirebaseUser(req);
      if (!adminDb) return res.status(503).json({ error: 'Service unavailable.' });

      const docRef = adminDb.collection('battlePass').doc(decoded.uid);
      const snap = await docRef.get();
      const data = snap.exists ? snap.data() : null;

      res.json({
        ok: true,
        data: {
          tier: data?.tier ?? 0,
          xp: data?.xp ?? 0,
          isPremium: data?.isPremium ?? false,
          seasonId: data?.seasonId ?? null,
          claimedRewards: data?.claimedRewards ?? [],
        },
      });
    } catch (err) {
      const status = err.statusCode ?? 500;
      res.status(status).json({ error: err.message ?? 'Internal error.' });
    }
  });

  app.post('/api/battle-pass/xp', battlePassRateLimit, async (req, res) => {
    try {
      const decoded = await authenticateFirebaseUser(req);
      if (!adminDb) return res.status(503).json({ error: 'Service unavailable.' });

      const { xp: xpGain, seasonId } = req.body ?? {};
      if (typeof xpGain !== 'number' || xpGain <= 0 || xpGain > 1000) {
        return res.status(400).json({ error: 'Invalid XP value.' });
      }

      const docRef = adminDb.collection('battlePass').doc(decoded.uid);
      const snap = await docRef.get();
      const data = snap.exists ? snap.data() : {};

      let currentTier = data.tier ?? 0;
      let currentXp = (data.xp ?? 0) + xpGain;

      while (currentTier < MAX_TIER) {
        const nextXp = xpForTier(currentTier + 1);
        if (currentXp >= nextXp) {
          currentXp -= nextXp;
          currentTier++;
        } else {
          break;
        }
      }

      if (currentTier >= MAX_TIER) currentTier = MAX_TIER;

      await docRef.set({
        uid: decoded.uid,
        seasonId: seasonId ?? data.seasonId ?? null,
        tier: currentTier,
        xp: currentXp,
        isPremium: data.isPremium ?? false,
        claimedRewards: data.claimedRewards ?? [],
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      res.json({
        ok: true,
        data: { tier: currentTier, xp: currentXp },
      });
    } catch (err) {
      const status = err.statusCode ?? 500;
      res.status(status).json({ error: err.message ?? 'Internal error.' });
    }
  });

  app.post('/api/battle-pass/claim', battlePassRateLimit, async (req, res) => {
    try {
      const decoded = await authenticateFirebaseUser(req);
      if (!adminDb) return res.status(503).json({ error: 'Service unavailable.' });

      const { tier, premium } = req.body ?? {};
      if (typeof tier !== 'number' || tier < 1 || tier > MAX_TIER) {
        return res.status(400).json({ error: 'Invalid tier.' });
      }

      const docRef = adminDb.collection('battlePass').doc(decoded.uid);
      const snap = await docRef.get();
      const data = snap.exists ? snap.data() : {};

      if (tier > (data.tier ?? 0)) {
        return res.status(403).json({ error: 'Tier not yet reached.' });
      }
      if (premium && !data.isPremium) {
        return res.status(403).json({ error: 'Premium pass required.' });
      }

      const claimed = data.claimedRewards ?? [];
      const key = premium ? `p${tier}` : `f${tier}`;
      if (claimed.includes(key)) {
        return res.status(409).json({ error: 'Reward already claimed.' });
      }

      claimed.push(key);
      await docRef.set({ claimedRewards: claimed, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      res.json({ ok: true, data: { claimed: key } });
    } catch (err) {
      const status = err.statusCode ?? 500;
      res.status(status).json({ error: err.message ?? 'Internal error.' });
    }
  });
}

export function getBattlePassState(_req, res) {
  res.json({ ok: true, data: null });
}

export function claimBattlePassReward(_req, res) {
  res.json({ ok: true, data: null });
}

export function advanceBattlePassTier(_req, res) {
  res.json({ ok: true, data: null });
}
