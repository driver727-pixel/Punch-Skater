import { randomUUID } from 'node:crypto';
import { persistImageToStorage } from '../lib/imageStorage.js';

const BOARD_IMAGE_SIZE = { width: 512, height: 512 };
const FAL_PROXY_TIMEOUT_MS = 300_000; // 5 minutes — AI generation can be slow

function extractBoardImageUrl(result) {
  if (process.env.FAL_DEBUG) console.log('Raw fal board result:', JSON.stringify(result));

  const data = result?.data ?? result;

  if (typeof data?.image === 'string' && data.image) return data.image;
  if (typeof data?.image?.url === 'string' && data.image.url) return data.image.url;
  if (typeof data?.image_url === 'string' && data.image_url) return data.image_url;
  if (Array.isArray(data?.images) && typeof data.images[0]?.url === 'string' && data.images[0].url) {
    return data.images[0].url;
  }
  if (typeof data?.output === 'string' && data.output) return data.output;
  if (typeof data?.output?.url === 'string' && data.output.url) return data.output.url;
  if (typeof result?.image?.url === 'string' && result.image.url) return result.image.url;

  return null;
}

export function registerImageRoutes(app, {
  fal,
  FAL_KEY,
  BIREFNET_URL,
  imageRateLimit,
  boardImageStatusRateLimit,
  authenticateFirebaseUser,
  sanitizeGenerateImageBody,
  sanitizeBoardImageBody,
  sanitizeBackgroundRemovalBody,
  buildFalImageRequest,
  normalizeFalProfile,
  resolveFalProfile,
  boardImageJobs,
  pruneBoardImageJobs,
  adminStorage = null,
  storageBucket = '',
}) {
  app.post('/api/generate-image', imageRateLimit, async (req, res) => {
    try {
      if (!FAL_KEY) {
        res.status(503).json({ error: 'Image generation is not configured.' });
        return;
      }

      await authenticateFirebaseUser(req);
      const sanitizedBody = sanitizeGenerateImageBody(req.body);
      const profileSettings = resolveFalProfile(normalizeFalProfile(sanitizedBody.fal_profile));
      const upstream = await fetch(profileSettings.modelUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${FAL_KEY}`,
        },
        body: JSON.stringify(await buildFalImageRequest(sanitizedBody)),
        signal: AbortSignal.timeout(FAL_PROXY_TIMEOUT_MS),
      });

      if (!upstream.ok) {
        const text = await upstream.text();
        let body;
        try { body = JSON.parse(text); } catch { body = { error: text }; }
        res.status(upstream.status).json(body);
        return;
      }

      const data = await upstream.json();

      // Persist each image URL to Firebase Storage so clients receive permanent
      // URLs instead of temporary fal.ai CDN links that expire after ~24 hours.
      if (adminStorage && storageBucket && Array.isArray(data?.images)) {
        data.images = await Promise.all(
          data.images.map(async (img, index) => {
            if (typeof img?.url !== 'string') return img;
            const storagePath = `generatedImages/generated/${randomUUID()}-${index}.png`;
            const persistedUrl = await persistImageToStorage(adminStorage, img.url, storageBucket, storagePath);
            return { ...img, url: persistedUrl };
          }),
        );
      }

      res.json(data);
    } catch (err) {
      console.error('Proxy error:', err);
      res.status(err.statusCode ?? 500).json({ error: err.message ?? 'Image generation proxy failed.' });
    }
  });

  app.post('/api/generate-board-image', imageRateLimit, async (req, res) => {
    try {
      if (!FAL_KEY) {
        res.status(503).json({ error: 'Board image generation is not configured.' });
        return;
      }

      const caller = await authenticateFirebaseUser(req);
      const { prompt, imageUrls } = sanitizeBoardImageBody(req.body);
      if (!prompt || !imageUrls) {
        res.status(400).json({ error: 'A prompt and exactly four Punch Skater board image URLs are required.' });
        return;
      }

      const { request_id: jobId } = await fal.queue.submit('fal-ai/nano-banana-2', {
        input: {
          prompt,
          image_urls: imageUrls,
          image_size: BOARD_IMAGE_SIZE,
          thinking_level: 'high',
          enable_web_search: false,
        },
      });

      pruneBoardImageJobs();
      boardImageJobs.set(jobId, {
        uid: caller.uid,
        createdAt: Date.now(),
      });
      res.json({ jobId });
    } catch (err) {
      console.error('Board image submit error:', err);
      res.status(err.statusCode ?? 500).json({ error: err.message ?? 'Board image generation submission failed.' });
    }
  });

  app.get('/api/board-image-status/:jobId', boardImageStatusRateLimit, async (req, res) => {
    try {
      if (!FAL_KEY) {
        res.status(503).json({ error: 'Board image generation is not configured.' });
        return;
      }

      const caller = await authenticateFirebaseUser(req);
      const { jobId } = req.params;
      if (!jobId || !/^[a-zA-Z0-9_-]+$/.test(jobId)) {
        res.status(400).json({ error: 'Invalid jobId.' });
        return;
      }

      pruneBoardImageJobs();
      const jobOwner = boardImageJobs.get(jobId);
      if (!jobOwner || jobOwner.uid !== caller.uid) {
        res.status(404).json({ error: 'Board image job not found.' });
        return;
      }

      const status = await fal.queue.status('fal-ai/nano-banana-2', {
        requestId: jobId,
        logs: false,
      });

      if (status.status === 'COMPLETED') {
        const result = await fal.queue.result('fal-ai/nano-banana-2', { requestId: jobId });
        const falImageUrl = extractBoardImageUrl(result);
        if (!falImageUrl) {
          res.status(502).json({ error: 'Fal.ai did not return a board image URL.' });
          return;
        }
        boardImageJobs.delete(jobId);

        // Persist to Firebase Storage so the stored URL never expires.
        const storagePath = `generatedImages/boards/${jobId}.png`;
        const imageUrl = await persistImageToStorage(adminStorage, falImageUrl, storageBucket, storagePath);

        res.json({ status: 'completed', imageUrl, requestId: jobId });
        return;
      }

      if (status.status === 'FAILED' || status.status === 'CANCELLED') {
        boardImageJobs.delete(jobId);
        res.status(502).json({ status: 'failed', error: 'Board image generation job failed.' });
        return;
      }

      res.json({ status: 'pending' });
    } catch (err) {
      console.error('Board image status error:', err);
      res.status(err.statusCode ?? 500).json({ error: err.message ?? 'Failed to retrieve board image job status.' });
    }
  });

  app.post('/api/remove-background', imageRateLimit, async (req, res) => {
    try {
      if (!FAL_KEY) {
        res.status(503).json({ error: 'Background removal is not configured.' });
        return;
      }

      await authenticateFirebaseUser(req);
      const sanitizedBody = sanitizeBackgroundRemovalBody(req.body);
      const upstream = await fetch(BIREFNET_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${FAL_KEY}`,
        },
        body: JSON.stringify(sanitizedBody),
        signal: AbortSignal.timeout(FAL_PROXY_TIMEOUT_MS),
      });

      if (!upstream.ok) {
        const text = await upstream.text();
        let body;
        try { body = JSON.parse(text); } catch { body = { error: text }; }
        res.status(upstream.status).json(body);
        return;
      }

      const data = await upstream.json();

      // Persist the background-removed image to Firebase Storage for a permanent URL.
      if (adminStorage && storageBucket && typeof data?.image?.url === 'string') {
        const storagePath = `generatedImages/characters/${randomUUID()}.png`;
        data.image = {
          ...data.image,
          url: await persistImageToStorage(adminStorage, data.image.url, storageBucket, storagePath),
        };
      }

      res.json(data);
    } catch (err) {
      console.error('Background removal proxy error:', err);
      res.status(err.statusCode ?? 500).json({ error: err.message ?? 'Background removal proxy failed.' });
    }
  });
}
