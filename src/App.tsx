import { useState, useEffect, useCallback } from 'react';
import { MapView } from './components/Map';
import { FountainDetails } from './components/FountainDetails';
import { ListView } from './components/ListView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CompassWidget } from './components/CompassWidget';
import { Droplets, AlertTriangle, CheckCircle, Loader2, LocateFixed, Settings, X } from 'lucide-react';
import { Fountain } from './types';
import { getDistanceFromLatLonInKm } from './utils/distance';
import { fetchFountainsAround } from './services/overpass';
import { translations, Language, UnitSystem, formatDistance } from './translations';

/**
 * HydrationIndicator Component
 * Displays a dynamic status bar at the top of the screen indicating the proximity
 * and availability of water fountains based on the user's or selected location.
 */
function HydrationIndicator({ 
  targetLocation, 
  isCustom, 
  nearestFountain,
  minDistance,
  isLoading, 
  t, 
  unitSystem, 
  radiusKm 
}: { 
  targetLocation: { lat: number; lng: number } | null, 
  isCustom: boolean, 
  nearestFountain: Fountain | null,
  minDistance: number | null,
  isLoading: boolean, 
  t: any, 
  unitSystem: UnitSystem, 
  radiusKm: number 
}) {
  // State 1: Waiting for initial location
  if (!targetLocation) {
    return (
      <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg text-center font-medium text-gray-600 border border-white/20 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        {t.locating}
      </div>
    );
  }

  // State 2: Location found, fetching fountains data
  if (isLoading && !nearestFountain) {
    return (
      <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg text-center font-medium text-gray-600 border border-white/20 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        {t.searching}
      </div>
    );
  }

  // State 3: No fountains found within the selected radius
  if (!nearestFountain || minDistance === null) {
    return (
      <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 z-[1000] bg-red-500 text-white p-4 rounded-2xl shadow-lg text-center font-medium flex items-center justify-center gap-2">
        <AlertTriangle className="w-5 h-5" />
        {t.noFountains.replace('{radius}', formatDistance(radiusKm, unitSystem, t))}
      </div>
    );
  }

  let statusConfig = { color: 'bg-blue-500', text: '', icon: <Droplets className="w-6 h-6" /> };
  const formattedDist = formatDistance(minDistance, unitSystem, t);

  // Determine the status level based on proximity (absolute distances for walking)
  if (minDistance <= 0.15) { // Within 150m is an Oasis
    statusConfig = { color: 'bg-blue-500', text: isCustom ? t.oasisPoint : t.oasisYou, icon: <Droplets className="w-6 h-6" /> };
  } else if (minDistance <= 0.5) { // Within 500m is Safe
    statusConfig = { color: 'bg-emerald-500', text: (isCustom ? t.safePoint : t.safeYou).replace('{dist}', formattedDist), icon: <CheckCircle className="w-6 h-6" /> };
  } else { // Further than 500m is Caution
    statusConfig = { color: 'bg-amber-500', text: (isCustom ? t.cautionPoint : t.cautionYou).replace('{dist}', formattedDist), icon: <AlertTriangle className="w-6 h-6" /> };
  }

  return (
    <div className={`absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 z-[1000] ${statusConfig.color} text-white p-4 rounded-2xl shadow-lg flex items-center gap-3 transition-colors`}>
      {statusConfig.icon}
      <span className="font-semibold text-lg">{statusConfig.text}</span>
    </div>
  );
}

/**
 * Main Application Content
 * Manages state for location, fountains, settings, and view modes.
 */
