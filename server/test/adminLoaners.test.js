import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAdminLoanerCards, requireFreeTierCaller } from '../lib/adminLoaners.js';

function makeDocSnapshot(id, data) {
  return {
    id,
    exists: data !== undefined,
    data: () => data,
  };
}

function createAdminLoanerDb({ profiles = {}, cardsByUser = {} } = {}) {
  return {
    collection(name) {
      if (name === 'userProfiles') {
        return {
          where(field, _op, value) {
            return {
              async get() {
                const docs = Object.entries(profiles)
                  .filter(([, profile]) => profile?.[field] === value)
                  .map(([uid, profile]) => makeDocSnapshot(uid, profile));
                return { docs };
              },
            };
          },
          doc(uid) {
            return {
              async get() {
                return makeDocSnapshot(uid, profiles[uid]);
              },
            };
          },
        };
      }

      if (name === 'users') {
        return {
          doc(uid) {
            return {
              collection(subcollection) {
                assert.equal(subcollection, 'cards');
                return {
                  async get() {
                    const docs = (cardsByUser[uid] ?? []).map((card) => makeDocSnapshot(card.id, card));
                    return { docs };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

test('requireFreeTierCaller allows signed-in free users', async () => {
  const db = createAdminLoanerDb({
    profiles: {
      'free-user': { tier: 'free' },
    },
  });

  await assert.doesNotReject(() => requireFreeTierCaller(db, { uid: 'free-user' }));
});

test('requireFreeTierCaller rejects paid and admin callers', async () => {
  const db = createAdminLoanerDb({
    profiles: {
      'paid-user': { tier: 'tier2' },
      'admin-user': { isAdmin: true, tier: 'tier3' },
    },
  });

  await assert.rejects(() => requireFreeTierCaller(db, { uid: 'paid-user' }), /reserved for signed-in free users/);
  await assert.rejects(() => requireFreeTierCaller(db, { uid: 'admin-user', admin: true }), /reserved for signed-in free users/);
});

test('loadAdminLoanerCards returns the requested number of admin-owned cards', async () => {
  const db = createAdminLoanerDb({
    profiles: {
      'admin-a': { isAdmin: true },
      'admin-b': { isAdmin: true },
    },
    cardsByUser: {
      'admin-a': [
        { id: 'card-a1', identity: { name: 'A1' } },
        { id: 'card-a2', identity: { name: 'A2' } },
      ],
      'admin-b': [
        { id: 'card-b1', identity: { name: 'B1' } },
        { id: 'card-b2', identity: { name: 'B2' } },
      ],
    },
  });

  const cards = await loadAdminLoanerCards(db, { count: 3, rng: () => 0 });

  assert.equal(cards.length, 3);
  assert.equal(new Set(cards.map((card) => `${card.ownerUid}:${card.id}`)).size, 3);
  assert.ok(cards.every((card) => card.ownerUid === 'admin-a' || card.ownerUid === 'admin-b'));
});

test('loadAdminLoanerCards fails when there are not enough admin cards', async () => {
  const db = createAdminLoanerDb({
    profiles: {
      'admin-a': { isAdmin: true },
    },
    cardsByUser: {
      'admin-a': [{ id: 'card-a1', identity: { name: 'A1' } }],
    },
  });

  await assert.rejects(
    () => loadAdminLoanerCards(db, { count: 2, rng: () => 0 }),
    /Only 1 admin loaner card is available right now/,
  );
});
