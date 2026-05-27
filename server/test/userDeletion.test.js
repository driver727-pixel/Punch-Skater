import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteUserData, migrateUserCards } from '../lib/userDeletion.js';

function createMockAdminDb(uid) {
  const deletedPaths = [];
  const batchedPaths = [];
  const queryDocs = new Map();
  const collectionDocs = new Map([
    [`users/${uid}/cards`, [{ ref: { path: `users/${uid}/cards/card-1` } }]],
    [`users/${uid}/decks`, [{ ref: { path: `users/${uid}/decks/deck-1` } }]],
    [`notifications/${uid}/items`, [{ ref: { path: `notifications/${uid}/items/notif-1` } }]],
  ]);

  [
    'trades?fromUid',
    'trades?toUid',
    'battleResults?challengerUid',
    'battleResults?defenderUid',
    'referralClaims?referrerUid',
    'missions?uid',
    'challenges?challengerUid',
    'challenges?defenderUid',
    'races?challengerUid',
    'races?defenderUid',
  ].forEach((key) => {
    queryDocs.set(key, [{ ref: { path: `${key}/${uid}` } }]);
  });

  function nextDocs(store, key) {
    const docs = store.get(key) ?? [];
    store.set(key, []);
    return docs;
  }

  function createCollection(path) {
    return {
      path,
      doc(id) {
        const docPath = `${path}/${id}`;
        return {
          path: docPath,
          collection(subpath) {
            return createCollection(`${docPath}/${subpath}`);
          },
          async delete() {
            deletedPaths.push(docPath);
          },
        };
      },
      where(field) {
        const key = `${path}?${field}`;
        return {
          limit() {
            return {
              async get() {
                const docs = nextDocs(queryDocs, key);
                return { empty: docs.length === 0, size: docs.length, docs };
              },
            };
          },
        };
      },
      limit() {
        return {
          async get() {
            const docs = nextDocs(collectionDocs, path);
            return { empty: docs.length === 0, size: docs.length, docs };
          },
        };
      },
    };
  }

  return {
    deletedPaths,
    batchedPaths,
    batch() {
      const deletes = [];
      return {
        delete(ref) {
          deletes.push(ref.path);
        },
        async commit() {
          batchedPaths.push(...deletes);
        },
      };
    },
    collection(path) {
      return createCollection(path);
    },
  };
}

test('deleteUserData removes per-user docs, subcollections, and related query records', async () => {
  const uid = 'user-123';
  const adminDb = createMockAdminDb(uid);

  await deleteUserData({ adminDb, uid });

  assert.deepEqual(
    new Set(adminDb.deletedPaths),
    new Set([
      `users/${uid}`,
      `userProfiles/${uid}`,
      `userLookup/${uid}`,
      `arena/${uid}`,
      `leaderboard/${uid}`,
      `dailyStreaks/${uid}`,
      `battlePass/${uid}`,
      `notifications/${uid}`,
    ]),
  );

  assert.ok(adminDb.batchedPaths.includes(`users/${uid}/cards/card-1`));
  assert.ok(adminDb.batchedPaths.includes(`users/${uid}/decks/deck-1`));
  assert.ok(adminDb.batchedPaths.includes(`notifications/${uid}/items/notif-1`));
  assert.ok(adminDb.batchedPaths.includes(`missions?uid/${uid}`));
  assert.ok(adminDb.batchedPaths.includes(`races?defenderUid/${uid}`));
});

function createMigrateAdminDb(fromUid, toUid, cardFixtures) {
  const setBatches = [];

  function createDocRef(path) {
    const subcollections = new Map();
    return {
      path,
      id: path.split('/').pop(),
      data() {
        return cardFixtures.find((c) => c.id === path.split('/').pop())?.data ?? {};
      },
      collection(subpath) {
        const key = `${path}/${subpath}`;
        if (!subcollections.has(key)) subcollections.set(key, createCollectionRef(key));
        return subcollections.get(key);
      },
    };
  }

  function createCollectionRef(path) {
    const uid = path.split('/')[1];
    const isFrom = uid === fromUid;
    let exhausted = false;
    return {
      path,
      doc(id) {
        return createDocRef(`${path}/${id}`);
      },
      limit() {
        return {
          async get() {
            if (!isFrom || exhausted) return { empty: true, size: 0, docs: [] };
            exhausted = true;
            const docs = cardFixtures.map((c) => ({
              id: c.id,
              ref: createDocRef(`${path}/${c.id}`),
              data() { return c.data; },
            }));
            return { empty: docs.length === 0, size: docs.length, docs };
          },
          startAfter() {
            return {
              async get() {
                return { empty: true, size: 0, docs: [] };
              },
            };
          },
        };
      },
    };
  }

  return {
    setBatches,
    batch() {
      const ops = [];
      return {
        set(ref, data) { ops.push({ path: ref.path, data }); },
        delete() {},
        async commit() { setBatches.push(...ops); },
      };
    },
    collection(path) {
      return createCollectionRef(path);
    },
  };
}

test('migrateUserCards copies all source cards to the target user', async () => {
  const fromUid = 'user-from';
  const toUid = 'user-to';
  const cards = [
    { id: 'card-alpha', data: { name: 'Alpha', rarity: 'rare' } },
    { id: 'card-beta', data: { name: 'Beta', rarity: 'common' } },
  ];

  const adminDb = createMigrateAdminDb(fromUid, toUid, cards);
  const { migratedCount } = await migrateUserCards({ adminDb, fromUid, toUid });

  assert.equal(migratedCount, 2);
  const paths = adminDb.setBatches.map((op) => op.path);
  assert.ok(paths.includes(`users/${toUid}/cards/card-alpha`));
  assert.ok(paths.includes(`users/${toUid}/cards/card-beta`));
  const alphaOp = adminDb.setBatches.find((op) => op.path.endsWith('card-alpha'));
  assert.deepEqual(alphaOp.data, cards[0].data);
});

test('migrateUserCards returns 0 when source has no cards', async () => {
  const adminDb = createMigrateAdminDb('user-empty', 'user-dest', []);
  const { migratedCount } = await migrateUserCards({ adminDb, fromUid: 'user-empty', toUid: 'user-dest' });
  assert.equal(migratedCount, 0);
  assert.equal(adminDb.setBatches.length, 0);
});

test('migrateUserCards returns 0 without crashing when adminDb is falsy', async () => {
  const result = await migrateUserCards({ adminDb: null, fromUid: 'a', toUid: 'b' });
  assert.deepEqual(result, { migratedCount: 0 });
});
