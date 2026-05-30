/**
 * freeForge.js
 *
 * Server-authoritative gate for the free tier's one-complimentary-card forge.
 *
 * The client used to track the free forge purely in localStorage
 * (`freeCardUsed` / `freeForgeReadyAt`), which meant anyone could clear browser
 * storage (or use a private window) to mint unlimited free cards. This module
 * records the last free forge per authenticated account in a server-only
 * Firestore document (`freeForge/{uid}`) so the cooldown cannot be reset from
 * the client.
 */

// Mirrors FREE_FORGE_COOLDOWN_MS in src/lib/dailyRewards.ts (24 hours).
export const FREE_FORGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function readTimestamp(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : null;
}

function buildState(lastForgeAt, now) {
  const ready = lastForgeAt == null ? true : now >= lastForgeAt + FREE_FORGE_COOLDOWN_MS;
  return {
    used: lastForgeAt != null,
    lastForgeAt,
    nextReadyAt: lastForgeAt == null ? null : lastForgeAt + FREE_FORGE_COOLDOWN_MS,
    canForge: ready,
  };
}

/**
 * Reads the current free-forge availability for a user without mutating it.
 * @returns {Promise<{used: boolean, lastForgeAt: number|null, nextReadyAt: number|null, canForge: boolean}>}
 */
export async function getFreeForgeState(adminDb, uid, now = Date.now()) {
  if (typeof uid !== 'string' || !uid.trim()) {
    throw Object.assign(new Error('uid is required.'), { statusCode: 400 });
  }
  if (!adminDb) {
    throw Object.assign(new Error('Free forge service is not configured on this server.'), { statusCode: 503 });
  }

  const snap = await adminDb.collection('freeForge').doc(uid).get();
  const lastForgeAt = snap.exists ? readTimestamp(snap.data()?.lastForgeAt) : null;
  return buildState(lastForgeAt, now);
}

/**
 * Atomically claims the free forge for a user, enforcing the cooldown.
 * @throws {Error} 429 when the free forge is still on cooldown.
 * @returns {Promise<{used: boolean, lastForgeAt: number|null, nextReadyAt: number|null, canForge: boolean}>}
 */
export async function claimFreeForge(adminDb, { uid, FieldValue, now = Date.now() }) {
  if (typeof uid !== 'string' || !uid.trim()) {
    throw Object.assign(new Error('uid is required.'), { statusCode: 400 });
  }
  if (!adminDb) {
    throw Object.assign(new Error('Free forge service is not configured on this server.'), { statusCode: 503 });
  }

  const docRef = adminDb.collection('freeForge').doc(uid);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const lastForgeAt = snap.exists ? readTimestamp(snap.data()?.lastForgeAt) : null;
    const current = buildState(lastForgeAt, now);

    if (!current.canForge) {
      throw Object.assign(
        new Error('Your free forge is still on cooldown.'),
        { statusCode: 429, nextReadyAt: current.nextReadyAt },
      );
    }

    const previousCount = snap.exists && Number.isFinite(snap.data()?.count)
      ? Math.max(0, Math.floor(snap.data().count))
      : 0;

    tx.set(docRef, {
      uid,
      lastForgeAt: now,
      count: previousCount + 1,
      updatedAt: new Date(now).toISOString(),
      _ts: FieldValue.serverTimestamp(),
    }, { merge: true });

    return buildState(now, now);
  });
}
