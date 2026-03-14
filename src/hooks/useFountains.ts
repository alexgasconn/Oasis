import { useState, useEffect } from 'react';
import { Fountain } from '../types';
import { fetchFountainsAround } from '../services/overpass';
import { getDistanceFromLatLonInKm } from '../utils/distance';

export function useFountains(targetLocation: { lat: number; lng: number } | null, radiusKm: number) {
  const [fountains, setFountains] = useState<Fountain[]>(() => {
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

    if (distFromLastFetch > (radiusKm / 2) && !isLoading) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const data = await fetchFountainsAround(targetLocation.lat, targetLocation.lng, radiusKm * 1000);
          setFountains(data);
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
  }, [targetLocation, radiusKm, lastFetchedLocation, isLoading]);

  // Reset last fetch when radius changes to force refresh
  useEffect(() => {
    setLastFetchedLocation(null);
  }, [radiusKm]);

  return { fountains, isLoading };
}
