import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';

function createRedisStore(redisClient) {
  return new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  });
}

export function createRateLimitStore(redisUrl, log = console) {
  const trimmedUrl = typeof redisUrl === 'string' ? redisUrl.trim() : '';
  if (!trimmedUrl) return { redisClient: null, store: undefined };

  const redisClient = createClient({ url: trimmedUrl });
  redisClient.on('error', (error) => {
    log.error?.('Redis rate-limit client error:', error);
  });
  redisClient.connect().catch((error) => {
    log.error?.('Redis rate-limit connection failed:', error);
  });

  return {
    redisClient,
    store: createRedisStore(redisClient),
  };
}

export function shouldSkipRateLimitRequest(req) {
  return req?.method === 'OPTIONS';
}

export function buildRateLimiter({ windowMs, max, message, store }) {
  return rateLimit({
    windowMs,
    max,
    skip: shouldSkipRateLimitRequest,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message,
    passOnStoreError: true,
    ...(store ? { store } : {}),
  });
}
