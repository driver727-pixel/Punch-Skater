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
    minify: 'esbuild',
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
      // Use the hand-written src/sw.ts so we can add custom error handling
      // (e.g. returning a 404 stub for missing images instead of letting
      // Workbox throw an unhandled "no-response" rejection).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'robots.txt', 'LICENSE.txt', 'pwa-192x192.png', 'pwa-512x512.png'],
      workbox: {
        // Keep the large animated loading webp out of the install-time precache;
        // it is fetched on demand and runtime-cached via the /assets image rule.
        globPatterns: ['**/*.{html,js,css,ico,svg,webp,webmanifest,woff2}'],
        globIgnores: ['**/loading_2.webp'],
      },
      manifest: {
        name: 'Punch Skater™',
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
