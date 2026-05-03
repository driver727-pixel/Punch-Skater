import { randomUUID } from 'node:crypto';

const FIREBASE_STORAGE_DOWNLOAD_TIMEOUT_MS = 60_000;
const FIREBASE_STORAGE_BASE_URL = 'https://firebasestorage.googleapis.com';

/**
 * Returns true when `url` is already a Firebase Storage download URL so we
 * never double-upload an already-persisted image.
 *
 * @param {string} url
 * @returns {boolean}
 */
function isFirebaseStorageUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const { hostname } = new URL(url);
    return hostname === 'firebasestorage.googleapis.com' ||
      hostname.endsWith('.firebasestorage.googleapis.com') ||
      hostname === 'storage.googleapis.com' ||
      hostname.endsWith('.storage.googleapis.com');
  } catch {
    return false;
  }
}

/**
 * Downloads an image from `sourceUrl` and uploads it to Firebase Storage,
 * returning a permanent tokenised download URL.
 *
 * If `adminStorage` or `storageBucket` is absent, or if `sourceUrl` is
 * already a Firebase Storage URL, the function returns `sourceUrl` unchanged
 * so the caller degrades gracefully without any storage credentials.
 *
 * @param {object|null} adminStorage  - Firebase Admin Storage instance returned by getStorage().
 * @param {string}      sourceUrl     - Temporary fal.ai CDN image URL.
 * @param {string}      storageBucket - Firebase Storage bucket name (e.g. "my-project.appspot.com").
 * @param {string}      storagePath   - Destination path inside the bucket (e.g. "generatedImages/boards/abc.png").
 * @returns {Promise<string>} Permanent download URL, or `sourceUrl` on any failure.
 */
export async function persistImageToStorage(adminStorage, sourceUrl, storageBucket, storagePath) {
  if (!adminStorage || !storageBucket || !sourceUrl || !storagePath) {
    return sourceUrl;
  }

  if (isFirebaseStorageUrl(sourceUrl)) {
    return sourceUrl;
  }

  try {
    const response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(FIREBASE_STORAGE_DOWNLOAD_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(`[imageStorage] Failed to download ${sourceUrl}: HTTP ${response.status}`);
      return sourceUrl;
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());
    const token = randomUUID();

    const bucket = adminStorage.bucket(storageBucket);
    const file = bucket.file(storagePath);

    await file.save(buffer, {
      contentType,
      metadata: {
        // Setting firebaseStorageDownloadTokens generates a stable Firebase
        // client-SDK-compatible download URL for this file.
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const encodedPath = encodeURIComponent(storagePath);
    const encodedBucket = encodeURIComponent(storageBucket);
    return `${FIREBASE_STORAGE_BASE_URL}/v0/b/${encodedBucket}/o/${encodedPath}?alt=media&token=${token}`;
  } catch (err) {
    console.warn('[imageStorage] Image persistence failed, falling back to original URL:', err.message);
    return sourceUrl;
  }
}
