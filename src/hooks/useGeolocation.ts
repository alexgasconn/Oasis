import { useState, useEffect } from 'react';

export interface Location {
  lat: number;
  lng: number;
}

export function useGeolocation(isFollowModeActive: boolean) {
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [hasInitialLocation, setHasInitialLocation] = useState(false);
  const [mapCenterCommand, setMapCenterCommand] = useState<(Location & { ts: number }) | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.error("Geolocation is not supported by this browser.");
      const fallback = { lat: 40.4168, lng: -3.7038 }; // Madrid
      setUserLocation(fallback);
      setMapCenterCommand({ ...fallback, ts: Date.now() });
      setHasInitialLocation(true);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLoc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(newLoc);
        
        setHasInitialLocation(prev => {
          if (!prev || isFollowModeActive) {
            setMapCenterCommand({ ...newLoc, ts: Date.now() });
            return true;
          }
          return prev;
        });
      },
      (error) => {
        console.error("Error getting location:", error);
        setUserLocation(prev => {
          if (!prev) {
            const fallback = { lat: 40.4168, lng: -3.7038 };
            setMapCenterCommand({ ...fallback, ts: Date.now() });
            return fallback;
          }
          return prev;
        });
        setHasInitialLocation(true);
      },
      { 
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isFollowModeActive]);

  return { userLocation, hasInitialLocation, mapCenterCommand, setMapCenterCommand };
}
