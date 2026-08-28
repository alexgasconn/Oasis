import { Fountain } from '../types';

// Bundled, offline dataset of Catalunya drinking-water points, extracted once
// from OpenStreetMap data via tools/extract-fountains.cjs (see repo memory).
// Acts as a baseline so the app always shows fountains in Catalunya even when
// the live Overpass API is unreachable or rate-limited.
let cache: Fountain[] | null = null;
let loadPromise: Promise<Fountain[]> | null = null;

export function loadLocalCatalunyaFountains(): Promise<Fountain[]> {
    if (cache) return Promise.resolve(cache);
    if (loadPromise) return loadPromise;

    loadPromise = fetch('/data/fountains-catalunya.json')
        .then((res) => (res.ok ? res.json() : []))
        .then((data: Fountain[]) => {
            cache = data;
            return data;
        })
        .catch((err) => {
            console.warn('Failed to load bundled Catalunya fountains dataset', err);
            cache = [];
            return [];
        });

    return loadPromise;
}
