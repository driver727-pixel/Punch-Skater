import {
  CARD_FORGE_OZZIES_COST,
  creditWallet,
  getMissionRewardAmount,
  getWallet,
  spendWallet,
} from '../lib/wallet.js';

export function registerWalletRoutes(app, {
  adminDb,
  walletRateLimit,
  authenticateFirebaseUser,
  FieldValue,
}) {
  app.get('/api/wallet', walletRateLimit, async (req, res) => {
    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
      const payload = await getWallet(adminDb, caller.uid);
      res.json(payload);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to load wallet.' });
    }
  });

  app.post('/api/wallet/spend', walletRateLimit, async (req, res) => {
    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    const sink = typeof req.body?.sink === 'string' ? req.body.sink.trim() : '';
    const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : '';
    if (!idempotencyKey) {
      res.status(400).json({ error: 'idempotencyKey is required.' });
      return;
    }
    if (sink !== 'card_forge') {
      res.status(400).json({ error: 'Unsupported wallet sink.' });
      return;
    }

    try {
      const result = await spendWallet(adminDb, {
        uid: caller.uid,
        amount: CARD_FORGE_OZZIES_COST,
        sourceType: 'card_forge',
        sourceId: 'card_forge',
        description: 'Card Forge spend',
        metadata: { sink },
        idempotencyKey,
        FieldValue,
      });
      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to spend Ozzies.' });
    }
  });

  app.post('/api/wallet/rewards/mission', walletRateLimit, async (req, res) => {
    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    const missionId = typeof req.body?.missionId === 'string' ? req.body.missionId.trim() : '';
    const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : '';
    if (!missionId) {
      res.status(400).json({ error: 'missionId is required.' });
      return;
    }
    if (!idempotencyKey) {
      res.status(400).json({ error: 'idempotencyKey is required.' });
      return;
    }

    const rewardAmount = getMissionRewardAmount(missionId);
    if (rewardAmount <= 0) {
      res.status(400).json({ error: 'Mission does not award Ozzies.' });
      return;
    }

    try {
      const result = await creditWallet(adminDb, {
        uid: caller.uid,
        amount: rewardAmount,
        sourceType: 'mission',
        sourceId: missionId,
        description: 'Mission reward',
        metadata: { missionId },
        idempotencyKey,
        FieldValue,
      });
      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to credit mission reward.' });
    }
  });
}
