export function registerAccountRoutes(app, {
  adminAuth,
  adminDb,
  accountDeleteRateLimit,
  authenticateFirebaseUser,
  deleteUserData,
}) {
  app.use('/api/account/delete', accountDeleteRateLimit);

  app.post('/api/account/delete', async (req, res) => {
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
