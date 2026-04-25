const APP_CACHE = 'oasis-app-v2';
const TILE_CACHE = 'oasis-osm-catalonia-v2';
const API_CACHE = 'oasis-api-v1';
const TILE_HOST_PATTERN = /^https:\/\/[abc]\.tile\.openstreetmap\.org\//i;
const OVERPASS_PATTERN = /^https:\/\/(?:overpass-api\.de|overpass\.kumi\.systems|lz4\.overpass-api\.de|z\.overpass-api\.de)\//i;
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/apple-touch-icon.png',
];
const CATALONIA_BOUNDS = {
  west: 0.15,
  east: 3.33,
  south: 40.5,
  north: 42.92,
};
const PRELOAD_ZOOMS = [6, 7, 8, 9, 10, 11, 12];
const TILE_SUBDOMAINS = ['a', 'b', 'c'];

function lonToTileX(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function latToTileY(lat, zoom) {
  const radians = (lat * Math.PI) / 180;
  const mercator = Math.log(Math.tan(Math.PI / 4 + radians / 2));
  return Math.floor(((1 - mercator / Math.PI) / 2) * Math.pow(2, zoom));
}

function getCataloniaTileUrls() {
  const urls = [];

  for (const zoom of PRELOAD_ZOOMS) {
    const minX = lonToTileX(CATALONIA_BOUNDS.west, zoom);
    const maxX = lonToTileX(CATALONIA_BOUNDS.east, zoom);
    const minY = latToTileY(CATALONIA_BOUNDS.north, zoom);
    const maxY = latToTileY(CATALONIA_BOUNDS.south, zoom);

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const subdomain = TILE_SUBDOMAINS[(x + y) % TILE_SUBDOMAINS.length];
        urls.push(`https://${subdomain}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`);
      }
    }
  }

  return urls;
}

async function precacheAppShell() {
  const cache = await caches.open(APP_CACHE);
  await cache.addAll(APP_SHELL);
}

async function warmCataloniaTiles() {
  const cache = await caches.open(TILE_CACHE);
  const tileUrls = getCataloniaTileUrls();

  await Promise.allSettled(
    tileUrls.map(async (url) => {
      const cached = await cache.match(url);
      if (cached) return;

      const response = await fetch(url, { mode: 'no-cors', cache: 'no-store' });
      if (response) {
        await cache.put(url, response.clone());
      }
    })
  );
}

async function cleanupOldCaches() {
  const expectedCaches = new Set([APP_CACHE, TILE_CACHE, API_CACHE]);
  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames
      .filter((cacheName) => !expectedCaches.has(cacheName))
      .map((cacheName) => caches.delete(cacheName))
  );
}

async function handleNavigation(request) {
  const cache = await caches.open(APP_CACHE);

  try {
    const response = await fetch(request);
    cache.put('/index.html', response.clone());
    return response;
  } catch (_error) {
    return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
  }
}

async function handleSameOriginAsset(request) {
  const cache = await caches.open(APP_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
}

async function handleTileRequest(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return cached;

  try {
    const response = await fetch(request, { mode: 'no-cors', cache: 'no-store' });
    cache.put(request.url, response.clone());
    return response;
  } catch (_error) {
    return cached || Response.error();
  }
}

async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (_error) {
    return (await cache.match(request)) || Response.error();
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    Promise.all([
      precacheAppShell(),
      warmCataloniaTiles(),
    ])
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      cleanupOldCaches(),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (TILE_HOST_PATTERN.test(url.href)) {
    event.respondWith(handleTileRequest(request));
    return;
  }

  if (OVERPASS_PATTERN.test(url.href)) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(handleSameOriginAsset(request));
  }
});
