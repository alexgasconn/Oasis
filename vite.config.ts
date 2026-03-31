import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Oasis – Fuentes de Agua',
          short_name: 'Oasis',
          description: 'Encuentra fuentes de agua potable cerca de ti. Para corredores, ciclistas y senderistas.',
          id: '/',
          start_url: '/',
          scope: '/',
          theme_color: '#3b82f6',
          background_color: '#f9fafb',
          display: 'standalone',
          display_override: ['standalone', 'fullscreen'],
          orientation: 'portrait-primary',
          categories: ['navigation', 'sports', 'utilities'],
          lang: 'es',
          icons: [
            {
              src: '/icon.svg',
              sizes: '192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ],
          shortcuts: [
            {
              name: 'Buscar fuentes cercanas',
              short_name: 'Buscar',
              description: 'Abre el mapa con fuentes cercanas',
              url: '/',
              icons: [{ src: '/icon.svg', sizes: '96x96' }]
            }
          ]
        },
        workbox: {
          // Cache map tiles and Overpass API responses for offline use
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
              handler: 'CacheFirst',
              options: { cacheName: 'osm-tiles', expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 } }
            },
            {
              urlPattern: /^https:\/\/.*\.basemaps\.cartocdn\.com\/.*/i,
              handler: 'CacheFirst',
              options: { cacheName: 'carto-tiles', expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 } }
            },
            {
              urlPattern: /^https:\/\/overpass-.*/i,
              handler: 'NetworkFirst',
              options: { cacheName: 'overpass-api', expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 } }
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
