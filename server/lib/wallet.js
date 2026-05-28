import { createRequire } from 'module';

const nodeRequire = createRequire(import.meta.url);
const ozziesConfig = nodeRequire('../../src/lib/ozziesConfig.json');
const MAX_WALLET_METADATA_ENTRIES = 12;

export const CARD_FORGE_OZZIES_COST = Number.isFinite(ozziesConfig.cardForgeCost)
  ? Math.max(1, Math.floor(ozziesConfig.cardForgeCost))
  : 25;
export const MISSION_OZZIES_REWARDS = Object.freeze({ ...(ozziesConfig.missionRewards ?? {}) });

function readWholeNumber(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function normalizeWalletData(data) {
  return {
    uid: typeof data?.uid === 'string' ? data.uid : '',
    currentBalance: readWholeNumber(data?.currentBalance),
    lifetimeEarned: readWholeNumber(data?.lifetimeEarned),
    lifetimeSpent: readWholeNumber(data?.lifetimeSpent),
    updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : '',
  };
}

function sanitizeWalletMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value)
    .filter(([, entryValue]) => (
      typeof entryValue === 'string'
      || typeof entryValue === 'number'
      || typeof entryValue === 'boolean'
      || entryValue === null
    ))
    .slice(0, MAX_WALLET_METADATA_ENTRIES);
  return Object.fromEntries(entries);
}

function buildTransactionRecord({
  uid,
  idempotencyKey,
  amount,
  direction,
  balanceBefore,
  balanceAfter,
  sourceType,
  sourceId,
  description,
  metadata,
  FieldValue,
}) {
  const createdAt = new Date().toISOString();
  return {
    id: idempotencyKey,
    uid,
    idempotencyKey,
    amount,
    direction,
    balanceBefore,
    balanceAfter,
    sourceType,
    sourceId,
    description,
    metadata: sanitizeWalletMetadata(metadata),
    createdAt,
    updatedAt: createdAt,
    _ts: FieldValue.serverTimestamp(),
  };
}

function buildWalletRecord({ uid, currentBalance, lifetimeEarned, lifetimeSpent, FieldValue }) {
  return {
    uid,
    currentBalance,
    lifetimeEarned,
    lifetimeSpent,
    updatedAt: new Date().toISOString(),
    _ts: FieldValue.serverTimestamp(),
  };
}

function validateWalletMutationInput({ uid, amount, sourceType, sourceId, description, idempotencyKey }) {
  if (typeof uid !== 'string' || !uid.trim()) {
    throw Object.assign(new Error('uid is required.'), { statusCode: 400 });
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw Object.assign(new Error('amount must be a positive integer.'), { statusCode: 400 });
  }
  if (typeof sourceType !== 'string' || !sourceType.trim()) {
    throw Object.assign(new Error('sourceType is required.'), { statusCode: 400 });
  }
  if (typeof sourceId !== 'string' || !sourceId.trim()) {
    throw Object.assign(new Error('sourceId is required.'), { statusCode: 400 });
  }
  if (typeof description !== 'string' || !description.trim()) {
    throw Object.assign(new Error('description is required.'), { statusCode: 400 });
  }
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    throw Object.assign(new Error('idempotencyKey is required.'), { statusCode: 400 });
  }
}

export function getMissionRewardAmount(missionId) {
  const amount = MISSION_OZZIES_REWARDS[missionId];
  return Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
}

