import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const _buildDate = new Date();
const _buildNumber = [
  _buildDate.getUTCFullYear(),
  String(_buildDate.getUTCMonth() + 1).padStart(2, '0'),
  String(_buildDate.getUTCDate()).padStart(2, '0'),
].join('') + '.' + [
  String(_buildDate.getUTCHours()).padStart(2, '0'),
  String(_buildDate.getUTCMinutes()).padStart(2, '0'),
].join('');

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  define: {
    __BUILD_NUMBER__: JSON.stringify(_buildNumber),
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
    pure: process.env.NODE_ENV === 'production' ? ['console.log', 'console.info', 'console.debug'] : [],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase/firestore') ||
              id.includes('node_modules/@firebase/firestore')) return 'vendor-firestore';
          if (id.includes('node_modules/firebase/auth') ||
              id.includes('node_modules/@firebase/auth')) return 'vendor-firebase-auth';
          if (id.includes('node_modules/firebase')) return 'vendor-firebase';
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router-dom/') ||
            id.includes('/node_modules/react-router/')
          ) return 'vendor-react';
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt', 'LICENSE.txt', 'pwa-192x192.png', 'pwa-512x512.png'],
      workbox: {
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,svg,webp,webmanifest,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 86400,
              },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              request.destination === 'image' &&
              url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-image-assets',
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Punch Skater',
        short_name: 'PunchSkater',
        description: 'Forge unique AI-powered courier trading cards, build competitive decks, and trade with other skaters across five dystopian districts.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        id: 'com.spdigital.punchskater',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
