import { useState, useEffect, useMemo } from 'react';
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
  const [lastFetchedLocation, setLastFetchedLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!targetLocation) return;

    const distFromLastFetch = lastFetchedLocation
      ? getDistanceFromLatLonInKm(targetLocation.lat, targetLocation.lng, lastFetchedLocation.lat, lastFetchedLocation.lng)
      : Infinity;

    // Only re-fetch if we've moved significantly (e.g., half the fetch radius)
    if (distFromLastFetch > (FETCH_RADIUS_KM / 2) && !isLoading) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const data = await fetchFountainsAround(targetLocation.lat, targetLocation.lng, FETCH_RADIUS_METERS);
          setAllFountains(data);
          setLastFetchedLocation(targetLocation);
          localStorage.setItem('cached_fountains', JSON.stringify(data));
        } catch (error) {
          console.error("Failed to fetch fountains", error);
        } finally {
          setIsLoading(false);
        }
      };

      const timeoutId = setTimeout(fetchData, 500);
      return () => clearTimeout(timeoutId);
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

  return { fountains, isLoading };
}