async function mutateWallet(adminDb, {
  uid,
  amount,
  direction,
  sourceType,
  sourceId,
  description,
  metadata = {},
  idempotencyKey,
  FieldValue,
}) {
  validateWalletMutationInput({ uid, amount, sourceType, sourceId, description, idempotencyKey });
  if (!adminDb) {
    throw Object.assign(new Error('Wallet service is not configured on this server.'), { statusCode: 503 });
  }

  const walletRef = adminDb.collection('wallets').doc(uid);
  const ledgerRef = walletRef.collection('ledger').doc(idempotencyKey);

  return adminDb.runTransaction(async (tx) => {
    const [walletSnap, ledgerSnap] = await Promise.all([
      tx.get(walletRef),
      tx.get(ledgerRef),
    ]);

    if (ledgerSnap.exists) {
      return {
        wallet: normalizeWalletData(walletSnap.exists ? walletSnap.data() : { uid }),
        transaction: ledgerSnap.data(),
        duplicate: true,
      };
    }

    const currentWallet = normalizeWalletData(walletSnap.exists ? walletSnap.data() : { uid });
    const balanceBefore = currentWallet.currentBalance;
    const balanceAfter = direction === 'credit'
      ? balanceBefore + amount
      : balanceBefore - amount;

    if (direction === 'debit' && balanceAfter < 0) {
      throw Object.assign(new Error('Insufficient Ozzies balance.'), { statusCode: 409 });
    }

    const nextWallet = buildWalletRecord({
      uid,
      currentBalance: balanceAfter,
      lifetimeEarned: direction === 'credit'
        ? currentWallet.lifetimeEarned + amount
        : currentWallet.lifetimeEarned,
      lifetimeSpent: direction === 'debit'
        ? currentWallet.lifetimeSpent + amount
        : currentWallet.lifetimeSpent,
      FieldValue,
    });
    const transaction = buildTransactionRecord({
      uid,
      idempotencyKey,
      amount,
      direction,
      balanceBefore,
      balanceAfter,
      sourceType,
      sourceId,
      description,
      metadata,
      FieldValue,
    });

    tx.set(walletRef, nextWallet, { merge: true });
    tx.set(ledgerRef, transaction);

    return {
      wallet: normalizeWalletData(nextWallet),
      transaction,
      duplicate: false,
    };
  });
}

export async function debitWalletInTransaction(tx, adminDb, {
  uid,
  amount,
  sourceType,
  sourceId,
  description,
  metadata = {},
  idempotencyKey,
  FieldValue,
}) {
  validateWalletMutationInput({ uid, amount, sourceType, sourceId, description, idempotencyKey });
  if (!adminDb) {
    throw Object.assign(new Error('Wallet service is not configured on this server.'), { statusCode: 503 });
  }

  const walletRef = adminDb.collection('wallets').doc(uid);
  const ledgerRef = walletRef.collection('ledger').doc(idempotencyKey);
  const [walletSnap, ledgerSnap] = await Promise.all([
    tx.get(walletRef),
    tx.get(ledgerRef),
  ]);

  if (ledgerSnap.exists) {
    return {
      wallet: normalizeWalletData(walletSnap.exists ? walletSnap.data() : { uid }),
      transaction: ledgerSnap.data(),
      duplicate: true,
    };
  }

  const currentWallet = normalizeWalletData(walletSnap.exists ? walletSnap.data() : { uid });
  const balanceBefore = currentWallet.currentBalance;
  const balanceAfter = balanceBefore - amount;
  if (balanceAfter < 0) {
    throw Object.assign(new Error('Insufficient Ozzies balance.'), { statusCode: 409 });
  }

  const nextWallet = buildWalletRecord({
    uid,
    currentBalance: balanceAfter,
    lifetimeEarned: currentWallet.lifetimeEarned,
    lifetimeSpent: currentWallet.lifetimeSpent + amount,
    FieldValue,
  });
  const transaction = buildTransactionRecord({
    uid,
    idempotencyKey,
    amount,
    direction: 'debit',
    balanceBefore,
    balanceAfter,
    sourceType,
    sourceId,
    description,
    metadata,
    FieldValue,
  });

  tx.set(walletRef, nextWallet, { merge: true });
  tx.set(ledgerRef, transaction);

  return {
    wallet: normalizeWalletData(nextWallet),
    transaction,
    duplicate: false,
  };
}

export function creditWallet(adminDb, params) {
  return mutateWallet(adminDb, {
    ...params,
    direction: 'credit',
  });
}

export function spendWallet(adminDb, params) {
  return mutateWallet(adminDb, {
    ...params,
    direction: 'debit',
  });
}

export async function getWallet(adminDb, uid, recentLimit = 8) {
  if (!adminDb) {
    throw Object.assign(new Error('Wallet service is not configured on this server.'), { statusCode: 503 });
  }

  const walletRef = adminDb.collection('wallets').doc(uid);
  const [walletSnap, ledgerSnap] = await Promise.all([
    walletRef.get(),
    walletRef.collection('ledger').orderBy('createdAt', 'desc').limit(recentLimit).get(),
  ]);

  return {
    wallet: normalizeWalletData(walletSnap.exists ? walletSnap.data() : { uid }),
    recentTransactions: ledgerSnap.docs.map((docSnap) => docSnap.data()),
  };
}
