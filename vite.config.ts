import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import base44 from '@base44/vite-plugin';
import path from 'node:path';
import shoriLanding from './landing/plugin.mjs';

// BASE_PATH מוגדר ב-GitHub Actions לשם הריפו (למשל /bursa-bekef/) עבור GitHub Pages
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  // שלושה דפים: דף נחיתה בעברית (/), באנגלית (/en/) והמשחק עצמו (/app/)
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        en: path.resolve(import.meta.dirname, 'en/index.html'),
        app: path.resolve(import.meta.dirname, 'app/index.html')
      }
    }
  },
  plugins: [
    // נדרש לתצוגה המקדימה בעורך של Base44 (לא משפיע על האתר ב-GitHub Pages)
    base44({ hmrNotifier: true, navigationNotifier: true, visualEditAgent: true }),
    shoriLanding(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'שורי – משחק בורסה לכל המשפחה',
        short_name: 'שורי',
        description: 'משחק בורסה וחינוך פיננסי לילדים ולמשפחה – עם נתוני שוק אמיתיים',
        lang: 'he',
        dir: 'rtl',
        theme_color: '#5b3df5',
        background_color: '#faf8f3',
        display: 'standalone',
        start_url: 'app/',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webp}'],
        globIgnores: ['og/**'],
        // אין SPA יחיד: כל דף (נחיתה / en / app) נטען מהקובץ שלו
        navigateFallback: null,
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