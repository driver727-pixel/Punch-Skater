/**
 * Registers admin-only API routes.
 *
 * @param {import('express').Application} app - The Express application instance.
 * @param {object} deps
 * @param {import('firebase-admin/auth').Auth | null} deps.adminAuth
 * @param {import('firebase-admin/firestore').Firestore | null} deps.adminDb
 * @param {Function} deps.authSyncRateLimit
 * @param {Function} deps.adminUserRateLimit
 * @param {Function} deps.authenticateFirebaseUser
 * @param {Function} deps.authenticateAdminRequest
 * @param {Function} deps.syncAdminClaim
 * @param {Function} deps.isStrongPassword
 * @param {Function} deps.buildUserDisplayName
 * @param {Function} deps.upsertUserLookupRecord
 * @param {Function} deps.reconcilePurchasedTierForUser
 * @param {Function} deps.deleteUserData
 * @param {Function} deps.migrateUserCards
 * @param {import('firebase-admin/firestore').FieldValue} deps.FieldValue - Firestore FieldValue
 *   used to write server-authoritative timestamps (e.g. FieldValue.serverTimestamp()).
 */
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
  deleteUserData,
  migrateUserCards,
  FieldValue,
}) {
  // Maximum allowed display-name length (kept in sync with the Firestore profile schema).
  const DISPLAY_NAME_MAX_LENGTH = 40;
  const CYBER_JOUST_SPRITES_COLLECTION = 'cyberJoustSprites';

  function slugifyCyberJoustPart(value) {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function buildCyberJoustManifest(spriteDocs) {
    const bodies = [];
    const weapons = [];

    for (const docSnap of spriteDocs) {
      const data = docSnap.data?.() ?? {};
      if (data.kind === 'body' && typeof data.slug === 'string' && typeof data.deck === 'string') {
        bodies.push({
          kind: 'body',
          slug: data.slug,
          label: typeof data.label === 'string' ? data.label : `${data.colorName ?? 'Neon Cyan'} / ${data.deck}`,
          colorName: typeof data.colorName === 'string' ? data.colorName : 'Neon Cyan',
          color: typeof data.color === 'number' ? data.color : 0x00f0ff,
          deck: data.deck,
          imagePath: typeof data.imagePath === 'string' ? data.imagePath : '',
          imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
          storagePath: typeof data.storagePath === 'string' ? data.storagePath : undefined,
        });
      } else if (data.kind === 'weapon' && typeof data.slug === 'string' && typeof data.weapon === 'string') {
        weapons.push({
          kind: 'weapon',
          slug: data.slug,
          label: typeof data.label === 'string' ? data.label : `${data.colorName ?? 'Neon Cyan'} / ${data.weapon}`,
          colorName: typeof data.colorName === 'string' ? data.colorName : 'Neon Cyan',
          color: typeof data.color === 'number' ? data.color : 0x00f0ff,
          weapon: data.weapon,
          imagePath: typeof data.imagePath === 'string' ? data.imagePath : '',
          imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
          storagePath: typeof data.storagePath === 'string' ? data.storagePath : undefined,
        });
      }
    }

    bodies.sort((left, right) => left.slug.localeCompare(right.slug));
    weapons.sort((left, right) => left.slug.localeCompare(right.slug));

    const weaponsByColor = new Map();
    for (const weapon of weapons) {
      if (!weaponsByColor.has(weapon.colorName)) {
        weaponsByColor.set(weapon.colorName, []);
      }
      weaponsByColor.get(weapon.colorName).push(weapon);
    }

    const fighters = [];
    for (const body of bodies) {
      const matchingWeapons = weaponsByColor.get(body.colorName) ?? [];
      for (const weapon of matchingWeapons) {
        fighters.push({
          slug: `${body.slug}--${slugifyCyberJoustPart(weapon.weapon)}`,
          label: `${body.colorName} / ${body.deck} / ${weapon.weapon}`,
          colorName: body.colorName,
          color: body.color,
          deck: body.deck,
          weapon: weapon.weapon,
          bodySlug: body.slug,
          weaponSlug: weapon.slug,
        });
      }
    }

    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      bodies,
      weapons,
      fighters,
    };
  }

  app.use('/api/auth/sync-session', authSyncRateLimit);
  app.use('/api/admin/create-user', adminUserRateLimit);
  app.use('/api/admin/delete-user', adminUserRateLimit);
  // Rate-limit all player management routes under /api/admin/player/
  app.use('/api/admin/player/', adminUserRateLimit);
  app.use('/api/admin/combination-stats', adminUserRateLimit);
  app.use('/api/admin/decks', adminUserRateLimit);

  // Intentionally public so the static Cyber Joust runtime can load the latest
  // sprite manifest without requiring a signed-in session.
  app.get('/api/cyber-joust/sprites', async (_req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Firebase Admin is not configured on this server.' });
      return;
    }
    try {
      const snap = await adminDb.collection(CYBER_JOUST_SPRITES_COLLECTION).get();
      res.json(buildCyberJoustManifest(snap.docs));
    } catch (error) {
      console.error('Cyber Joust sprite manifest failed:', error);
      res.status(500).json({ error: 'Failed to load Cyber Joust sprites from Firestore.' });
    }
  });

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
      await deleteUserData({ adminDb, uid });
      await adminAuth.deleteUser(uid);
      res.json({ uid, email: userRecord.email ?? '' });
    } catch (error) {
      console.error('Admin delete-user failed:', error);
      res.status(500).json({ error: 'Failed to delete user.' });
    }
  });

  app.post('/api/admin/migrate-cards', adminUserRateLimit, async (req, res) => {
    if (!adminAuth || !adminDb) {
      res.status(503).json({ error: 'Firebase Admin is not configured on this server.' });
      return;
    }

    try {
      await authenticateAdminRequest(req);
    } catch (error) {
      res.status(error?.statusCode ?? 500).json({ error: error.message ?? 'Could not verify admin access.' });
      return;
    }

    const fromEmail = typeof req.body?.fromEmail === 'string' ? req.body.fromEmail.trim().toLowerCase() : '';
    const toEmail = typeof req.body?.toEmail === 'string' ? req.body.toEmail.trim().toLowerCase() : '';
    if (!fromEmail) {
      res.status(400).json({ error: 'fromEmail is required.' });
      return;
    }
    if (!toEmail) {
      res.status(400).json({ error: 'toEmail is required.' });
      return;
    }
    if (fromEmail === toEmail) {
      res.status(400).json({ error: 'fromEmail and toEmail must be different accounts.' });
      return;
    }

    let fromUser;
    let toUser;
    try {
      [fromUser, toUser] = await Promise.all([
        adminAuth.getUserByEmail(fromEmail),
        adminAuth.getUserByEmail(toEmail),
      ]);
    } catch (error) {
      if (error?.code === 'auth/user-not-found') {
        res.status(404).json({ error: 'One or both email addresses were not found.' });
        return;
      }
      console.error('Admin migrate-cards user lookup failed:', error);
      res.status(500).json({ error: 'Failed to look up user accounts.' });
      return;
    }

    try {
      const { migratedCount } = await migrateUserCards({ adminDb, fromUid: fromUser.uid, toUid: toUser.uid });
      res.json({ fromUid: fromUser.uid, toUid: toUser.uid, migratedCount });
    } catch (error) {
      console.error('Admin migrate-cards failed:', error);
      res.status(500).json({ error: 'Failed to migrate cards.' });
    }
  });

  // ── Player data management ─────────────────────────────────────────────────
  // Rate limiting for /api/admin/player/* is pre-registered above via app.use.

  app.get('/api/admin/player/:uid/cards', async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Firebase Admin is not configured on this server.' });
      return;
    }
    try {
      await authenticateAdminRequest(req);
    } catch (error) {
      res.status(error?.statusCode ?? 500).json({ error: error.message ?? 'Could not verify admin access.' });
      return;
    }
    const { uid } = req.params;
    if (!uid) {
      res.status(400).json({ error: 'uid is required.' });
      return;
    }
    try {
      const snap = await adminDb.collection('users').doc(uid).collection('cards').get();
      const cards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json({ cards });
    } catch (error) {
      console.error('Admin get player cards failed:', error);
      res.status(500).json({ error: 'Failed to load player cards.' });
    }
  });

  app.get('/api/admin/player/:uid/decks', async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Firebase Admin is not configured on this server.' });
      return;
    }
    try {
      await authenticateAdminRequest(req);
    } catch (error) {
      res.status(error?.statusCode ?? 500).json({ error: error.message ?? 'Could not verify admin access.' });
      return;
    }
    const { uid } = req.params;
    if (!uid) {
      res.status(400).json({ error: 'uid is required.' });
      return;
    }
    try {
      const snap = await adminDb.collection('users').doc(uid).collection('decks').get();
      const decks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json({ decks });
    } catch (error) {
      console.error('Admin get player decks failed:', error);
      res.status(500).json({ error: 'Failed to load player decks.' });
    }
  });

  app.put('/api/admin/player/:uid/profile', async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Firebase Admin is not configured on this server.' });
      return;
    }
    try {
      await authenticateAdminRequest(req);
    } catch (error) {
      res.status(error?.statusCode ?? 500).json({ error: error.message ?? 'Could not verify admin access.' });
      return;
    }
    const { uid } = req.params;
    if (!uid) {
      res.status(400).json({ error: 'uid is required.' });
      return;
    }
    const { displayName } = req.body ?? {};
    if (displayName !== undefined && (typeof displayName !== 'string' || !displayName.trim())) {
      res.status(400).json({ error: 'displayName must be a non-empty string.' });
      return;
    }
    const patch = {};
    if (displayName !== undefined) patch.displayName = displayName.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'No updatable fields provided.' });
      return;
    }
    patch.updatedAt = FieldValue.serverTimestamp();
    try {
      await Promise.all([
        adminDb.collection('userProfiles').doc(uid).set(patch, { merge: true }),
        patch.displayName !== undefined
          ? adminDb.collection('userLookup').doc(uid).set({ displayName: patch.displayName, updatedAt: patch.updatedAt }, { merge: true })
          : Promise.resolve(),
      ]);
      res.json({ uid, ...patch, updatedAt: undefined });
    } catch (error) {
      console.error('Admin update player profile failed:', error);
      res.status(500).json({ error: 'Failed to update player profile.' });
    }
  });

  app.put('/api/admin/player/:uid/cards/:cardId', async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Firebase Admin is not configured on this server.' });
      return;
    }
    try {
      await authenticateAdminRequest(req);
    } catch (error) {
      res.status(error?.statusCode ?? 500).json({ error: error.message ?? 'Could not verify admin access.' });
      return;
    }
    const { uid, cardId } = req.params;
    if (!uid || !cardId) {
      res.status(400).json({ error: 'uid and cardId are required.' });
      return;
    }
    const cardData = req.body;
    if (!cardData || typeof cardData !== 'object' || Array.isArray(cardData)) {
      res.status(400).json({ error: 'Request body must be a card object.' });
      return;
    }
    try {
      await adminDb.collection('users').doc(uid).collection('cards').doc(cardId).set(cardData);
      res.json({ uid, cardId });
    } catch (error) {
      console.error('Admin save player card failed:', error);
      res.status(500).json({ error: 'Failed to save player card.' });
    }
  });

  app.delete('/api/admin/player/:uid/cards/:cardId', async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Firebase Admin is not configured on this server.' });
      return;
    }
    try {
      await authenticateAdminRequest(req);
    } catch (error) {
      res.status(error?.statusCode ?? 500).json({ error: error.message ?? 'Could not verify admin access.' });
      return;
    }
    const { uid, cardId } = req.params;
    if (!uid || !cardId) {
      res.status(400).json({ error: 'uid and cardId are required.' });
      return;
    }
    try {
      await adminDb.collection('users').doc(uid).collection('cards').doc(cardId).delete();
      res.json({ uid, cardId });
    } catch (error) {
      console.error('Admin delete player card failed:', error);
      res.status(500).json({ error: 'Failed to delete player card.' });
    }
  });

  app.delete('/api/admin/player/:uid/decks/:deckId', async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Firebase Admin is not configured on this server.' });
      return;
    }
    try {
      await authenticateAdminRequest(req);
    } catch (error) {
      res.status(error?.statusCode ?? 500).json({ error: error.message ?? 'Could not verify admin access.' });
      return;
    }
    const { uid, deckId } = req.params;
    if (!uid || !deckId) {
      res.status(400).json({ error: 'uid and deckId are required.' });
      return;
    }
    try {
      await adminDb.collection('users').doc(uid).collection('decks').doc(deckId).delete();
      res.json({ uid, deckId });
    } catch (error) {
      console.error('Admin delete player deck failed:', error);
      res.status(500).json({ error: 'Failed to delete player deck.' });
    }
  });

  // ── Admin decks with full card data ───────────────────────────────────────
  // Returns every card deck owned by every admin user, each deck hydrated with
  // its full card payloads (including all AI-art layer URLs).

  app.get('/api/admin/decks', async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Firebase Admin is not configured on this server.' });
      return;
    }
    try {
      await authenticateAdminRequest(req);
    } catch (error) {
      res.status(error?.statusCode ?? 500).json({ error: error.message ?? 'Could not verify admin access.' });
      return;
    }

    try {
      const adminProfilesSnap = await adminDb.collection('userProfiles').where('isAdmin', '==', true).get();
      const adminUids = adminProfilesSnap.docs.map((d) => d.id).filter(Boolean);

      const allDecks = [];

      await Promise.allSettled(
        adminUids.map(async (uid) => {
          const decksSnap = await adminDb.collection('users').doc(uid).collection('decks').get();
          for (const deckDoc of decksSnap.docs) {
            const deckData = deckDoc.data() ?? {};
            allDecks.push({
              id: deckDoc.id,
              ownerUid: uid,
              name: deckData.name ?? 'Unnamed Deck',
              isPrimary: deckData.isPrimary ?? false,
              battleReady: deckData.battleReady ?? false,
              challengerCardId: deckData.challengerCardId ?? null,
              cards: Array.isArray(deckData.cards) ? deckData.cards : [],
            });
          }
        }),
      );

      // Sort: primary decks first, then by deck name.
      allDecks.sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' });
      });

      res.json({ decks: allDecks });
    } catch (error) {
      console.error('Admin get all decks failed:', error);
      res.status(500).json({ error: 'Failed to load admin decks.' });
    }
  });

  // ── Combination coverage stats ─────────────────────────────────────────────
  // Returns the count of unique board configs and character combos created,
  // split between the admin collection and all non-admin user collections.

  app.get('/api/admin/combination-stats', async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Firebase Admin is not configured on this server.' });
      return;
    }
    try {
      await authenticateAdminRequest(req);
    } catch (error) {
      res.status(error?.statusCode ?? 500).json({ error: error.message ?? 'Could not verify admin access.' });
      return;
    }

    try {
      // Collect admin UIDs from userProfiles docs that have isAdmin === true.
      const adminProfilesSnap = await adminDb.collection('userProfiles').where('isAdmin', '==', true).get();
      const adminUids = new Set(adminProfilesSnap.docs.map((d) => d.id));

      // Fetch every card across all users via the 'cards' collection group.
      const cardsSnap = await adminDb.collectionGroup('cards').get();

      const adminBoardCombos = new Set();
      const adminCharCombos = new Set();
      const userBoardCombos = new Set();
      const userCharCombos = new Set();

      for (const docSnap of cardsSnap.docs) {
        // Card path shape: users/{uid}/cards/{cardId} → uid is at index 1.
        const pathParts = docSnap.ref.path.split('/');
        const uid = pathParts[1];
        const data = docSnap.data();

        // Board configuration key (boardType|drivetrain|driveOrientation|motor|wheels|battery).
        // driveOrientation is optional on legacy cards that pre-date the field; it defaults
        // to 'Rear-Wheel Drive' so those cards still map to a deterministic combo key.
        const config = data?.board?.config;
        if (config?.boardType && config?.drivetrain && config?.motor && config?.wheels && config?.battery) {
          const boardKey = [
            config.boardType,
            config.drivetrain,
            config.driveOrientation ?? 'Rear-Wheel Drive',
            config.motor,
            config.wheels,
            config.battery,
          ].join('|');

          if (adminUids.has(uid)) {
            adminBoardCombos.add(boardKey);
          } else {
            userBoardCombos.add(boardKey);
          }
        }

        // Character profile key from the seven required prompt fields.
        const prompts = data?.prompts;
        if (
          prompts?.archetype && prompts?.rarity && prompts?.style &&
          prompts?.district && prompts?.gender && prompts?.ageGroup && prompts?.bodyType
        ) {
          const charKey = [
            prompts.archetype,
            prompts.rarity,
            prompts.style,
            prompts.district,
            prompts.gender,
            prompts.ageGroup,
            prompts.bodyType,
          ].join('|');

          if (adminUids.has(uid)) {
            adminCharCombos.add(charKey);
          } else {
            userCharCombos.add(charKey);
          }
        }
      }

      const combinedBoardCombos = new Set([...adminBoardCombos, ...userBoardCombos]);
      const combinedCharCombos = new Set([...adminCharCombos, ...userCharCombos]);

      res.json({
        admin: {
          boardCombos: adminBoardCombos.size,
          charCombos: adminCharCombos.size,
        },
        users: {
          boardCombos: userBoardCombos.size,
          charCombos: userCharCombos.size,
        },
        combined: {
          boardCombos: combinedBoardCombos.size,
          charCombos: combinedCharCombos.size,
        },
      });
    } catch (error) {
      console.error('Admin combination-stats failed:', error);
      res.status(500).json({ error: 'Failed to compute combination stats.' });
    }
  });
}
