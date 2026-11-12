/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '필사 노트 — 영어 필사 학습',
        short_name: '필사 노트',
        description: '매일 한 지문, 듣고 읽고 필사하는 개인용 영어 학습 앱',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f7f4ec',
        theme_color: '#2f6b4f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        globIgnores: ['lessons/**'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/lessons/index.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'lesson-index', networkTimeoutSeconds: 4 },
          },
          {
            urlPattern: ({ url }) => /\/lessons\/(general|toeic)\/[^/]+\.json$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'lessons', expiration: { maxEntries: 2000 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
