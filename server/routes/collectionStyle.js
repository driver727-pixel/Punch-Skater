import { randomUUID as createRandomUuid } from 'node:crypto';
import {
  COLLECTION_STYLE_APPROVAL_COUNT,
  COLLECTION_STYLE_CARD_COUNT,
  COLLECTION_STYLE_NEGATIVE_PROMPT,
  COLLECTION_STYLE_PROFILE_ID,
  MAX_COLLECTION_STYLE_IMAGE_BYTES,
  assertCollectionStyleSourceVariety,
  buildCollectionStyleCaption,
  buildCollectionStyleCards,
  buildCollectionStyleCharacterPrompt,
  buildTrainingDatasetZip,
  extractFalImageUrl,
  extractFalLoraUrl,
  inferImageExtension,
  isAllowedCharacterLayerUrl,
  normalizeCollectionStyleSourceIds,
  normalizeCollectionStyleToken,
  seedFromString,
} from '../lib/collectionStyle.js';
import { persistImageToStorage as persistImageToFirebaseStorage } from '../lib/imageStorage.js';

const BOSS_ASSETS_COLLECTION = 'adminBossAssets';
const PROFILE_COLLECTION = 'adminCollectionStyleProfiles';
const TRAINING_JOBS_COLLECTION = 'adminCollectionStyleTrainingJobs';
const BATCHES_COLLECTION = 'adminCollectionStyleBatches';
const BATCH_CARDS_COLLECTION = 'cards';
const DEFAULT_TRAINING_MODEL = 'fal-ai/flux-lora-fast-training';
const FAL_PROXY_TIMEOUT_MS = 300_000;
const GENERATION_LEASE_MS = 15 * 60 * 1000;
const FIREBASE_STORAGE_BASE_URL = 'https://firebasestorage.googleapis.com';
const FIREBASE_STORAGE_CACHE_CONTROL = 'private, max-age=0, no-transform';

function badRequest(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeBatchId(value) {
  const batchId = typeof value === 'string' ? value.trim() : '';
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(batchId)) {
    throw badRequest('Invalid collection batch ID.');
  }
  return batchId;
}

function normalizeJobId(value) {
  const jobId = typeof value === 'string' ? value.trim() : '';
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(jobId)) {
    throw badRequest('Invalid collection training job ID.');
  }
  return jobId;
}

function toIso(now) {
  return new Date(now).toISOString();
}

function getErrorMessage(error, fallback) {
  const message = error instanceof Error ? error.message : '';
  return (message || fallback).slice(0, 500);
}

function logUnexpectedError(context, error) {
  if ((error?.statusCode ?? 500) >= 500) {
    console.error(context, error);
  }
}

function numericScale(value, fallback = 0.9) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 2 ? parsed : fallback;
}

function isPermanentStorageUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const hostname = new URL(value).hostname;
    return hostname === 'firebasestorage.googleapis.com'
      || hostname.endsWith('.firebasestorage.googleapis.com')
      || hostname === 'storage.googleapis.com'
      || hostname.endsWith('.storage.googleapis.com');
  } catch {
    return false;
  }
}

function getProfileSnapshot(profile) {
  if (!profile || typeof profile !== 'object') return null;
  if (
    profile.id !== COLLECTION_STYLE_PROFILE_ID
    || typeof profile.loraUrl !== 'string'
    || !isAllowedCharacterLayerUrl(profile.loraUrl)
    || typeof profile.modelUrl !== 'string'
    || !profile.modelUrl
    || typeof profile.triggerToken !== 'string'
    || !profile.triggerToken
  ) {
    return null;
  }
  return {
    id: profile.id,
    version: typeof profile.version === 'string' ? profile.version : '',
    loraUrl: profile.loraUrl,
    loraScale: numericScale(profile.loraScale),
    modelUrl: profile.modelUrl,
    triggerToken: profile.triggerToken,
  };
}

function summarizeBatch(batch, items = []) {
  const counts = items.reduce((current, item) => {
    const status = typeof item?.status === 'string' ? item.status : 'pending';
    current[status] = (current[status] ?? 0) + 1;
    return current;
  }, {});
  const approvalCount = Number.isInteger(batch?.approvalCount)
    ? batch.approvalCount
    : COLLECTION_STYLE_APPROVAL_COUNT;
  const completedApproval = items.filter(
    (item) => item?.index < approvalCount && item?.status === 'completed',
  ).length;
  return {
    ...batch,
    progress: {
      total: Number.isInteger(batch?.totalCards) ? batch.totalCards : COLLECTION_STYLE_CARD_COUNT,
      completed: counts.completed ?? 0,
      pending: counts.pending ?? 0,
      generating: counts.generating ?? 0,
      failed: counts.failed ?? 0,
      approvalCompleted: completedApproval,
      approvalCount,
    },
  };
}

