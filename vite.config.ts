import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // We removed the strict 'includeAssets' list so it won't fail if files are missing
      manifest: {
        name: 'Skater Punk Deck Builder',
        short_name: 'SkaterPunk',
        description: 'A cyberpunk-themed card deck builder game.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any' 
          }
        ]
      }
    })
  ]
})
