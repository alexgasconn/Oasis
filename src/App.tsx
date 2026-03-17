import { useState, useEffect, useCallback, useMemo } from 'react';
import { MapView } from './components/Map';
import { FountainDetails } from './components/FountainDetails';
import { ListView } from './components/ListView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CompassWidget } from './components/CompassWidget';
import { Droplets, AlertTriangle, CheckCircle, Loader2, LocateFixed, Settings, X, Sun, Moon } from 'lucide-react';
import { Fountain } from './types';
import { getDistanceFromLatLonInKm } from './utils/distance';
import { translations, Language, UnitSystem, formatDistance } from './translations';

// Custom Hooks
import { useGeolocation } from './hooks/useGeolocation';
import { useFountains } from './hooks/useFountains';
import { useDeviceOrientation } from './hooks/useDeviceOrientation';
import { useWakeLock } from './hooks/useWakeLock';

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
  radiusKm,
  isDismissed,
  onDismiss
}: { 
  targetLocation: { lat: number; lng: number } | null, 
  isCustom: boolean, 
  nearestFountain: Fountain | null,
  minDistance: number | null,
  isLoading: boolean, 
  t: any, 
  unitSystem: UnitSystem, 
  radiusKm: number,
  isDismissed: boolean,
  onDismiss: () => void
}) {
  if (isDismissed) return null;

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
      <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 z-[1000] bg-red-500 text-white p-4 rounded-2xl shadow-lg text-center font-medium flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 justify-center">
          <AlertTriangle className="w-5 h-5" />
          {t.noFountains.replace('{radius}', formatDistance(radiusKm, unitSystem, t))}
        </div>
        <button onClick={onDismiss} className="p-1 hover:bg-white/20 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
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
    <div className={`absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 z-[1000] ${statusConfig.color} text-white p-4 rounded-2xl shadow-lg flex items-center justify-between gap-3 transition-colors`}>
      <div className="flex items-center gap-3">
        {statusConfig.icon}
        <span className="font-semibold text-lg">{statusConfig.text}</span>
      </div>
      <button onClick={onDismiss} className="p-1 hover:bg-white/20 rounded-full transition-colors">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

/**
 * Main Application Content
 * Manages state for location, fountains, settings, and view modes.
 */
function AppContent() {
  // Settings State (Persisted)
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'en');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => (localStorage.getItem('unitSystem') as UnitSystem) || 'metric');
  const [radiusKm, setRadiusKm] = useState<number>(() => Number(localStorage.getItem('radiusKm')) || 2);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'terrain' | 'light' | 'dark'>(() => (localStorage.getItem('mapType') as any) || 'standard');
  const [isWakeLockActive, setIsWakeLockActive] = useState(true);

  // UI State
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedFountain, setSelectedFountain] = useState<Fountain | null>(null);
  const [isCompassActive, setIsCompassActive] = useState(false);
  const [isIndicatorDismissed, setIsIndicatorDismissed] = useState(false);
  const [customLocation, setCustomLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Custom Hooks for Logic
  const [isFollowModeActive, setIsFollowModeActive] = useState(true);
  const { userLocation, hasInitialLocation, mapCenterCommand, setMapCenterCommand } = useGeolocation(isFollowModeActive);
  
  const targetLocation = customLocation || userLocation;
  const { fountains, isLoading } = useFountains(targetLocation, radiusKm);
  
  const deviceHeading = useDeviceOrientation(isCompassActive);
  useWakeLock(isWakeLockActive);

  const t = translations[language];

  const handleFountainSelect = useCallback((fountain: Fountain) => {
    setSelectedFountain(fountain);
  }, []);

  const handleViewModeChange = (mode: 'map' | 'list') => {
    setViewMode(mode);
  };

  // Calculate nearest fountain for the indicator and compass
  const { minDistance, nearestFountain } = useMemo(() => {
    if (!targetLocation || fountains.length === 0) return { minDistance: null, nearestFountain: null };
    
    let min = Infinity;
    let nearest = null;
    
    for (const f of fountains) {
      const d = getDistanceFromLatLonInKm(targetLocation.lat, targetLocation.lng, f.lat, f.lng);
      if (d < min) {
        min = d;
        nearest = f;
      }
    }
    
    return { minDistance: min, nearestFountain: nearest };
  }, [targetLocation, fountains]);

  // Auto-reset the indicator every 5 minutes if it was dismissed,
  // or immediately if the user selects a new custom location.
  useEffect(() => {
    setIsIndicatorDismissed(false);
  }, [customLocation]);

  useEffect(() => {
    if (isIndicatorDismissed) {
      const timer = setTimeout(() => {
        setIsIndicatorDismissed(false);
      }, 5 * 60 * 1000); // 5 minutes
      return () => clearTimeout(timer);
    }
  }, [isIndicatorDismissed]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('language', language);
    localStorage.setItem('unitSystem', unitSystem);
    localStorage.setItem('radiusKm', radiusKm.toString());
    localStorage.setItem('mapType', mapType);
  }, [language, unitSystem, radiusKm, mapType]);

  const handleMapClick = useCallback((latlng: { lat: number; lng: number }) => {
    setCustomLocation(latlng);
    setIsFollowModeActive(false);
    setMapCenterCommand({ ...latlng, ts: Date.now() });
  }, [setMapCenterCommand]);

  const handleLocateMe = useCallback(() => {
    setCustomLocation(null);
    setIsFollowModeActive(true);
    if (userLocation) {
      setMapCenterCommand({ ...userLocation, ts: Date.now() });
    }
  }, [userLocation, setMapCenterCommand]);

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
        isDismissed={isIndicatorDismissed}
        onDismiss={() => setIsIndicatorDismissed(true)}
      />

      {/* Main Content Area: Map or List View */}
      <div className="h-full w-full">
        {viewMode === 'map' ? (
          <MapView 
            userLocation={userLocation} 
            customLocation={customLocation}
            fountains={fountains} 
            onFountainSelect={handleFountainSelect} 
            onMapClick={handleMapClick}
            mapType={mapType}
            mapCenterCommand={mapCenterCommand}
            nearestFountain={isCompassActive ? nearestFountain : null}
            isFollowMode={isFollowModeActive}
            heading={deviceHeading}
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
          <>
            <button 
              onClick={handleLocateMe} 
              className={`p-3 rounded-full shadow-lg transition-colors border border-gray-100 ${isFollowModeActive ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-blue-600 hover:bg-blue-50'}`}
              aria-label={t.backToLocation}
            >
              <LocateFixed className="w-6 h-6" />
            </button>
          </>
        )}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="bg-white/80 backdrop-blur-sm p-3 rounded-full shadow-sm text-gray-400 hover:text-gray-600 transition-colors border border-gray-100"
          aria-label={t.settings}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Compass Widget (Bottom Left) */}
      {viewMode === 'map' && (
        <div className="absolute bottom-[calc(6rem+env(safe-area-inset-bottom))] left-4 z-[1000]">
          <CompassWidget 
            userLocation={userLocation} 
            nearestFountain={nearestFountain} 
            isActive={isCompassActive}
            onActivate={() => setIsCompassActive(prev => !prev)}
            heading={deviceHeading}
          />
        </div>
      )}

      {/* View Toggle (Map / List) */}
      <div className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[1000] bg-white p-1.5 rounded-full shadow-lg flex items-center border border-gray-100">
        <button
          onClick={() => handleViewModeChange('map')}
          className={`px-6 py-2.5 rounded-full font-semibold transition-colors ${viewMode === 'map' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-gray-500 hover:text-gray-900'}`}
        >
          {t.map}
        </button>
        <button
          onClick={() => handleViewModeChange('list')}
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
                  <select value={mapType} onChange={e => setMapType(e.target.value as any)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700">
                    <option value="standard">{t.mapStandard}</option>
                    <option value="satellite">{t.mapSatellite}</option>
                    <option value="terrain">{t.mapTerrain}</option>
                    <option value="light">{t.mapLight}</option>
                    <option value="dark">{t.mapDark}</option>
                  </select>
                </div>

                {/* Wake Lock Toggle */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium text-gray-700">{t.keepScreenOn}</span>
                  <button 
                    onClick={() => setIsWakeLockActive(!isWakeLockActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isWakeLockActive ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isWakeLockActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
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
