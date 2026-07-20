import { claimFreeForge, getFreeForgeState } from '../lib/freeForge.js';
import { loadAdminLoanerCards } from '../lib/adminLoaners.js';

export function registerForgeRoutes(app, {
  adminDb,
  forgeRateLimit,
  authenticateFirebaseUser,
  FieldValue,
}) {
  app.get('/api/forge/computer-rivals', forgeRateLimit, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Computer rivals are not configured on this server.' });
      return;
    }

    try {
      await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    try {
      const requestedCount = Math.min(12, Math.max(1, Math.floor(Number(req.query?.count) || 6)));
      const cards = await loadAdminLoanerCards(adminDb, {
        count: requestedCount,
        allowPartial: true,
      });
      res.json({ cards });
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to load computer rivals.' });
    }
  });

  app.get('/api/forge/free-status', forgeRateLimit, async (req, res) => {
    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    try {
      const state = await getFreeForgeState(adminDb, caller.uid);
      res.json(state);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to load free forge status.' });
    }
  });

  app.post('/api/forge/free-claim', forgeRateLimit, async (req, res) => {
    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    try {
      const state = await claimFreeForge(adminDb, { uid: caller.uid, FieldValue });
      res.status(201).json(state);
    } catch (error) {
      const status = error.statusCode ?? 500;
      const payload = { error: error.message ?? 'Failed to claim free forge.' };
      if (status === 429 && typeof error.nextReadyAt === 'number') {
        payload.nextReadyAt = error.nextReadyAt;
      }
      res.status(status).json(payload);
    }
  });
}
