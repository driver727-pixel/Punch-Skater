export function registerAdminRoutes(app, {
  adminAuth,
  adminDb,
  authSyncRateLimit,
  adminUserRateLimit,
  authenticateFirebaseUser,
  authenticateAdminRequest,
  syncAdminClaim,
  isStrongPassword,
  buildUserDisplayName,
  upsertUserLookupRecord,
  reconcilePurchasedTierForUser,
  deleteCollectionDocs,
  deleteQueryDocs,
}) {
  app.use('/api/auth/sync-session', authSyncRateLimit);
  app.use('/api/admin/create-user', adminUserRateLimit);
  app.use('/api/admin/delete-user', adminUserRateLimit);

  app.post('/api/auth/sync-session', async (req, res) => {
    if (!adminAuth) {
      res.status(503).json({ error: 'Firebase Admin authentication is not configured.' });
      return;
    }

    try {
      const decodedToken = await authenticateFirebaseUser(req);
      await upsertUserLookupRecord({
        uid: decodedToken.uid,
        email: decodedToken.email ?? '',
        displayName: decodedToken.name ?? decodedToken.email ?? '',
      });
      await reconcilePurchasedTierForUser({
        uid: decodedToken.uid,
        email: decodedToken.email ?? '',
      });
      const claimSync = await syncAdminClaim(decodedToken.uid, decodedToken.email ?? '');
      res.json(claimSync);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to sync auth session.' });
    }
  });

  app.post('/api/admin/create-user', async (req, res) => {
    if (!adminAuth) {
      res.status(503).json({ error: 'Firebase Admin is not configured on this server.' });
      return;
    }

    try {
      await authenticateAdminRequest(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Could not verify admin access.' });
      return;
    }

    const { email, password } = req.body ?? {};
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'email is required.' });
      return;
    }
    if (!isStrongPassword(password)) {
      res.status(400).json({ error: 'password must be at least 12 characters and include upper, lower, number, and symbol.' });
      return;
    }

    try {
      const userRecord = await adminAuth.createUser({
        email: email.trim(),
        password,
      });
      await upsertUserLookupRecord({
        uid: userRecord.uid,
        email: userRecord.email ?? email.trim(),
        displayName: buildUserDisplayName({ email: userRecord.email ?? email.trim() }),
      });
      await syncAdminClaim(userRecord.uid, userRecord.email ?? email.trim());
      res.status(201).json({ uid: userRecord.uid, email: userRecord.email ?? email.trim() });
    } catch (error) {
      console.error('Create user error:', error);
      if (error?.code === 'auth/email-already-exists') {
        res.status(400).json({ error: 'An account with that email already exists.' });
        return;
      }
      if (error?.code === 'auth/invalid-password') {
        res.status(400).json({ error: error.message ?? 'Password does not meet Firebase requirements.' });
        return;
      }
      res.status(500).json({ error: 'Failed to create user.' });
    }
  });

  app.post('/api/admin/delete-user', async (req, res) => {
    if (!adminAuth || !adminDb) {
      res.status(503).json({ error: 'Firebase Admin is not configured on this server.' });
      return;
    }

    let caller;
    try {
      caller = await authenticateAdminRequest(req);
    } catch (error) {
      res.status(error?.statusCode ?? 500).json({ error: error.message ?? 'Could not verify admin access.' });
      return;
    }

    const uid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : '';
    if (!uid) {
      res.status(400).json({ error: 'uid is required.' });
      return;
    }
    if (uid === caller.uid) {
      res.status(400).json({ error: 'You cannot delete the account you are currently using.' });
      return;
    }

    let userRecord;
    try {
      userRecord = await adminAuth.getUser(uid);
    } catch (error) {
      if (error?.code === 'auth/user-not-found') {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      console.error('Admin delete-user lookup failed:', error);
      res.status(500).json({ error: 'Failed to load user.' });
      return;
    }

    try {
      const userDocRef = adminDb.collection('users').doc(uid);
      await Promise.all([
        deleteCollectionDocs(userDocRef.collection('cards')),
        deleteCollectionDocs(userDocRef.collection('decks')),
        deleteQueryDocs(adminDb.collection('trades').where('fromUid', '==', uid)),
        deleteQueryDocs(adminDb.collection('trades').where('toUid', '==', uid)),
        deleteQueryDocs(adminDb.collection('battleResults').where('challengerUid', '==', uid)),
        deleteQueryDocs(adminDb.collection('battleResults').where('defenderUid', '==', uid)),
        deleteQueryDocs(adminDb.collection('referralClaims').where('referrerUid', '==', uid)),
      ]);

      await Promise.all([
        userDocRef.delete(),
        adminDb.collection('userProfiles').doc(uid).delete(),
        adminDb.collection('userLookup').doc(uid).delete(),
        adminDb.collection('arena').doc(uid).delete(),
        adminDb.collection('leaderboard').doc(uid).delete(),
      ]);

      await adminAuth.deleteUser(uid);
      res.json({ uid, email: userRecord.email ?? '' });
    } catch (error) {
      console.error('Admin delete-user failed:', error);
      res.status(500).json({ error: 'Failed to delete user.' });
    }
  });
}
