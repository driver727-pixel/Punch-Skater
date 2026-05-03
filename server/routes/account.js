import rateLimit from 'express-rate-limit';

const fallbackAccountDeleteRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many account deletion requests — please wait a moment and try again.' },
});

export function registerAccountRoutes(app, {
  adminAuth,
  adminDb,
  accountDeleteRateLimit,
  authenticateFirebaseUser,
  deleteUserData,
}) {
  const limiter = accountDeleteRateLimit ?? fallbackAccountDeleteRateLimit;

  app.post('/api/account/delete', limiter, async (req, res) => {
    if (!adminAuth || !adminDb) {
      res.status(503).json({ error: 'Account deletion is not configured on this server.' });
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
      await deleteUserData({ adminDb, uid: caller.uid });
      await adminAuth.deleteUser(caller.uid);
      res.status(204).end();
    } catch (error) {
      console.error('Account deletion failed:', error);
      res.status(500).json({ error: 'Failed to delete account.' });
    }
  });
}
