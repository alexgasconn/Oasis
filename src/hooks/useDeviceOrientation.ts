import { useState, useEffect, useRef } from 'react';

export function useDeviceOrientation(isActive: boolean) {
  const [heading, setHeading] = useState<number | null>(null);
  // Track whether we are receiving absolute orientation events so the
  // generic (relative) deviceorientation handler can defer to it.
  const hasAbsoluteRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      setHeading(null);
      return;
    }

    const extractHeading = (e: DeviceOrientationEvent): number | null => {
      // iOS / Safari: webkitCompassHeading is clockwise from magnetic north
      if ((e as any).webkitCompassHeading !== undefined) {
        return (e as any).webkitCompassHeading as number;
      }
      // Android absolute: alpha is CCW from north, convert to CW
      if (e.alpha !== null) {
        return (360 - e.alpha + 360) % 360;
      }
      return null;
    };

    const handleAbsolute = (e: DeviceOrientationEvent) => {
      hasAbsoluteRef.current = true;
      const h = extractHeading(e);
      if (h !== null) setHeading(h);
    };

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // If the device fires deviceorientationabsolute, skip the generic event
      // to avoid overwriting accurate heading with relative/arbitrary alpha.
      if (hasAbsoluteRef.current) return;
      const h = extractHeading(e);
      if (h !== null) setHeading(h);
    };

    window.addEventListener('deviceorientationabsolute', handleAbsolute as EventListener);
    window.addEventListener('deviceorientation', handleOrientation as EventListener);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleAbsolute as EventListener);
      window.removeEventListener('deviceorientation', handleOrientation as EventListener);
      hasAbsoluteRef.current = false;
    };
  }, [isActive]);

  return heading;
}