function toSourceAssetSummary(docSnap) {
  const card = docSnap.data() ?? {};
  const characterImageUrl = typeof card.characterImageUrl === 'string' ? card.characterImageUrl : '';
  return {
    id: docSnap.id,
    name: typeof card?.identity?.name === 'string' ? card.identity.name : docSnap.id,
    characterImageUrl: characterImageUrl || null,
    createdAt: typeof card.createdAt === 'string' ? card.createdAt : null,
    prompts: isPlainObject(card.prompts) ? card.prompts : {},
    eligible: isAllowedCharacterLayerUrl(characterImageUrl),
  };
}

function getSourceCaptions(value) {
  if (value == null) return {};
  if (!isPlainObject(value)) {
    throw badRequest('captions must be an object keyed by Boss Asset ID.');
  }
  const captions = {};
  for (const [cardId, caption] of Object.entries(value)) {
    if (typeof caption !== 'string' || cardId.includes('/') || cardId.length > 128) continue;
    captions[cardId] = caption.trim().slice(0, 280);
  }
  return captions;
}

async function uploadTrainingDataset({
  adminStorage,
  storageBucket,
  storagePath,
  archive,
  randomUUID,
}) {
  if (!adminStorage || !storageBucket) {
    throw Object.assign(
      new Error('Firebase Storage is required to prepare a private LoRA training dataset.'),
      { statusCode: 503 },
    );
  }
  const token = randomUUID();
  const bucket = adminStorage.bucket(storageBucket);
  await bucket.file(storagePath).save(archive, {
    contentType: 'application/zip',
    metadata: {
      cacheControl: FIREBASE_STORAGE_CACHE_CONTROL,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  return `${FIREBASE_STORAGE_BASE_URL}/v0/b/${encodeURIComponent(storageBucket)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

async function downloadTrainingImage(fetchImpl, sourceUrl) {
  const response = await fetchImpl(sourceUrl, {
    signal: AbortSignal.timeout(FAL_PROXY_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw badRequest(`Could not download selected character layer (HTTP ${response.status}).`, 502);
  }
  const contentLength = Number.parseInt(response.headers?.get?.('content-length') ?? '', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_COLLECTION_STYLE_IMAGE_BYTES) {
    throw badRequest('A selected character layer exceeds the 12 MB training limit.');
  }
  const extension = inferImageExtension(response.headers?.get?.('content-type') ?? '');
  if (!extension) {
    throw badRequest('Selected character layers must be PNG, JPEG, or WebP images.');
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length === 0 || data.length > MAX_COLLECTION_STYLE_IMAGE_BYTES) {
    throw badRequest('A selected character layer is empty or exceeds the 12 MB training limit.');
  }
  return { data, extension };
}

function parseFalErrorBody(text) {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed?.detail === 'string'
      ? parsed.detail
      : typeof parsed?.error === 'string'
        ? parsed.error
        : text;
  } catch {
    return text;
  }
}

async function generateCollectionCharacter({
  batch,
  card,
  FAL_KEY,
  BIREFNET_URL,
  buildFalImageRequest,
  fetchImpl,
  persistImageToStorage,
  adminStorage,
  storageBucket,
}) {
  const profile = batch?.styleProfile;
  if (!profile?.loraUrl || !profile?.modelUrl || !profile?.triggerToken) {
    throw Object.assign(new Error('The batch is missing its immutable collection-style profile snapshot.'), { statusCode: 409 });
  }

  const request = await buildFalImageRequest({
    fal_profile: 'character',
    prompt: buildCollectionStyleCharacterPrompt(card, profile.triggerToken),
    negative_prompt: COLLECTION_STYLE_NEGATIVE_PROMPT,
    seed: seedFromString(card.characterSeed),
    image_size: { width: 750, height: 1050 },
    num_inference_steps: 28,
    guidance_scale: 4,
    loras: [{ path: profile.loraUrl, scale: numericScale(profile.loraScale) }],
  });

  const generated = await fetchImpl(profile.modelUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${FAL_KEY}`,
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(FAL_PROXY_TIMEOUT_MS),
  });
  if (!generated.ok) {
    throw badRequest(`Collection character generation failed: ${parseFalErrorBody(await generated.text())}`, generated.status);
  }
  const rawImageUrl = extractFalImageUrl(await generated.json());
  if (!rawImageUrl || !isAllowedCharacterLayerUrl(rawImageUrl)) {
    throw badRequest('Fal did not return an approved character-layer image URL.', 502);
  }

  const backgroundRemoval = await fetchImpl(BIREFNET_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${FAL_KEY}`,
    },
    body: JSON.stringify({ image_url: rawImageUrl }),
    signal: AbortSignal.timeout(FAL_PROXY_TIMEOUT_MS),
  });
  if (!backgroundRemoval.ok) {
    throw badRequest(`Collection background removal failed: ${parseFalErrorBody(await backgroundRemoval.text())}`, backgroundRemoval.status);
  }
  const transparentImageUrl = extractFalImageUrl(await backgroundRemoval.json());
  if (!transparentImageUrl || !isAllowedCharacterLayerUrl(transparentImageUrl)) {
    throw badRequest('Background removal did not return an approved transparent image URL.', 502);
  }

  const storedUrl = await persistImageToStorage(
    adminStorage,
    transparentImageUrl,
    storageBucket,
    `generatedImages/collection-style/${batch.id}/${card.id}.png`,
  );
  if (!isPermanentStorageUrl(storedUrl)) {
    throw badRequest('The generated character layer could not be persisted to Firebase Storage.', 502);
  }
  return storedUrl;
}

async function claimNextBatchItem({ adminDb, batchRef, retryFailed, now }) {
  const batchSnap = await batchRef.get();
  if (!batchSnap.exists) {
    throw badRequest('Collection batch not found.', 404);
  }
  const batch = { id: batchSnap.id, ...(batchSnap.data() ?? {}) };
  const itemsSnap = await batchRef.collection(BATCH_CARDS_COLLECTION).get();
  const approvalCount = Number.isInteger(batch.approvalCount)
    ? batch.approvalCount
    : COLLECTION_STYLE_APPROVAL_COUNT;
  const shouldGenerate = (item) => (
    batch.phase === 'production'
      ? item.index >= approvalCount
      : item.index < approvalCount
  );
  const candidates = itemsSnap.docs
    .map((docSnap) => ({ ref: docSnap.ref, data: docSnap.data() ?? {} }))
    .filter(({ data }) => {
      if (!shouldGenerate(data)) return false;
      if (data.status === 'pending') return true;
      if (retryFailed && data.status === 'failed') return true;
      return data.status === 'generating'
        && typeof data.leaseExpiresAt === 'string'
        && Date.parse(data.leaseExpiresAt) <= now;
    })
    .sort((left, right) => left.data.index - right.data.index);

  for (const candidate of candidates) {
    const claimed = await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(candidate.ref);
      if (!current.exists) return null;
      const item = current.data() ?? {};
      const leaseExpired = item.status === 'generating'
        && typeof item.leaseExpiresAt === 'string'
        && Date.parse(item.leaseExpiresAt) <= now;
      const eligible = item.status === 'pending'
        || (retryFailed && item.status === 'failed')
        || leaseExpired;
      if (!eligible) return null;
      const claimedAt = toIso(now);
      transaction.set(candidate.ref, {
        status: 'generating',
        attempts: (Number.isInteger(item.attempts) ? item.attempts : 0) + 1,
        startedAt: claimedAt,
        leaseExpiresAt: toIso(now + GENERATION_LEASE_MS),
        lastError: null,
      }, { merge: true });
      return { ...item, status: 'generating', startedAt: claimedAt };
    });
    if (claimed) return { batch, item: claimed, itemRef: candidate.ref };
  }
  return { batch, item: null, itemRef: null };
}

/**
 * Registers the admin-only LoRA curation/training and collection batch endpoints.
 */
export function registerCollectionStyleRoutes(app, {
  adminDb,
  adminStorage,
  storageBucket = '',
  FAL_KEY = '',
  BIREFNET_URL = 'https://fal.run/fal-ai/birefnet',
  fal,
  collectionStyleRateLimit,
  authenticateAdminRequest,
  buildFalImageRequest,
  resolveFalProfile,
  trainingModel = DEFAULT_TRAINING_MODEL,
  defaultLoraScale = 0.9,
  fetchImpl = fetch,
  persistImageToStorage = persistImageToFirebaseStorage,
  randomUUID = createRandomUuid,
  now = () => Date.now(),
} = {}) {
  if (collectionStyleRateLimit) {
    app.use('/api/admin/collection-style', collectionStyleRateLimit);
  }

  async function authenticate(req, res) {
    try {
      return await authenticateAdminRequest(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: getErrorMessage(error, 'Could not verify admin access.') });
      return null;
    }
  }

  function requireDatabase(res) {
    if (adminDb) return true;
    res.status(503).json({ error: 'Firebase Admin is not configured on this server.' });
    return false;
  }

  app.get('/api/admin/collection-style', async (req, res) => {
    if (!await authenticate(req, res) || !requireDatabase(res)) return;
    try {
      const [profileSnap, jobsSnap, batchesSnap] = await Promise.all([
        adminDb.collection(PROFILE_COLLECTION).doc(COLLECTION_STYLE_PROFILE_ID).get(),
        adminDb.collection(TRAINING_JOBS_COLLECTION).get(),
        adminDb.collection(BATCHES_COLLECTION).get(),
      ]);
      const trainingJobs = jobsSnap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((left, right) => String(right.submittedAt ?? '').localeCompare(String(left.submittedAt ?? '')))
        .slice(0, 8);
      const batches = batchesSnap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')))
        .slice(0, 8);
      res.json({
        profile: profileSnap.exists ? { id: profileSnap.id, ...profileSnap.data() } : null,
        trainingJobs,
        batches,
      });
    } catch (error) {
      logUnexpectedError('Collection-style overview failed:', error);
      res.status(error.statusCode ?? 500).json({ error: getErrorMessage(error, 'Failed to load collection-style workflow.') });
    }
  });

  app.get('/api/admin/collection-style/source-assets', async (req, res) => {
    if (!await authenticate(req, res) || !requireDatabase(res)) return;
    try {
      const snap = await adminDb.collection(BOSS_ASSETS_COLLECTION).get();
      const assets = snap.docs
        .map(toSourceAssetSummary)
        .sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')));
      res.json({ assets });
    } catch (error) {
      logUnexpectedError('Collection-style source asset lookup failed:', error);
      res.status(error.statusCode ?? 500).json({ error: getErrorMessage(error, 'Failed to load Boss Asset character layers.') });
    }
  });

  app.post('/api/admin/collection-style/training', async (req, res) => {
    const caller = await authenticate(req, res);
    if (!caller || !requireDatabase(res)) return;
    if (!FAL_KEY) {
      res.status(503).json({ error: 'Fal LoRA training is not configured.' });
      return;
    }

    let jobRef;
    try {
      if (!isPlainObject(req.body)) throw badRequest('Request body must be a JSON object.');
      if (req.body.ownershipConfirmed !== true || req.body.characterLayersConfirmed !== true) {
        throw badRequest('Confirm that every source is owned and is character-layer art only.');
      }
      const sourceCardIds = normalizeCollectionStyleSourceIds(req.body.sourceCardIds);
      const triggerToken = normalizeCollectionStyleToken(req.body.triggerToken);
      const captions = getSourceCaptions(req.body.captions);
      const characterProfile = resolveFalProfile('character');
      if (!characterProfile?.modelUrl) {
        throw Object.assign(new Error('The Forge character model is not configured.'), { statusCode: 503 });
      }
      if (!adminStorage || !storageBucket) {
        throw Object.assign(new Error('Firebase Storage is required for collection-style training.'), { statusCode: 503 });
      }

      const sourceSnapshots = await Promise.all(
        sourceCardIds.map((id) => adminDb.collection(BOSS_ASSETS_COLLECTION).doc(id).get()),
      );
      const sourceCards = sourceSnapshots.map((snap, index) => {
        if (!snap.exists) throw badRequest(`Boss Asset "${sourceCardIds[index]}" was not found.`, 404);
        const card = snap.data() ?? {};
        if (!isAllowedCharacterLayerUrl(card.characterImageUrl)) {
          throw badRequest(`Boss Asset "${sourceCardIds[index]}" does not contain an eligible persisted character layer.`);
        }
        return { id: sourceCardIds[index], card };
      });
      assertCollectionStyleSourceVariety(sourceCards.map(({ card }) => card));

      const profileRef = adminDb.collection(PROFILE_COLLECTION).doc(COLLECTION_STYLE_PROFILE_ID);
      const timestamp = now();
      const jobId = randomUUID();
      jobRef = adminDb.collection(TRAINING_JOBS_COLLECTION).doc(jobId);
      await adminDb.runTransaction(async (transaction) => {
        const profileSnap = await transaction.get(profileRef);
        const profile = profileSnap.exists ? profileSnap.data() ?? {} : {};
        if (
          profile?.training?.status === 'preparing'
          || profile?.training?.status === 'training'
        ) {
          throw badRequest('A collection-style LoRA training job is already active.', 409);
        }
        transaction.set(jobRef, {
          id: jobId,
          profileId: COLLECTION_STYLE_PROFILE_ID,
          status: 'preparing',
          triggerToken,
          modelUrl: characterProfile.modelUrl,
          trainingModel,
          sourceCount: sourceCards.length,
          sourceCards: sourceCards.map(({ id, card }) => ({
            id,
            caption: buildCollectionStyleCaption(card, triggerToken, captions[id]),
          })),
          ownershipConfirmed: true,
          characterLayersConfirmed: true,
          createdBy: caller.uid,
          submittedAt: toIso(timestamp),
          updatedAt: toIso(timestamp),
        });
        transaction.set(profileRef, {
          id: COLLECTION_STYLE_PROFILE_ID,
          training: {
            jobId,
            status: 'preparing',
            startedAt: toIso(timestamp),
          },
          updatedAt: toIso(timestamp),
        }, { merge: true });
      });

      const archiveEntries = [];
      for (let index = 0; index < sourceCards.length; index += 1) {
        const { id, card } = sourceCards[index];
        const image = await downloadTrainingImage(fetchImpl, card.characterImageUrl);
        const stem = `${String(index + 1).padStart(3, '0')}-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
        archiveEntries.push(
          { name: `${stem}.${image.extension}`, data: image.data },
          { name: `${stem}.txt`, data: Buffer.from(buildCollectionStyleCaption(card, triggerToken, captions[id]), 'utf8') },
        );
      }
      const archive = buildTrainingDatasetZip(archiveEntries, new Date(timestamp));
      const datasetUrl = await uploadTrainingDataset({
        adminStorage,
        storageBucket,
        storagePath: `collectionStyleTraining/${jobId}/dataset.zip`,
        archive,
        randomUUID,
      });

      const submitted = await fal.queue.submit(trainingModel, {
        input: {
          images_data_url: datasetUrl,
          trigger_word: triggerToken,
          is_style: true,
        },
      });
      const falRequestId = typeof submitted?.request_id === 'string' ? submitted.request_id : '';
      if (!falRequestId) {
        throw new Error('Fal did not return a LoRA training request ID.');
      }
      const updatedAt = toIso(now());
      await jobRef.set({
        status: 'training',
        falRequestId,
        datasetPath: `collectionStyleTraining/${jobId}/dataset.zip`,
        updatedAt,
      }, { merge: true });
      await adminDb.collection(PROFILE_COLLECTION).doc(COLLECTION_STYLE_PROFILE_ID).set({
        training: { jobId, status: 'training', startedAt: toIso(timestamp) },
        updatedAt,
      }, { merge: true });
      res.status(202).json({ jobId, status: 'training' });
    } catch (error) {
      logUnexpectedError('Collection-style training submission failed:', error);
      if (jobRef) {
        const failedAt = toIso(now());
        await Promise.all([
          jobRef.set({
            status: 'failed',
            error: getErrorMessage(error, 'Collection-style training submission failed.'),
            updatedAt: failedAt,
          }, { merge: true }),
          adminDb.collection(PROFILE_COLLECTION).doc(COLLECTION_STYLE_PROFILE_ID).set({
            training: { jobId: jobRef.id, status: 'failed', failedAt },
            updatedAt: failedAt,
          }, { merge: true }),
        ]).catch(() => {});
      }
      res.status(error.statusCode ?? 500).json({ error: getErrorMessage(error, 'Failed to start collection-style training.') });
    }
  });

  app.get('/api/admin/collection-style/training/:jobId', async (req, res) => {
    if (!await authenticate(req, res) || !requireDatabase(res)) return;
    try {
      if (!FAL_KEY) throw Object.assign(new Error('Fal LoRA training is not configured.'), { statusCode: 503 });
      const jobId = normalizeJobId(req.params.jobId);
      const jobRef = adminDb.collection(TRAINING_JOBS_COLLECTION).doc(jobId);
      const jobSnap = await jobRef.get();
      if (!jobSnap.exists) throw badRequest('Collection training job not found.', 404);
      const job = { id: jobSnap.id, ...jobSnap.data() };
      if (job.status !== 'training' || !job.falRequestId) {
        const profileSnap = await adminDb.collection(PROFILE_COLLECTION).doc(COLLECTION_STYLE_PROFILE_ID).get();
        res.json({
          job,
          profile: profileSnap.exists ? { id: profileSnap.id, ...profileSnap.data() } : null,
        });
        return;
      }

      const status = await fal.queue.status(job.trainingModel || trainingModel, {
        requestId: job.falRequestId,
        logs: false,
      });
      if (status?.status === 'COMPLETED') {
        const result = await fal.queue.result(job.trainingModel || trainingModel, {
          requestId: job.falRequestId,
        });
        const loraUrl = extractFalLoraUrl(result);
        if (!loraUrl) throw badRequest('Fal training completed without a compatible LoRA URL.', 502);
        const completedAt = toIso(now());
        const resultData = result?.data ?? result ?? {};
        const version = typeof resultData?.version === 'string'
          ? resultData.version
          : typeof resultData?.model_version === 'string'
            ? resultData.model_version
            : job.id;
        const loraScale = numericScale(job.loraScale, defaultLoraScale);
        const profile = {
          id: COLLECTION_STYLE_PROFILE_ID,
          status: 'ready',
          kind: 'character-style-lora',
          version,
          loraUrl,
          loraScale,
          triggerToken: job.triggerToken,
          modelUrl: job.modelUrl,
          trainingModel: job.trainingModel || trainingModel,
          trainingJobId: job.id,
          sourceCount: job.sourceCount,
          sourceCardIds: Array.isArray(job.sourceCards) ? job.sourceCards.map((source) => source.id) : [],
          updatedAt: completedAt,
          activatedAt: completedAt,
          training: null,
        };
        await Promise.all([
          jobRef.set({
            status: 'completed',
            loraUrl,
            version,
            completedAt,
            updatedAt: completedAt,
          }, { merge: true }),
          adminDb.collection(PROFILE_COLLECTION).doc(COLLECTION_STYLE_PROFILE_ID).set(profile, { merge: true }),
        ]);
        res.json({ job: { ...job, status: 'completed', loraUrl, version, completedAt }, profile });
        return;
      }

      if (status?.status === 'FAILED' || status?.status === 'CANCELLED') {
        const failedAt = toIso(now());
        const error = 'Fal collection-style LoRA training did not complete.';
        await Promise.all([
          jobRef.set({ status: 'failed', error, failedAt, updatedAt: failedAt }, { merge: true }),
          adminDb.collection(PROFILE_COLLECTION).doc(COLLECTION_STYLE_PROFILE_ID).set({
            training: { jobId: job.id, status: 'failed', failedAt },
            updatedAt: failedAt,
          }, { merge: true }),
        ]);
        res.json({ job: { ...job, status: 'failed', error, failedAt } });
        return;
      }

      res.json({ job: { ...job, queueStatus: status?.status ?? 'IN_QUEUE' } });
    } catch (error) {
      logUnexpectedError('Collection-style training status failed:', error);
      res.status(error.statusCode ?? 500).json({ error: getErrorMessage(error, 'Failed to refresh collection-style training.') });
    }
  });

  app.post('/api/admin/collection-style/batches', async (req, res) => {
    const caller = await authenticate(req, res);
    if (!caller || !requireDatabase(res)) return;
    try {
      if (!isPlainObject(req.body ?? {})) throw badRequest('Request body must be a JSON object.');
      const requestedCount = req.body?.totalCards;
      if (
        requestedCount !== undefined
        && requestedCount !== null
        && Number(requestedCount) !== COLLECTION_STYLE_CARD_COUNT
      ) {
        throw badRequest(`Collection batches must contain exactly ${COLLECTION_STYLE_CARD_COUNT} cards.`);
      }
      const profileSnap = await adminDb.collection(PROFILE_COLLECTION).doc(COLLECTION_STYLE_PROFILE_ID).get();
      const profile = getProfileSnapshot(profileSnap.exists ? { id: profileSnap.id, ...profileSnap.data() } : null);
      if (!profile) throw badRequest('Complete a collection-style LoRA training job before creating a batch.', 409);
      const characterProfile = resolveFalProfile('character');
      if (!characterProfile?.modelUrl || characterProfile.modelUrl !== profile.modelUrl) {
        throw badRequest('The active Forge character model changed. Train a compatible collection-style LoRA before batching.', 409);
      }

      const timestamp = now();
      const batchId = randomUUID();
      const cards = buildCollectionStyleCards({
        batchId,
        totalCards: COLLECTION_STYLE_CARD_COUNT,
        profileId: profile.id,
        profileVersion: profile.version,
        createdAt: toIso(timestamp),
      });
      const batchRef = adminDb.collection(BATCHES_COLLECTION).doc(batchId);
      const batch = {
        id: batchId,
        status: 'approval',
        phase: 'approval',
        totalCards: COLLECTION_STYLE_CARD_COUNT,
        approvalCount: COLLECTION_STYLE_APPROVAL_COUNT,
        styleProfile: profile,
        createdBy: caller.uid,
        createdAt: toIso(timestamp),
        updatedAt: toIso(timestamp),
      };
      const writeBatch = adminDb.batch();
      writeBatch.set(batchRef, batch);
      for (const [index, card] of cards.entries()) {
        writeBatch.set(batchRef.collection(BATCH_CARDS_COLLECTION).doc(card.id), {
          id: card.id,
          index,
          name: card.identity.name,
          status: 'pending',
          attempts: 0,
          card,
          createdAt: toIso(timestamp),
          updatedAt: toIso(timestamp),
        });
      }
      await writeBatch.commit();
      res.status(201).json({ batch: summarizeBatch(batch) });
    } catch (error) {
      logUnexpectedError('Collection-style batch creation failed:', error);
      res.status(error.statusCode ?? 500).json({ error: getErrorMessage(error, 'Failed to create collection batch.') });
    }
  });

  app.get('/api/admin/collection-style/batches/:batchId', async (req, res) => {
    if (!await authenticate(req, res) || !requireDatabase(res)) return;
    try {
      const batchId = normalizeBatchId(req.params.batchId);
      const batchRef = adminDb.collection(BATCHES_COLLECTION).doc(batchId);
      const [batchSnap, itemsSnap] = await Promise.all([
        batchRef.get(),
        batchRef.collection(BATCH_CARDS_COLLECTION).get(),
      ]);
      if (!batchSnap.exists) throw badRequest('Collection batch not found.', 404);
      const items = itemsSnap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((left, right) => left.index - right.index);
      res.json({ batch: summarizeBatch({ id: batchSnap.id, ...batchSnap.data() }, items), items });
    } catch (error) {
      logUnexpectedError('Collection-style batch lookup failed:', error);
      res.status(error.statusCode ?? 500).json({ error: getErrorMessage(error, 'Failed to load collection batch.') });
    }
  });

  app.post('/api/admin/collection-style/batches/:batchId/approve', async (req, res) => {
    const caller = await authenticate(req, res);
    if (!caller || !requireDatabase(res)) return;
    try {
      const batchId = normalizeBatchId(req.params.batchId);
      const batchRef = adminDb.collection(BATCHES_COLLECTION).doc(batchId);
      const [batchSnap, itemsSnap] = await Promise.all([
        batchRef.get(),
        batchRef.collection(BATCH_CARDS_COLLECTION).get(),
      ]);
      if (!batchSnap.exists) throw badRequest('Collection batch not found.', 404);
      const batch = { id: batchSnap.id, ...batchSnap.data() };
      if (batch.phase !== 'approval') throw badRequest('This batch has already moved beyond visual approval.', 409);
      const approvedItems = itemsSnap.docs
        .map((docSnap) => docSnap.data() ?? {})
        .filter((item) => item.index < batch.approvalCount);
      if (approvedItems.length !== batch.approvalCount || approvedItems.some((item) => item.status !== 'completed')) {
        throw badRequest('Generate and review every approval card before releasing the remaining collection.', 409);
      }
      const approvedAt = toIso(now());
      await batchRef.set({
        status: 'production',
        phase: 'production',
        approvedBy: caller.uid,
        approvedAt,
        updatedAt: approvedAt,
      }, { merge: true });
      res.json({ batch: { ...batch, status: 'production', phase: 'production', approvedAt } });
    } catch (error) {
      logUnexpectedError('Collection-style batch approval failed:', error);
      res.status(error.statusCode ?? 500).json({ error: getErrorMessage(error, 'Failed to approve collection batch.') });
    }
  });

  app.post('/api/admin/collection-style/batches/:batchId/generate-next', async (req, res) => {
    const caller = await authenticate(req, res);
    if (!caller || !requireDatabase(res)) return;
    if (!FAL_KEY) {
      res.status(503).json({ error: 'Fal character generation is not configured.' });
      return;
    }
    if (!adminStorage || !storageBucket) {
      res.status(503).json({ error: 'Firebase Storage is required to persist collection character layers.' });
      return;
    }

    let claimed = null;
    try {
      if (!isPlainObject(req.body ?? {})) throw badRequest('Request body must be a JSON object.');
      const batchId = normalizeBatchId(req.params.batchId);
      const retryFailed = req.body.retryFailed === true;
      const batchRef = adminDb.collection(BATCHES_COLLECTION).doc(batchId);
      claimed = await claimNextBatchItem({
        adminDb,
        batchRef,
        retryFailed,
        now: now(),
      });
      if (!claimed.item) {
        res.json({ status: 'idle', message: 'No eligible collection card is waiting to generate.' });
        return;
      }

      const { batch, item, itemRef } = claimed;
      const card = item.card;
      if (!isPlainObject(card) || !card.id || !card.characterSeed) {
        throw new Error('Collection batch item is missing its generated card plan.');
      }
      const assetRef = adminDb.collection(BOSS_ASSETS_COLLECTION).doc(card.id);
      const existingAsset = await assetRef.get();
      if (existingAsset.exists && isAllowedCharacterLayerUrl(existingAsset.data()?.characterImageUrl)) {
        const recoveredAt = toIso(now());
        await Promise.all([
          itemRef.set({
            status: 'completed',
            resultCardId: card.id,
            recoveredAt,
            completedAt: recoveredAt,
            updatedAt: recoveredAt,
            leaseExpiresAt: null,
          }, { merge: true }),
          batchRef.set({ updatedAt: recoveredAt }, { merge: true }),
        ]);
        res.json({ status: 'completed', recovered: true, item: { ...item, status: 'completed', resultCardId: card.id } });
        return;
      }

      let characterImageUrl = isPermanentStorageUrl(item.generatedCharacterImageUrl)
        ? item.generatedCharacterImageUrl
        : null;
      if (!characterImageUrl) {
        characterImageUrl = await generateCollectionCharacter({
          batch,
          card,
          FAL_KEY,
          BIREFNET_URL,
          buildFalImageRequest,
          fetchImpl,
          persistImageToStorage,
          adminStorage,
          storageBucket,
        });
        const generatedAt = toIso(now());
        await itemRef.set({
          generatedCharacterImageUrl: characterImageUrl,
          generatedAt,
          updatedAt: generatedAt,
        }, { merge: true });
      }
      const completedAt = toIso(now());
      const completedCard = {
        ...card,
        characterImageUrl,
        collectionStyle: {
          ...(isPlainObject(card.collectionStyle) ? card.collectionStyle : {}),
          generatedAt: completedAt,
          generatedBy: caller.uid,
        },
      };
      await adminDb.runTransaction(async (transaction) => {
        transaction.set(assetRef, completedCard, { merge: true });
        transaction.set(itemRef, {
          status: 'completed',
          resultCardId: card.id,
          completedAt,
          updatedAt: completedAt,
          leaseExpiresAt: null,
          lastError: null,
        }, { merge: true });
        transaction.set(batchRef, { updatedAt: completedAt }, { merge: true });
      });
      res.json({
        status: 'completed',
        recovered: false,
        item: { ...item, status: 'completed', resultCardId: card.id, card: completedCard },
      });
    } catch (error) {
      logUnexpectedError('Collection-style card generation failed:', error);
      if (claimed?.itemRef) {
        const failedAt = toIso(now());
        await Promise.all([
          claimed.itemRef.set({
            status: 'failed',
            lastError: getErrorMessage(error, 'Collection character generation failed.'),
            failedAt,
            updatedAt: failedAt,
            leaseExpiresAt: null,
          }, { merge: true }),
          adminDb.collection(BATCHES_COLLECTION).doc(claimed.batch.id).set({
            updatedAt: failedAt,
          }, { merge: true }),
        ]).catch(() => {});
      }
      res.status(error.statusCode ?? 500).json({ error: getErrorMessage(error, 'Failed to generate collection card.') });
    }
  });
}
