import { Fountain } from '../types';
import { getDistanceFromLatLonInKm } from '../utils/distance';
import { Navigation, Droplets, MapPin, Footprints } from 'lucide-react';
import { formatDistance, UnitSystem } from '../translations';
import { PotabilityBadge } from './PotabilityBadge';

interface Props {
  fountains: Fountain[];
  targetLocation: { lat: number; lng: number } | null;
  isCustomLocation: boolean;
  t: any; // Translation object
  unitSystem: UnitSystem;
  radiusKm: number;
}

function getDistanceStyle(distanceKm: number) {
  if (distanceKm <= 0.5) {
    return "bg-indigo-100 text-indigo-800 border-indigo-200"; // Close
  } else if (distanceKm <= 1.5) {
    return "bg-indigo-50 text-indigo-600 border-indigo-100"; // Medium
  } else {
    return "bg-slate-100 text-slate-600 border-slate-200"; // Far
  }
}

/**
 * ListView Component
 * 
 * Renders a scrollable list of nearby water fountains, sorted by distance
 * from the target location (either the user's current location or a custom selected point).
 */
export function ListView({ fountains, targetLocation, isCustomLocation, t, unitSystem, radiusKm }: Props) {
  // Show a loading/locating state if we don't have a target location yet
  if (!targetLocation) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 p-8">
        <p className="text-gray-500 font-medium text-lg">{t.locating}</p>
      </div>
    );
  }

  // Calculate distance for each fountain and sort them from closest to furthest
  const sortedFountains = [...fountains].map(f => ({
    ...f,
    distance: getDistanceFromLatLonInKm(targetLocation.lat, targetLocation.lng, f.lat, f.lng)
  })).sort((a, b) => a.distance - b.distance);

  // Determine the context string for the UI (e.g., "near you" vs "near selected point")
  const context = isCustomLocation ? t.listContextPoint : t.listContextYou;

  // Empty state when no fountains are found within the selected radius
  if (sortedFountains.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50 p-8 text-center">
        <Droplets className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-700 mb-2">{t.noFountainsListTitle}</h2>
        <p className="text-gray-500">
          {t.noFountainsListDesc.replace('{radius}', formatDistance(radiusKm, unitSystem, t)).replace('{context}', context)}
        </p>
      </div>
    );
  }

  return (
    // Main container with padding to account for fixed header and bottom navigation
    <div className="h-full overflow-y-auto bg-gray-50 pt-[calc(7rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))] px-4">
      <div className="max-w-md mx-auto space-y-4">
        
        {/* List Header */}
        <div className="flex items-center gap-2 mb-6 px-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-800">
            {t.listTitle.replace('{context}', context)}
          </h2>
        </div>

        {/* Fountain List Items */}
        {sortedFountains.map(f => (
          <div key={f.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              {/* Icon indicating fountain type (natural vs urban) */}
              <div className={`p-3 rounded-full mt-1 ${f.type === 'natural' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                <Droplets className="w-6 h-6" />
              </div>
              
              {/* Fountain Details */}
              <div className="flex flex-col gap-1.5 items-start">
                <h3 className="font-bold text-gray-900 text-lg leading-tight">
                  {f.type === 'natural' ? t.naturalSpring : t.fountain}
                </h3>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getDistanceStyle(f.distance)}`}>
                  <Footprints className="w-3.5 h-3.5" />
                  {formatDistance(f.distance, unitSystem, t)}
                </div>
                <div className="mt-1">
                  <PotabilityBadge fountain={f} t={t} />
                </div>
              </div>
            </div>
            
            {/* Navigation Button - Opens Google Maps directions */}
            <button
              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`, '_blank')}
              className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 active:scale-95 transition-all self-center ml-2 shrink-0"
              aria-label={t.navigate}
            >
              <Navigation className="w-6 h-6" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
