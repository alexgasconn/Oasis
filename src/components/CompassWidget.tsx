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

  // Spring for smooth movement
  const springRotation = useSpring(0, {
    stiffness: 100,
    damping: 20,
    mass: 1
  });

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

  // Update spring when rotation changes, handling shortest path
  useEffect(() => {
    if (heading !== null && userLocation && nearestFountain) {
      const bearing = getBearing(
        userLocation.lat,
        userLocation.lng,
        nearestFountain.lat,
        nearestFountain.lng
      );
      
      const targetRotation = (bearing - heading + 360) % 360;
      
      // Shortest path logic
      let diff = targetRotation - prevRotationRef.current;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      
      absoluteRotationRef.current += diff;
      prevRotationRef.current = targetRotation;
      
      springRotation.set(absoluteRotationRef.current);
    }
  }, [heading, userLocation, nearestFountain, springRotation]);

  // Don't render if not supported or missing data
  if (!isSupported || !userLocation || !nearestFountain) return null;

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

  return (
    <div 
      className={clsx(
        "bg-white rounded-full shadow-2xl border-2 transition-all duration-500 flex items-center justify-center relative overflow-hidden",
        isActive ? "p-5 border-blue-500 scale-125" : "p-3 border-gray-100"
      )}
      title="Dirección a la fuente más cercana"
    >
      {isActive && (
        <>
          <div className="absolute inset-0 bg-blue-500/5 animate-pulse"></div>
          {/* Compass ticks */}
          <div className="absolute inset-1 border border-dashed border-blue-200 rounded-full opacity-50"></div>
        </>
      )}
      <motion.div
        style={{ rotate: springRotation }}
        className="flex items-center justify-center z-10"
      >
        <Navigation 
          className={clsx(
            "transition-colors duration-300",
            isActive ? "w-10 h-10 text-blue-600 drop-shadow-md" : "w-6 h-6 text-gray-400"
          )} 
          fill={isActive ? "currentColor" : "none"}
        />
      </motion.div>
      
      {/* North indicator when active */}
      {isActive && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full shadow-sm"></div>
          <span className="text-[8px] font-bold text-blue-600 mt-0.5">OBJ</span>
        </div>
      )}
    </div>
  );
}
