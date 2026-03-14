import { useState, useEffect } from 'react';

export function useDeviceOrientation(isActive: boolean) {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (!isActive) return;

    const handleOrientation = (e: any) => {
      let h = null;
      if (e.webkitCompassHeading !== undefined) {
        h = e.webkitCompassHeading;
      } else if (e.absolute && e.alpha !== null) {
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

  return heading;
}
