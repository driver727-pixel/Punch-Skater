import { applicationDefault, cert, getApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

const MAX_SERVICE_ACCOUNT_PARSE_ATTEMPTS = 3;

function getFirebaseProjectId(env) {
  return env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT || '';
}

function normalizePrivateKey(value) {
  return typeof value === 'string' ? value.replace(/\\n/g, '\n').trim() : '';
}

function parseServiceAccountJson(rawValue) {
  let candidate = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!candidate) return null;

  for (let attempt = 0; attempt < MAX_SERVICE_ACCOUNT_PARSE_ATTEMPTS; attempt += 1) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
      if (typeof parsed === 'string') {
        candidate = parsed.trim();
        continue;
      }
      return null;
    } catch {
      // Ignore parse failures while probing wrapped/base64-encoded credential formats.
    }

    try {
      const decoded = Buffer.from(candidate, 'base64').toString('utf8').trim();
      if (!decoded || decoded === candidate) return null;
      candidate = decoded;
    } catch {
      return null;
    }
  }

  return null;
}

export function getFirebaseServiceAccount(env = process.env, logger = console) {
  const rawServiceAccountJson = env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
  if (rawServiceAccountJson) {
    const parsed = parseServiceAccountJson(rawServiceAccountJson);
    if (!parsed) {
      logger.error('Firebase service-account JSON is invalid.');
      return null;
    }

    const projectId = parsed.project_id ?? parsed.projectId ?? '';
    if (!projectId && getFirebaseProjectId(env)) {
      logger.warn('Firebase service-account JSON is missing project_id — falling back to FIREBASE_PROJECT_ID, VITE_FIREBASE_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCLOUD_PROJECT.');
    }

    return {
      projectId: projectId || getFirebaseProjectId(env),
      clientEmail: parsed.client_email ?? parsed.clientEmail ?? '',
      privateKey: normalizePrivateKey(parsed.private_key ?? parsed.privateKey),
    };
  }

  const projectId = getFirebaseProjectId(env);
  const clientEmail = env.FIREBASE_ADMIN_CLIENT_EMAIL || '';
  const privateKey = normalizePrivateKey(env.FIREBASE_ADMIN_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail: clientEmail.trim(),
    privateKey,
  };
}

export function createFirebaseAdminServices({
  env = process.env,
  logger = console,
  getAppsImpl = getApps,
  initializeAdminAppImpl = initializeAdminApp,
  certImpl = cert,
  applicationDefaultImpl = applicationDefault,
  getAdminAuthImpl = getAdminAuth,
  getAdminFirestoreImpl = getAdminFirestore,
} = {}) {
  const existingApp = getAppsImpl()[0];
  if (existingApp) {
    return {
      adminAuth: getAdminAuthImpl(existingApp),
      adminDb: getAdminFirestoreImpl(existingApp),
    };
  }

  const serviceAccount = getFirebaseServiceAccount(env, logger);
  const projectId = getFirebaseProjectId(env);

  try {
    const app = serviceAccount
      ? initializeAdminAppImpl({ credential: certImpl(serviceAccount) })
      : initializeAdminAppImpl({
        credential: applicationDefaultImpl(),
        ...(projectId ? { projectId } : {}),
      });

    return {
      adminAuth: getAdminAuthImpl(app),
      adminDb: getAdminFirestoreImpl(app),
    };
  } catch (error) {
    if (!serviceAccount) logger.warn('Firebase Admin initialization failed using optional application default credentials. Verify GOOGLE_APPLICATION_CREDENTIALS or your platform-managed GCP service identity.', error);
    else logger.error('Firebase Admin initialization failed.', error);
    return { adminAuth: null, adminDb: null };
  }
}
