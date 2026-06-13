/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import type { PrecacheEntry } from 'workbox-precaching';

// ServiceWorkerGlobalScope is defined by the webworker lib above; we augment it
// with the __WB_MANIFEST token that vite-plugin-pwa injects at build time.
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

// Take control of all open clients immediately after activation.
self.skipWaiting();
clientsClaim();

// Remove caches from previous Workbox versions that are no longer needed.
cleanupOutdatedCaches();

// Install-time precache: all JS, CSS, HTML, SVG, webfonts, and webmanifest
// files listed in the Vite build manifest.
precacheAndRoute(self.__WB_MANIFEST);

// ── Navigation ──────────────────────────────────────────────────────────────
// NetworkFirst (3 s timeout) so returning users always get fresh HTML while
// still working offline.  Exclude server-side routes and standalone mini-games
// so they continue to hit the network directly.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'html-cache',
      networkTimeoutSeconds: 3,
      plugins: [
        new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 3600 }),
      ],
    }),
    { denylist: [/^\/api/, /^\/classic-race/, /^\/streets/] },
  ),
);

// ── Images ───────────────────────────────────────────────────────────────────
// CacheFirst for long-lived game art.  When neither the cache nor the network
// can provide a response (e.g. an asset has not been deployed yet) Workbox
// normally throws a WorkboxError("no-response") which bubbles up as an
// unhandled promise rejection in the console.  We catch that and return a
// synthetic 404 instead so the browser receives a clean error that the page
// can handle gracefully rather than a noisy uncaught rejection.
const imageStrategy = new CacheFirst({
  cacheName: 'static-image-assets',
  plugins: [
    new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    new CacheableResponsePlugin({ statuses: [200] }),
  ],
});

registerRoute(
  ({ request }) => request.destination === 'image',
  async (options) => {
    try {
      return await imageStrategy.handle(options);
    } catch {
      return new Response(null, { status: 404, statusText: 'Not Found' });
    }
  },
);

// ── Audio ────────────────────────────────────────────────────────────────────
// Same graceful-fallback pattern for sound files.
const audioStrategy = new CacheFirst({
  cacheName: 'audio-assets',
  plugins: [
    new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    new CacheableResponsePlugin({ statuses: [200] }),
  ],
});

registerRoute(
  ({ request }) => request.destination === 'audio',
  async (options) => {
    try {
      return await audioStrategy.handle(options);
    } catch {
      return new Response(null, { status: 404, statusText: 'Not Found' });
    }
  },
);

// ── API: landing crew faceoff ─────────────────────────────────────────────────
// StaleWhileRevalidate so the landing page loads instantly on repeat visits
// while still picking up fresh data in the background.
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' && url.pathname === '/api/hype/crew-faceoff',
  new StaleWhileRevalidate({
    cacheName: 'landing-faceoff-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 5 * 60 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
);
