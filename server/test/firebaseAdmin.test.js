import test from 'node:test';
import assert from 'node:assert/strict';
import { createFirebaseAdminServices, getFirebaseServiceAccount } from '../lib/firebaseAdmin.js';

test('getFirebaseServiceAccount accepts raw, wrapped, and base64 service-account JSON', () => {
  const serviceAccount = {
    project_id: 'punch-skater',
    client_email: 'firebase-adminsdk@example.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
  };

  assert.deepEqual(
    getFirebaseServiceAccount({
      FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount),
    }, { error: () => {} }),
    {
      projectId: 'punch-skater',
      clientEmail: 'firebase-adminsdk@example.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
    },
  );

  assert.deepEqual(
    getFirebaseServiceAccount({
      FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(JSON.stringify(serviceAccount)),
    }, { error: () => {} }),
    {
      projectId: 'punch-skater',
      clientEmail: 'firebase-adminsdk@example.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
    },
  );

  assert.deepEqual(
    getFirebaseServiceAccount({
      FIREBASE_SERVICE_ACCOUNT_JSON: Buffer.from(JSON.stringify(serviceAccount), 'utf8').toString('base64'),
    }, { error: () => {} }),
    {
      projectId: 'punch-skater',
      clientEmail: 'firebase-adminsdk@example.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
    },
  );
});

test('createFirebaseAdminServices falls back to application default credentials', () => {
  const initCalls = [];
  const adminAuth = { verifyIdToken: () => {} };
  const adminDb = { collection: () => {} };
  const adminStorage = { bucket: () => {} };
  const app = { name: 'default-app' };

  const services = createFirebaseAdminServices({
    env: { GOOGLE_CLOUD_PROJECT: 'punch-skater' },
    logger: { error: () => {}, warn: () => {} },
    getAppsImpl: () => [],
    initializeAdminAppImpl: (options) => {
      initCalls.push(options);
      return app;
    },
    certImpl: () => {
      throw new Error('cert should not be used');
    },
    applicationDefaultImpl: () => 'adc',
    getAdminAuthImpl: (resolvedApp) => {
      assert.equal(resolvedApp, app);
      return adminAuth;
    },
    getAdminFirestoreImpl: (resolvedApp) => {
      assert.equal(resolvedApp, app);
      return adminDb;
    },
    getAdminStorageImpl: (resolvedApp) => {
      assert.equal(resolvedApp, app);
      return adminStorage;
    },
  });

  assert.deepEqual(initCalls, [{
    credential: 'adc',
    projectId: 'punch-skater',
  }]);
  assert.equal(services.adminAuth, adminAuth);
  assert.equal(services.adminDb, adminDb);
  assert.equal(services.adminStorage, adminStorage);
});
