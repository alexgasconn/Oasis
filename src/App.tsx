import { useState, useEffect, useCallback, useMemo } from 'react';
import { MapView } from './components/Map';
import { FountainDetails } from './components/FountainDetails';
import { ListView } from './components/ListView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CompassWidget } from './components/CompassWidget';
import { Droplets, AlertTriangle, CheckCircle, Loader2, LocateFixed, Settings, X, WifiOff } from 'lucide-react';
import { Fountain } from './types';
import { getDistanceFromLatLonInKm } from './utils/distance';
import { translations, Language, UnitSystem, formatDistance } from './translations';

// Custom Hooks
import { useGeolocation } from './hooks/useGeolocation';
import { useFountains } from './hooks/useFountains';
import { useDeviceOrientation } from './hooks/useDeviceOrientation';
import { useWakeLock } from './hooks/useWakeLock';
import { useHaptics } from './hooks/useHaptics';
import { useNetworkStatus } from './hooks/useNetworkStatus';

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
  onDismiss,
  offlinePad
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
  onDismiss: () => void,
  offlinePad?: boolean
}) {
  if (isDismissed) return null;

  // When the offline banner is shown, shift down so it doesn't overlap
  const topClass = offlinePad
    ? 'top-[calc(3rem+env(safe-area-inset-top))]'
    : 'top-[calc(1rem+env(safe-area-inset-top))]';

  // State 1: Waiting for initial location
  if (!targetLocation) {
    return (
      <div className={`absolute ${topClass} left-4 right-4 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg text-center font-medium text-gray-600 border border-white/20 flex items-center justify-center gap-2`}>
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        {t.locating}
      </div>
    );
  }

  // State 2: Location found, fetching fountains data
  if (isLoading && !nearestFountain) {
    return (
      <div className={`absolute ${topClass} left-4 right-4 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg text-center font-medium text-gray-600 border border-white/20 flex items-center justify-center gap-2`}>
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        {t.searching}
      </div>
    );
  }

  // State 3: No fountains found within the selected radius
  if (!nearestFountain || minDistance === null) {
    return (
      <div className={`absolute ${topClass} left-4 right-4 z-[1000] bg-red-500 text-white p-4 rounded-2xl shadow-lg text-center font-medium flex items-center justify-between gap-2`}>
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

  if (minDistance <= 0.15) {
    statusConfig = { color: 'bg-blue-500', text: isCustom ? t.oasisPoint : t.oasisYou, icon: <Droplets className="w-6 h-6" /> };
  } else if (minDistance <= 0.5) {
    statusConfig = { color: 'bg-emerald-500', text: (isCustom ? t.safePoint : t.safeYou).replace('{dist}', formattedDist), icon: <CheckCircle className="w-6 h-6" /> };
  } else {
    statusConfig = { color: 'bg-amber-500', text: (isCustom ? t.cautionPoint : t.cautionYou).replace('{dist}', formattedDist), icon: <AlertTriangle className="w-6 h-6" /> };
  }

  return (
    <div className={`absolute ${topClass} left-4 right-4 z-[1000] ${statusConfig.color} text-white p-4 rounded-2xl shadow-lg flex items-center justify-between gap-3 transition-colors`}>
      <div className="flex items-center gap-3">
        {statusConfig.icon}
        <span className="font-semibold text-lg">{statusConfig.text}</span>
      </div>
      <button onClick={onDismiss} className="p-1.5 hover:bg-white/20 rounded-full transition-colors active:scale-90">
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
  const { trigger: haptic } = useHaptics();
  const isOnline = useNetworkStatus();

  const t = translations[language];

  const handleFountainSelect = useCallback((fountain: Fountain) => {
    haptic('selection');
    setSelectedFountain(fountain);
  }, [haptic]);

  // Calculate nearest fountain for the indicator and compass
  const { minDistance, nearestFountain } = useMemo(() => {
    if (!targetLocation || fountains.length === 0) return { minDistance: null, nearestFountain: null };
    let min = Infinity;
    let nearest = null;
    for (const f of fountains) {
      const d = getDistanceFromLatLonInKm(targetLocation.lat, targetLocation.lng, f.lat, f.lng);
      if (d < min) { min = d; nearest = f; }
    }
    return { minDistance: min, nearestFountain: nearest };
  }, [targetLocation, fountains]);

  // Auto-reset indicator when location changes; re-show after 5 minutes if dismissed
  useEffect(() => { setIsIndicatorDismissed(false); }, [customLocation]);
  useEffect(() => {
    if (!isIndicatorDismissed) return;
    const timer = setTimeout(() => setIsIndicatorDismissed(false), 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [isIndicatorDismissed]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('language', language);
    localStorage.setItem('unitSystem', unitSystem);
    localStorage.setItem('radiusKm', radiusKm.toString());
    localStorage.setItem('mapType', mapType);
  }, [language, unitSystem, radiusKm, mapType]);

  const handleMapClick = useCallback((latlng: { lat: number; lng: number }) => {
    haptic('light');
    setCustomLocation(latlng);
    setIsFollowModeActive(false);
    setMapCenterCommand({ ...latlng, ts: Date.now() });
  }, [haptic, setMapCenterCommand]);

  const handleLocateMe = useCallback(() => {
    haptic('medium');
    setCustomLocation(null);
    setIsFollowModeActive(true);
    if (userLocation) setMapCenterCommand({ ...userLocation, ts: Date.now() });
  }, [haptic, userLocation, setMapCenterCommand]);

  // Radius options with display labels
  const radiusOptions: { value: number; label: string }[] = [
    { value: 0.1, label: '100m' }, { value: 0.5, label: '500m' },
    { value: 1, label: '1km' }, { value: 2, label: '2km' },
    { value: 5, label: '5km' }, { value: 10, label: '10km' },
    { value: 20, label: '20km' },
  ];

  const mapTypeOptions: { value: 'standard' | 'satellite' | 'terrain' | 'light' | 'dark'; label: string }[] = [
    { value: 'standard', label: t.mapStandard },
    { value: 'satellite', label: t.mapSatellite },
    { value: 'terrain', label: t.mapTerrain },
    { value: 'light', label: t.mapLight },
    { value: 'dark', label: t.mapDark },
  ];

  return (
    <div className="h-[100dvh] w-full relative overflow-hidden bg-gray-50">

      {/* ── Offline Banner ─────────────────────────────────────────────── */}
      {!isOnline && (
        <div className="absolute top-0 left-0 right-0 z-[3000] bg-gray-900/95 text-white text-sm font-medium flex items-center justify-center gap-2 py-2 px-4"
          style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}>
          <WifiOff className="w-4 h-4 shrink-0" />
          {t.offline}
        </div>
      )}

      {/* ── Hydration Safety Indicator ──────────────────────────────────── */}
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
        onDismiss={() => { haptic('light'); setIsIndicatorDismissed(true); }}
        offlinePad={!isOnline}
      />

      {/* ── Clear Custom Pin ────────────────────────────────────────────── */}
      {customLocation && (
        <div className={`absolute left-1/2 -translate-x-1/2 z-[1000] transition-all duration-300 ${isIndicatorDismissed ? 'top-[calc(1rem+env(safe-area-inset-top))]' : 'top-[calc(5.5rem+env(safe-area-inset-top))]'}`}>
          <button
            onClick={() => {
              haptic('light');
              setCustomLocation(null);
              setIsFollowModeActive(true);
              if (userLocation) setMapCenterCommand({ ...userLocation, ts: Date.now() });
            }}
            className="bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-full shadow-md text-gray-700 font-medium border border-gray-200 flex items-center gap-2 active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
            {t.clearPin}
          </button>
        </div>
      )}

      {/* ── Main Content ────────────────────────────────────────────────── */}
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

      {/* ── Floating Controls Bottom-Right ──────────────────────────────── */}
      <div className="absolute bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-[1000] flex flex-col gap-3">
        {viewMode === 'map' && (
          <button
            onClick={handleLocateMe}
            className={`p-3.5 rounded-full shadow-lg transition-all border active:scale-90 ${isFollowModeActive ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-blue-600 border-gray-100'}`}
            aria-label={t.backToLocation}
          >
            <LocateFixed className="w-6 h-6" />
          </button>
        )}
        <button
          onClick={() => { haptic('selection'); setIsSettingsOpen(true); }}
          className="bg-white/90 backdrop-blur-sm p-3.5 rounded-full shadow-md text-gray-500 border border-gray-100 active:scale-90 transition-all"
          aria-label={t.settings}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* ── Compass Widget Bottom-Left ──────────────────────────────────── */}
      {viewMode === 'map' && (
        <div className="absolute bottom-[calc(6rem+env(safe-area-inset-bottom))] left-4 z-[1000]">
          <CompassWidget
            userLocation={userLocation}
            nearestFountain={nearestFountain}
            isActive={isCompassActive}
            onActivate={() => { haptic('medium'); setIsCompassActive(prev => !prev); }}
            heading={deviceHeading}
          />
        </div>
      )}

      {/* ── View Toggle Bar ─────────────────────────────────────────────── */}
      <div className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[1000] bg-white p-1.5 rounded-full shadow-lg flex items-center border border-gray-100">
        <button
          onClick={() => { haptic('selection'); setViewMode('map'); }}
          className={`px-6 py-2.5 rounded-full font-semibold transition-all ${viewMode === 'map' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-gray-500'}`}
        >
          {t.map}
        </button>
        <button
          onClick={() => { haptic('selection'); setViewMode('list'); }}
          className={`px-5 py-2.5 rounded-full font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-gray-500'}`}
        >
          {t.list}
          {fountains.length > 0 && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${viewMode === 'list' ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'}`}>
              {fountains.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Fountain Details Bottom Sheet ───────────────────────────────── */}
      {viewMode === 'map' && (
        <FountainDetails
          fountain={selectedFountain}
          onClose={() => { haptic('light'); setSelectedFountain(null); }}
          userLocation={targetLocation}
          t={t}
          unitSystem={unitSystem}
        />
      )}

      {/* ── Settings Bottom Sheet ───────────────────────────────────────── */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-[2000]">
          {/* Scrim */}
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setIsSettingsOpen(false)}
          />
          {/* Sheet – slides up from bottom, max 90dvh for long devices */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[90dvh] flex flex-col animate-slide-up">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-0 shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            {/* Header */}
            <div className="px-6 pt-3 pb-4 flex items-center justify-between border-b border-gray-100 shrink-0">
              <h2 className="text-xl font-bold text-gray-900">{t.settings}</h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-2.5 bg-gray-100 rounded-full active:scale-90 transition-all"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Scrollable settings content */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">

              {/* Language – segmented chips */}
              <div>
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t.language}</label>
                <div className="flex gap-2">
                  {(['es', 'ca', 'en'] as Language[]).map(lang => (
                    <button
                      key={lang}
                      onClick={() => { haptic('selection'); setLanguage(lang); }}
                      className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${language === lang ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {lang === 'es' ? 'ES' : lang === 'ca' ? 'CA' : 'EN'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Units – segmented toggle */}
              <div>
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t.units}</label>
                <div className="flex bg-gray-100 rounded-xl p-1">
                  {(['metric', 'imperial'] as UnitSystem[]).map(u => (
                    <button
                      key={u}
                      onClick={() => { haptic('selection'); setUnitSystem(u); }}
                      className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all active:scale-95 ${unitSystem === u ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                    >
                      {u === 'metric' ? 'km / m' : 'mi / ft'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search radius – scrollable chips */}
              <div>
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t.radius}</label>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {radiusOptions.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => { haptic('selection'); setRadiusKm(value); }}
                      className={`shrink-0 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 ${radiusKm === value ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Map type – scrollable chips */}
              <div>
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t.mapType}</label>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {mapTypeOptions.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => { haptic('selection'); setMapType(value); }}
                      className={`shrink-0 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 ${mapType === value ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Keep screen on – large toggle */}
              <div className="flex items-center justify-between py-1">
                <span className="text-base font-medium text-gray-800">{t.keepScreenOn}</span>
                <button
                  onClick={() => { haptic('medium'); setIsWakeLockActive(prev => !prev); }}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${isWakeLockActive ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${isWakeLockActive ? 'translate-x-8' : 'translate-x-1'}`} />
                </button>
              </div>
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
