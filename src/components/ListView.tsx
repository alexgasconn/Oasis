import { Fountain } from '../types';
import { getDistanceFromLatLonInKm } from '../utils/distance';
import { Navigation, Droplets, MapPin, Clock } from 'lucide-react';
import { formatDistance, UnitSystem } from '../translations';
import { PotabilityBadge } from './PotabilityBadge';

interface Props {
  fountains: Fountain[];
  targetLocation: { lat: number; lng: number } | null;
  isCustomLocation: boolean;
  t: any;
  unitSystem: UnitSystem;
  radiusKm: number;
}

const WALKING_KMH = 4;

function walkingTime(distKm: number): string {
  const min = Math.round((distKm / WALKING_KMH) * 60);
  if (min < 2) return '< 2 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function DistanceBadge({ distKm, unitSystem, t }: { distKm: number; unitSystem: UnitSystem; t: any }) {
  let bg = 'bg-slate-100 text-slate-600';
  if (distKm <= 0.15) bg = 'bg-blue-100 text-blue-700';
  else if (distKm <= 0.5) bg = 'bg-emerald-100 text-emerald-700';
  else if (distKm <= 1.5) bg = 'bg-amber-50 text-amber-700';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${bg}`}>
      {formatDistance(distKm, unitSystem, t)}
    </span>
  );
}

/**
 * ListView Component
 *
 * Scrollable list of nearby fountains sorted by distance.
 * Uses momentum scrolling (-webkit-overflow-scrolling) and hides the scrollbar
 * for a native Android app feel.
 */
export function ListView({ fountains, targetLocation, isCustomLocation, t, unitSystem, radiusKm }: Props) {
  if (!targetLocation) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 p-8">
        <p className="text-gray-500 font-medium text-lg">{t.locating}</p>
      </div>
    );
  }

  const sortedFountains = [...fountains]
    .map(f => ({ ...f, distance: getDistanceFromLatLonInKm(targetLocation.lat, targetLocation.lng, f.lat, f.lng) }))
    .sort((a, b) => a.distance - b.distance);

  const context = isCustomLocation ? t.listContextPoint : t.listContextYou;

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

  const openNav = (lat: number, lng: number) => {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const url = isAndroid
      ? `geo:${lat},${lng}?q=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  return (
    <div
      className="h-full overflow-y-scroll bg-gray-50 no-scrollbar"
      style={{
        paddingTop: 'calc(6rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))',
        WebkitOverflowScrolling: 'touch',
      } as React.CSSProperties}
    >
      <div className="max-w-lg mx-auto px-4 space-y-3">

        {/* List header */}
        <div className="flex items-center gap-2 mb-4 px-1">
          <MapPin className="w-5 h-5 text-blue-600 shrink-0" />
          <h2 className="text-base font-bold text-gray-700">
            {t.listTitle.replace('{context}', context)}
          </h2>
        </div>

        {sortedFountains.map((f) => (
          <div
            key={f.id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform"
          >
            <div className="p-4 flex items-center gap-4">
              {/* Type icon */}
              <div className={`p-3 rounded-xl shrink-0 ${f.type === 'natural' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                <Droplets className="w-6 h-6" />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-base truncate">
                  {f.type === 'natural' ? t.naturalSpring : t.fountain}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <DistanceBadge distKm={f.distance} unitSystem={unitSystem} t={t} />
                  <span className="text-gray-400 flex items-center gap-1 text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    {walkingTime(f.distance)}
                  </span>
                </div>
                <div className="mt-2">
                  <PotabilityBadge fountain={f} t={t} />
                </div>
              </div>

              {/* Navigate button â€“ large touch target */}
              <button
                onClick={() => { navigator.vibrate?.(10); openNav(f.lat, f.lng); }}
                className="p-3.5 bg-blue-600 text-white rounded-xl active:scale-90 transition-all shadow-md shadow-blue-600/20 shrink-0"
                aria-label={t.navigate}
              >
                <Navigation className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
