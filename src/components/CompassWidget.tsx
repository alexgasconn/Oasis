import { useState, useEffect } from 'react';
import { Navigation, Compass } from 'lucide-react';
import { Fountain } from '../types';

// Helper to calculate bearing between two coordinates
function getBearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function CompassWidget({
  userLocation,
  nearestFountain,
  isActive,
  onActivate
}: {
  userLocation: { lat: number; lng: number } | null;
  nearestFountain: Fountain | null;
  isActive: boolean;
  onActivate: () => void;
}) {
  const [heading, setHeading] = useState<number | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const requestPermission = async () => {
    // iOS 13+ requires permission for DeviceOrientation
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === 'granted') {
          onActivate();
        } else {
          setIsSupported(false);
        }
      } catch (error) {
        console.error('Error requesting orientation permission:', error);
        setIsSupported(false);
      }
    } else {
      // Non-iOS 13+ devices
      onActivate();
    }
  };

  useEffect(() => {
    if (!isActive) return;

    const handleOrientation = (e: any) => {
      let h = null;
      if (e.webkitCompassHeading !== undefined) {
        // iOS
        h = e.webkitCompassHeading;
      } else if (e.absolute && e.alpha !== null) {
        // Android (absolute orientation)
        h = 360 - e.alpha;
      }
      
      if (h !== null) {
        setHeading(h);
      }
    };

    window.addEventListener('deviceorientationabsolute', handleOrientation);
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [isActive]);

  // Don't render if not supported or missing data
  if (!isSupported || !userLocation || !nearestFountain) return null;

  const bearing = getBearing(
    userLocation.lat,
    userLocation.lng,
    nearestFountain.lat,
    nearestFountain.lng
  );

  // State 1: Needs permission
  if (!isActive) {
    return (
      <button
        onClick={requestPermission}
        className="bg-white p-3 rounded-full shadow-lg text-blue-600 hover:bg-blue-50 transition-colors border border-gray-100 flex items-center justify-center"
        aria-label="Activar brújula"
        title="Activar brújula hacia la fuente más cercana"
      >
        <Compass className="w-6 h-6" />
      </button>
    );
  }

  // State 2: Waiting for sensor data
  if (heading === null) {
    return (
      <div className="bg-white p-3 rounded-full shadow-lg border border-gray-100 flex items-center justify-center opacity-50" title="Calibrando brújula...">
        <Compass className="w-6 h-6 text-gray-400 animate-pulse" />
      </div>
    );
  }

  // State 3: Active compass
  const rotation = bearing - heading;

  return (
    <div 
      className="bg-white p-3 rounded-full shadow-lg border border-gray-100 flex items-center justify-center relative overflow-hidden"
      title="Dirección a la fuente más cercana"
    >
      <div className="absolute inset-0 border-2 border-blue-500 rounded-full opacity-20"></div>
      <Navigation
        className="w-6 h-6 text-blue-600 transition-transform duration-100 ease-linear"
        style={{ transform: `rotate(${rotation}deg)` }}
      />
    </div>
  );
}
