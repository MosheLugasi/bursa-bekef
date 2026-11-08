import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import base44 from '@base44/vite-plugin';
import path from 'node:path';

// BASE_PATH מוגדר ב-GitHub Actions לשם הריפו (למשל /bursa-bekef/) עבור GitHub Pages
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  plugins: [
    // נדרש לתצוגה המקדימה בעורך של Base44 (לא משפיע על האתר ב-GitHub Pages)
    base44({ hmrNotifier: true, navigationNotifier: true, visualEditAgent: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'בורסה בכיף',
        short_name: 'בורסה בכיף',
        description: 'משחק מסחר בבורסה לילדים ולמתחילים – עם נתונים אמיתיים',
        lang: 'he',
        dir: 'rtl',
        theme_color: '#4f46e5',
        background_color: '#f5f3ff',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'NetworkFirst',
            options: { cacheName: 'market-data', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          }
        ]
      }
    })
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
} as any);