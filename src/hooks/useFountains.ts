import { useState, useEffect, useMemo, useRef } from 'react';
import { Fountain } from '../types';
import { fetchFountainsAround } from '../services/overpass';
import { loadLocalCatalunyaFountains } from '../services/localFountains';
import { getDistanceFromLatLonInKm } from '../utils/distance';

const FETCH_RADIUS_KM = 20; // Covers every selectable search radius (up to 20km)
const FETCH_RADIUS_METERS = FETCH_RADIUS_KM * 1000;

export function useFountains(targetLocation: { lat: number; lng: number } | null, radiusKm: number) {
  const [remoteFountains, setRemoteFountains] = useState<Fountain[]>(() => {
    const saved = localStorage.getItem('cached_fountains');
    return saved ? JSON.parse(saved) : [];
  });
  const [localFountains, setLocalFountains] = useState<Fountain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedLocation, setLastFetchedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // Bundled offline dataset for Catalunya, used as a baseline so fountains still
  // show up even if the live Overpass API is unreachable or rate-limited.
  useEffect(() => {
    loadLocalCatalunyaFountains().then(setLocalFountains);
  }, []);

  useEffect(() => {
    if (!targetLocation) return;

    const distFromLastFetch = lastFetchedLocation
      ? getDistanceFromLatLonInKm(targetLocation.lat, targetLocation.lng, lastFetchedLocation.lat, lastFetchedLocation.lng)
      : Infinity;

    // Only re-fetch if we've moved significantly (e.g., half the fetch radius)
    if (distFromLastFetch > (FETCH_RADIUS_KM / 2) && !isLoading) {
      const fetchData = async (opts?: { force?: boolean }) => {
        setIsLoading(true);
        setError(null);
        // Abort previous pending request
        if (controllerRef.current) controllerRef.current.abort();
        controllerRef.current = new AbortController();
        try {
          const data = await fetchFountainsAround(targetLocation.lat, targetLocation.lng, FETCH_RADIUS_METERS, { signal: controllerRef.current.signal, timeoutMs: 10000 });
          setRemoteFountains(data);
          setLastFetchedLocation(targetLocation);
          localStorage.setItem('cached_fountains', JSON.stringify(data));
        } catch (err) {
          if ((err as any)?.name === 'AbortError') {
            console.info('Fountains fetch aborted');
          } else {
            console.error('Failed to fetch fountains', err);
            setError((err as any)?.message || 'Failed to fetch fountains');
          }
        } finally {
          setIsLoading(false);
        }
      };

      const timeoutId = setTimeout(() => fetchData(), 500);
      return () => {
        clearTimeout(timeoutId);
        if (controllerRef.current) {
          controllerRef.current.abort();
          controllerRef.current = null;
        }
      };
    }
  }, [targetLocation, lastFetchedLocation, isLoading]);

  // Merge the live Overpass results with the bundled Catalunya baseline
  // (remote entries win on id collisions since they reflect the latest data).
  const allFountains = useMemo(() => {
    if (localFountains.length === 0) return remoteFountains;
    const byId = new Map<string, Fountain>();
    for (const f of localFountains) byId.set(f.id, f);
    for (const f of remoteFountains) byId.set(f.id, f);
    return Array.from(byId.values());
  }, [localFountains, remoteFountains]);

  // Filter fountains to only show those within the user's selected radius
  const fountains = useMemo(() => {
    if (!targetLocation) return [];
    return allFountains.filter(f => {
      const dist = getDistanceFromLatLonInKm(targetLocation.lat, targetLocation.lng, f.lat, f.lng);
      return dist <= radiusKm;
    });
  }, [allFountains, targetLocation, radiusKm]);

  const retry = () => {
    setError(null);
    // Reset lastFetchedLocation so the effect will fetch again immediately
    setLastFetchedLocation(null);
  };

  return { fountains, isLoading, error, retry };
}
