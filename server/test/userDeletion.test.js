import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteUserData } from '../lib/userDeletion.js';

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
