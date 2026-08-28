import { useState, useEffect, useMemo, useRef } from 'react';
import { Fountain } from '../types';
import { fetchFountainsAround } from '../services/overpass';
import { getDistanceFromLatLonInKm } from '../utils/distance';

const FETCH_RADIUS_KM = 10; // Large initial fetch radius (10km)
const FETCH_RADIUS_METERS = FETCH_RADIUS_KM * 1000;

export function useFountains(targetLocation: { lat: number; lng: number } | null, radiusKm: number) {
  const [allFountains, setAllFountains] = useState<Fountain[]>(() => {
    const saved = localStorage.getItem('cached_fountains');
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedLocation, setLastFetchedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

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
          setAllFountains(data);
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
