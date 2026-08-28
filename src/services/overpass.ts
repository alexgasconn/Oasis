import { Fountain } from '../types';

// List of Overpass API mirrors to distribute load and handle rate limits
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter'
];

// Simple in-memory cache to avoid redundant calls
const cache = new Map<string, { data: Fountain[], timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches drinking water fountains from the OpenStreetMap Overpass API.
 */
export async function fetchFountainsAround(
  lat: number,
  lng: number,
  radius: number = 5000,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<Fountain[]> {
  // Round coordinates to ~100m precision for caching keys
  const cacheKey = `${lat.toFixed(3)}-${lng.toFixed(3)}-${radius}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="drinking_water"](around:${radius},${lat},${lng});
      node["amenity"="fountain"]["drinking_water"="yes"](around:${radius},${lat},${lng});
      node["man_made"="water_tap"]["drinking_water"="yes"](around:${radius},${lat},${lng});
    );
    out body;
  `;

  const encodedQuery = encodeURIComponent(query);
  let lastError: any = null;
  const timeoutMs = options?.timeoutMs ?? 10000; // per-request timeout default 10s

  // Try different mirrors with a simple retry strategy
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const mirror of OVERPASS_MIRRORS) {
      // If the caller already aborted, stop immediately and propagate
      if (options?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      let attemptController = new AbortController();
      const linkedSignal = attemptController.signal;
      const onParentAbort = () => attemptController.abort();
      if (options?.signal) options.signal.addEventListener('abort', onParentAbort);

      const attemptTimeout = setTimeout(() => attemptController.abort(), timeoutMs);

      try {
        const url = `${mirror}?data=${encodedQuery}`;
        const response = await fetch(url, { signal: linkedSignal });

        if (response.status === 429) {
          console.warn(`Mirror ${mirror} returned 429 (Too Many Requests). Trying next...`);
          continue; // Try next mirror
        }

        if (!response.ok) {
          throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const fountains: Fountain[] = data.elements.map((el: any) => {
          let potable: 'yes' | 'no' | 'unknown' = 'unknown';
          const tags = el.tags || {};

          if (tags.drinking_water === 'yes' || tags.potable === 'yes') potable = 'yes';
          else if (tags.drinking_water === 'no' || tags.potable === 'no') potable = 'no';
          else if (tags.amenity === 'drinking_water') potable = 'yes';

          return {
            id: el.id.toString(),
            lat: el.lat,
            lng: el.lon,
            type: tags.natural === 'spring' ? 'natural' : 'urban',
            potable: potable,
            status: tags.operational_status === 'broken' ? 'broken' : 'working',
            description: tags.description || tags.name || null,
          };
        });

        // Store in cache
        cache.set(cacheKey, { data: fountains, timestamp: Date.now() });
        return fountains;

      } catch (error) {
        lastError = error;
        // If the fetch was aborted because the parent signal was aborted, propagate
        if ((error as any)?.name === 'AbortError' && options?.signal?.aborted) {
          // Clean up and rethrow to let caller handle abort
          throw error;
        }
        console.warn(`Failed to fetch from ${mirror}:`, error);
        // Continue to next mirror
      } finally {
        clearTimeout(attemptTimeout);
        if (options?.signal) options.signal.removeEventListener('abort', onParentAbort);
      }
    }

    // If all mirrors failed, wait a bit before next attempt (exponential backoff)
    if (attempt < 2) {
      const waitTime = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  console.error("All Overpass API mirrors failed:", lastError);
  throw lastError instanceof Error ? lastError : new Error('All Overpass API mirrors failed');
}