function AppContent() {
  // Location and Data State
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [customLocation, setCustomLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [fountains, setFountains] = useState<Fountain[]>([]);
  const [selectedFountain, setSelectedFountain] = useState<Fountain | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [lastFetchedLocation, setLastFetchedLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  // Map Control State
  const [hasInitialLocation, setHasInitialLocation] = useState(false);
  const [mapCenterCommand, setMapCenterCommand] = useState<{lat: number, lng: number, ts: number} | null>(null);
  const [isCompassActive, setIsCompassActive] = useState(false);
  
  // User Preferences State (Persisted in localStorage)
  const [radiusKm, setRadiusKm] = useState<number>(() => {
    const saved = localStorage.getItem('radiusKm');
    return saved !== null ? Number(saved) : 1; // Default to 1km for better performance
  });
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'en'); // Default to English
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => (localStorage.getItem('unitSystem') as UnitSystem) || 'metric'); // Default to metric
  const [mapType, setMapType] = useState<string>(() => localStorage.getItem('mapType') || 'light'); // Default to light map
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const t = translations[language];
  const targetLocation = customLocation || userLocation;

  // Calculate nearest fountain for indicators and compass
  const distances = targetLocation ? fountains.map(f => getDistanceFromLatLonInKm(targetLocation.lat, targetLocation.lng, f.lat, f.lng)) : [];
  const minDistance = distances.length > 0 ? Math.min(...distances) : null;
  const nearestFountain = minDistance !== null ? fountains[distances.indexOf(minDistance)] : null;

  // Effect: Persist settings whenever they change
  useEffect(() => {
    localStorage.setItem('language', language);
    localStorage.setItem('unitSystem', unitSystem);
    localStorage.setItem('radiusKm', radiusKm.toString());
    localStorage.setItem('mapType', mapType);
  }, [language, unitSystem, radiusKm, mapType]);

  // Effect: Initialize geolocation tracking
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(newLoc);
          
          // Center map only on first location acquisition to prevent fighting user pan
          setHasInitialLocation(prev => {
            if (!prev) {
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
              // Fallback to Madrid if location access is denied or fails
              const fallback = { lat: 40.4168, lng: -3.7038 };
              setMapCenterCommand({ ...fallback, ts: Date.now() });
              return fallback;
            }
            return prev;
          });
          setHasInitialLocation(true);
        },
        { enableHighAccuracy: true }
      );
      
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Effect: Reset the last fetched location when the search radius changes
  // This forces a new API call to fetch data for the new radius
  useEffect(() => {
    setLastFetchedLocation(null);
  }, [radiusKm]);

  // Effect: Fetch fountains data when the target location changes significantly
  useEffect(() => {
    if (!targetLocation) return;

    // Calculate distance from the center of the last API fetch
    const distFromLastFetch = lastFetchedLocation
      ? getDistanceFromLatLonInKm(targetLocation.lat, targetLocation.lng, lastFetchedLocation.lat, lastFetchedLocation.lng)
      : Infinity;

    // Only fetch if we moved more than half the radius from the last fetch center
    // This prevents spamming the Overpass API on every small movement
    if (distFromLastFetch > (radiusKm / 2)) {
      const fetchFountains = async () => {
        setIsLoading(true);
        try {
          const data = await fetchFountainsAround(targetLocation.lat, targetLocation.lng, radiusKm * 1000);
          setFountains(data);
          setLastFetchedLocation(targetLocation);
        } catch (error) {
          console.error("Failed to fetch fountains", error);
        } finally {
          setIsLoading(false);
        }
      };

      // Debounce the fetch to avoid rapid consecutive calls
      const timeoutId = setTimeout(() => {
        fetchFountains();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [targetLocation, lastFetchedLocation, radiusKm]);

  // Handler: Set a custom location when the user clicks on the map
  const handleMapClick = useCallback((latlng: { lat: number; lng: number }) => {
    setCustomLocation(latlng);
    setMapCenterCommand({ ...latlng, ts: Date.now() });
  }, []);

  // Handler: Re-center map on user's actual location
  const handleLocateMe = useCallback(() => {
    setCustomLocation(null);
    if (userLocation) {
      setMapCenterCommand({ lat: userLocation.lat, lng: userLocation.lng, ts: Date.now() });
    }
  }, [userLocation]);

  return (
    <div className="h-[100dvh] w-full relative overflow-hidden bg-gray-50">
      
      {/* Hydration Safety Indicator */}
      <HydrationIndicator 
        targetLocation={targetLocation} 
        isCustom={!!customLocation} 
        nearestFountain={nearestFountain}
        minDistance={minDistance}
        isLoading={isLoading}
        t={t}
        unitSystem={unitSystem}
        radiusKm={radiusKm}
      />

      {/* Main Content Area: Map or List View */}
      <div className="h-full w-full">
        {viewMode === 'map' ? (
          <MapView 
            userLocation={userLocation} 
            customLocation={customLocation}
            fountains={fountains} 
            onFountainSelect={setSelectedFountain} 
            onMapClick={handleMapClick}
            mapType={mapType}
            mapCenterCommand={mapCenterCommand}
            nearestFountain={isCompassActive ? nearestFountain : null}
          />
        ) : (
          <ListView 
            fountains={fountains} 
            targetLocation={targetLocation} 
            isCustomLocation={!!customLocation}
            t={t}
            unitSystem={unitSystem}
            radiusKm={radiusKm}
          />
        )}
      </div>

      {/* Floating Controls (Bottom Right) */}
      <div className="absolute bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-[1000] flex flex-col gap-3">
        {viewMode === 'map' && (
          <CompassWidget 
            userLocation={userLocation} 
            nearestFountain={nearestFountain} 
            isActive={isCompassActive}
            onActivate={() => setIsCompassActive(true)}
          />
        )}
        {viewMode === 'map' && (
          <button 
            onClick={handleLocateMe} 
            className={`p-3 rounded-full shadow-lg transition-colors border border-gray-100 ${customLocation ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            aria-label={t.backToLocation}
          >
            <LocateFixed className="w-6 h-6" />
          </button>
        )}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="bg-white/80 backdrop-blur-sm p-3 rounded-full shadow-sm text-gray-400 hover:text-gray-600 transition-colors border border-gray-100"
          aria-label={t.settings}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* View Toggle (Map / List) */}
      <div className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[1000] bg-white p-1.5 rounded-full shadow-lg flex items-center border border-gray-100">
        <button
          onClick={() => setViewMode('map')}
          className={`px-6 py-2.5 rounded-full font-semibold transition-colors ${viewMode === 'map' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-gray-500 hover:text-gray-900'}`}
        >
          {t.map}
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`px-6 py-2.5 rounded-full font-semibold transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-gray-500 hover:text-gray-900'}`}
        >
          {t.list}
        </button>
      </div>

      {/* Fountain Details Overlay (Bottom Sheet) */}
      {viewMode === 'map' && (
        <FountainDetails 
          fountain={selectedFountain} 
          onClose={() => setSelectedFountain(null)} 
          userLocation={targetLocation}
          t={t}
          unitSystem={unitSystem}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">{t.settings}</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="space-y-5">
                {/* Language Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.language}</label>
                  <select value={language} onChange={e => setLanguage(e.target.value as Language)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700">
                    <option value="es">Español</option>
                    <option value="ca">Català</option>
                    <option value="en">English</option>
                  </select>
                </div>
                
                {/* Unit System Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.units}</label>
                  <select value={unitSystem} onChange={e => setUnitSystem(e.target.value as UnitSystem)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700">
                    <option value="metric">{t.metric}</option>
                    <option value="imperial">{t.imperial}</option>
                  </select>
                </div>

                {/* Search Radius Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.radius}</label>
                  <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700">
                    <option value={0.1}>100 m</option>
                    <option value={0.5}>500 m</option>
                    <option value={1}>1 km</option>
                    <option value={2}>2 km</option>
                    <option value={5}>5 km</option>
                    <option value={10}>10 km</option>
                    <option value={20}>20 km</option>
                  </select>
                </div>

                {/* Map Type Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.mapType}</label>
                  <select value={mapType} onChange={e => setMapType(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700">
                    <option value="standard">{t.mapStandard}</option>
                    <option value="satellite">{t.mapSatellite}</option>
                    <option value="terrain">{t.mapTerrain}</option>
                    <option value="light">{t.mapLight}</option>
                    <option value="dark">{t.mapDark}</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => setIsSettingsOpen(false)}
                className="w-full mt-8 bg-gray-900 text-white py-3.5 rounded-xl font-semibold hover:bg-gray-800 transition-colors"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
