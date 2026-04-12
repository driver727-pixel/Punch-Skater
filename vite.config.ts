import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

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
    nodePolyfills(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        clientsClaim: true,
        cleanupOutdatedCaches: true,
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
