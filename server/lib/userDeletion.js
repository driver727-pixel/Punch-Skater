export async function deleteCollectionDocs(adminDb, collectionRef, pageSize = 200) {
  while (true) {
    const snap = await collectionRef.limit(pageSize).get();
    if (snap.empty) return;
    const batch = adminDb.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    if (snap.size < pageSize) return;
  }
}

export async function deleteQueryDocs(adminDb, queryRef, pageSize = 200) {
  while (true) {
    const snap = await queryRef.limit(pageSize).get();
    if (snap.empty) return;
    const batch = adminDb.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    if (snap.size < pageSize) return;
  }
}

export async function migrateUserCards({ adminDb, fromUid, toUid, pageSize = 200 }) {
  if (!adminDb || !fromUid || !toUid) return { migratedCount: 0 };

  const fromCardsRef = adminDb.collection('users').doc(fromUid).collection('cards');
  const toCardsRef = adminDb.collection('users').doc(toUid).collection('cards');
  let migratedCount = 0;
  let lastDoc = null;

  while (true) {
    let query = fromCardsRef.limit(pageSize);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snap = await query.get();
    if (snap.empty) break;

    const batch = adminDb.batch();
    snap.docs.forEach((docSnap) => {
      batch.set(toCardsRef.doc(docSnap.id), docSnap.data());
    });
    await batch.commit();
    migratedCount += snap.size;
    lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    if (snap.size < pageSize) break;
  }

  return { migratedCount };
}

export async function deleteUserData({ adminDb, uid, pageSize = 200 }) {
  if (!adminDb || !uid) return;

  const userDocRef = adminDb.collection('users').doc(uid);
  const notificationsDocRef = adminDb.collection('notifications').doc(uid);

  await Promise.all([
    deleteCollectionDocs(adminDb, userDocRef.collection('cards'), pageSize),
    deleteCollectionDocs(adminDb, userDocRef.collection('decks'), pageSize),
    deleteCollectionDocs(adminDb, notificationsDocRef.collection('items'), pageSize),
    deleteQueryDocs(adminDb, adminDb.collection('trades').where('fromUid', '==', uid), pageSize),
    deleteQueryDocs(adminDb, adminDb.collection('trades').where('toUid', '==', uid), pageSize),
    deleteQueryDocs(adminDb, adminDb.collection('battleResults').where('challengerUid', '==', uid), pageSize),
    deleteQueryDocs(adminDb, adminDb.collection('battleResults').where('defenderUid', '==', uid), pageSize),
    deleteQueryDocs(adminDb, adminDb.collection('referralClaims').where('referrerUid', '==', uid), pageSize),
    deleteQueryDocs(adminDb, adminDb.collection('missions').where('uid', '==', uid), pageSize),
    deleteQueryDocs(adminDb, adminDb.collection('challenges').where('challengerUid', '==', uid), pageSize),
    deleteQueryDocs(adminDb, adminDb.collection('challenges').where('defenderUid', '==', uid), pageSize),
    deleteQueryDocs(adminDb, adminDb.collection('races').where('challengerUid', '==', uid), pageSize),
    deleteQueryDocs(adminDb, adminDb.collection('races').where('defenderUid', '==', uid), pageSize),
  ]);

  await Promise.all([
    userDocRef.delete(),
    adminDb.collection('userProfiles').doc(uid).delete(),
    adminDb.collection('userLookup').doc(uid).delete(),
    adminDb.collection('arena').doc(uid).delete(),
    adminDb.collection('leaderboard').doc(uid).delete(),
    adminDb.collection('dailyStreaks').doc(uid).delete(),
    adminDb.collection('battlePass').doc(uid).delete(),
    notificationsDocRef.delete(),
  ]);
}
