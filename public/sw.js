const CACHE_NAME = 'oasis-cache-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Simple pass-through fetch handler to satisfy PWA installability requirements
  e.respondWith(
    fetch(e.request).catch(() => {
      // Return a basic offline response if needed, or just let it fail gracefully
      return new Response('Offline mode');
    })
  );
});
