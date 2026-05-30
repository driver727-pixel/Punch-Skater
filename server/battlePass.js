/**
 * server/battlePass.js — Battle pass progression handlers.
 *
 * Season length: 6 weeks. Max tier: 30.
 *
 * NOTE: There is intentionally no endpoint that accepts client-supplied XP.
 * Trusting a client-provided XP amount let any authenticated user climb every
 * tier for free, so tier progression must be derived from server-verified game
 * events. Reward claiming is still validated against the stored server tier.
 */

const MAX_TIER = 30;

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
