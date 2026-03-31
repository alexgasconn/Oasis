import { useState, useEffect, useRef } from 'react';
import { Navigation, Compass } from 'lucide-react';
import { motion, useSpring } from 'motion/react';
import clsx from 'clsx';
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

/** Converts a bearing in degrees to a compass direction label. */
function bearingToCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export function CompassWidget({
  userLocation,
  nearestFountain,
  isActive,
  onActivate,
  heading
}: {
  userLocation: { lat: number; lng: number } | null;
  nearestFountain: Fountain | null;
  isActive: boolean;
  onActivate: () => void;
  heading: number | null;
}) {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const prevRotationRef = useRef<number>(0);
  const absoluteRotationRef = useRef<number>(0);
  const [bearingDeg, setBearingDeg] = useState<number | null>(null);

  const springRotation = useSpring(0, { stiffness: 80, damping: 18, mass: 1 });

  const requestPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const state = await (DeviceOrientationEvent as any).requestPermission();
        if (state === 'granted') onActivate();
        else setIsSupported(false);
      } catch {
        setIsSupported(false);
      }
    } else {
      onActivate();
    }
  };

  useEffect(() => {
    if (heading !== null && userLocation && nearestFountain) {
      const bearing = getBearing(userLocation.lat, userLocation.lng, nearestFountain.lat, nearestFountain.lng);
      setBearingDeg(bearing);
      const targetRotation = (bearing - heading + 360) % 360;

      let diff = targetRotation - prevRotationRef.current;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      absoluteRotationRef.current += diff;
      prevRotationRef.current = targetRotation;
      springRotation.set(absoluteRotationRef.current);
    }
  }, [heading, userLocation, nearestFountain, springRotation]);

  if (!isSupported || !userLocation || !nearestFountain) return null;

  // Inactive – small tap-to-activate button
  if (!isActive) {
    return (
      <button
        onClick={requestPermission}
        style={{ width: 52, height: 52 }}
        className="bg-white rounded-full shadow-lg text-blue-600 border border-gray-100 flex items-center justify-center active:scale-90 transition-all"
        aria-label="Activar brújula"
      >
        <Compass className="w-6 h-6" />
      </button>
    );
  }

  // Waiting for sensor data
  if (heading === null) {
    return (
      <button
        onClick={onActivate}
        style={{ width: 52, height: 52 }}
        className="bg-white rounded-full shadow-lg border border-gray-100 flex items-center justify-center opacity-60 active:scale-90 transition-all"
      >
        <Compass className="w-6 h-6 text-gray-400 animate-pulse" />
      </button>
    );
  }

  const cardinal = bearingDeg !== null ? bearingToCardinal(bearingDeg) : '';

  return (
    <button
      onClick={onActivate}
      className={clsx(
        'relative rounded-full shadow-2xl border-2 bg-white flex flex-col items-center justify-center transition-all duration-300 active:scale-90',
        'border-blue-500'
      )}
      style={{ width: 72, height: 72 }}
      aria-label="Brújula activa – toca para desactivar"
    >
      {/* Subtle pulsing ring */}
      <div className="absolute inset-0 rounded-full border border-blue-300 animate-ping opacity-20 pointer-events-none" />
      {/* Dashed orbit */}
      <div className="absolute inset-1.5 rounded-full border border-dashed border-blue-200 opacity-50 pointer-events-none" />

      {/* Animated needle */}
      <motion.div
        style={{ rotate: springRotation }}
        className="flex items-center justify-center"
      >
        <Navigation className="w-9 h-9 text-blue-600 drop-shadow-md" fill="currentColor" />
      </motion.div>

      {/* Cardinal direction label */}
      {cardinal && (
        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-extrabold text-blue-600 leading-none">
          {cardinal}
        </span>
      )}
    </button>
  );
}
