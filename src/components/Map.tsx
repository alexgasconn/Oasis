import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap, useMapEvents, AttributionControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-rotate';
import { Fountain } from '../types';

// ============================================================================
// Leaflet Icon Fixes
// ============================================================================
// React-Leaflet has a known issue with Webpack/Vite where default marker icons
// are not loaded correctly. This code manually merges the correct icon URLs.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ============================================================================
// Custom Map Icons
// ============================================================================
/**
 * Creates a custom HTML-based icon for the map markers.
 * Uses a 44px outer touch target (WCAG / Android standard) with a prominent
 * colored inner circle to be easily distinguishable at a glance.
 * @param color The hex color code for the marker fill.
 * @param innerSize The pixel size of the visible inner dot.
 */
const createIcon = (color: string, innerSize = 28) => {
  const outer = 48;
  return new L.DivIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        width: ${outer}px; height: ${outer}px;
        display: flex; align-items: center; justify-content: center;
      ">
        <div style="
          background-color: ${color};
          width: ${innerSize}px; height: ${innerSize}px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 3px 10px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2);
        "></div>
      </div>
    `,
    iconSize: [outer, outer],
    iconAnchor: [outer / 2, outer / 2],
    popupAnchor: [0, -(outer / 2)],
  });
};

// Pre-defined icons for different types of water sources
const icons = {
  potable: createIcon('#10b981'), // emerald-500  (Safe to drink)
  unknown: createIcon('#f59e0b'), // amber-500    (Unknown status)
  notPotable: createIcon('#ef4444'), // red-500      (Not safe to drink)
  natural: createIcon('#3b82f6'), // blue-500     (Natural spring)
};

/**
 * Determines the correct icon to display based on the fountain's properties.
 */
const getIconForFountain = (fountain: Fountain) => {
  if (fountain.type === 'natural') return icons.natural;
  if (fountain.potable === 'yes') return icons.potable;
  if (fountain.potable === 'no') return icons.notPotable;
  return icons.unknown;
};

// ============================================================================
// Map Helper Components
// ============================================================================

/**
 * Zoom +/- buttons portalled into the map container.
 * Using createPortal ensures they remain inside the map's coordinate space
 * while still being positioned with absolute CSS over the tiles.
 * 48×48dp matches Android's minimum recommended touch target size.
 */
function ZoomControls() {
  const map = useMap();
  const container = map.getContainer();

  return createPortal(
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(14rem + env(safe-area-inset-bottom))',
        right: '1rem',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'all',
      }}
    >
      <button
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); map.zoomIn(); navigator.vibrate?.(10); }}
        style={{ width: 48, height: 48 }}
        className="bg-white rounded-2xl shadow-lg flex items-center justify-center text-gray-800 text-2xl font-light border border-gray-100 active:scale-90 active:bg-gray-50 transition-transform"
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); map.zoomOut(); navigator.vibrate?.(10); }}
        style={{ width: 48, height: 48 }}
        className="bg-white rounded-2xl shadow-lg flex items-center justify-center text-gray-800 text-2xl font-light border border-gray-100 active:scale-90 active:bg-gray-50 transition-transform"
        aria-label="Zoom out"
      >
        −
      </button>
    </div>,
    container
  );
}

/**
 * A utility component that flies the map to a specific location when commanded.
 * This prevents the map from fighting the user's manual panning.
 */
function MapCenterController({ command, isFollowMode }: { command: { lat: number; lng: number; ts: number } | null, isFollowMode: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (command &&
      typeof command.lat === 'number' && !isNaN(command.lat) && isFinite(command.lat) &&
      typeof command.lng === 'number' && !isNaN(command.lng) && isFinite(command.lng)) {
      try {
        // If in follow mode, use a faster animation for real-time feel
        const duration = isFollowMode ? 0.3 : 0.8;
        const zoom = map.getZoom();
        // Ensure zoom is also valid
        if (typeof zoom === 'number' && !isNaN(zoom)) {
          map.flyTo([command.lat, command.lng], zoom, { duration });
        }
      } catch (e) {
        console.warn('MapCenterController failed to flyTo:', e);
      }
    }
  }, [command, map, isFollowMode]);
  return null;
}

/**
 * A utility component that listens for click events on the map and triggers
 * a callback with the clicked coordinates.
 */
function MapClickHandler({ onMapClick }: { onMapClick: (latlng: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
}

/**
 * Renders only the fountain markers that are within the current map viewport
 * (plus a 40% buffer to avoid pop-in). This dramatically reduces DOM nodes
 * when thousands of fountains are loaded, keeping panning smooth.
 * The nearest fountain is always rendered even if off-screen (for the polyline).
 */
function VisibleFountainsLayer({
  fountains,
  onFountainSelect,
  nearestFountainId,
}: {
  fountains: Fountain[];
  onFountainSelect: (fountain: Fountain) => void;
  nearestFountainId?: string | null;
}) {
  const map = useMap();
  const [bounds, setBounds] = useState(() => map.getBounds().pad(0.4));

  useMapEvents({
    moveend: () => setBounds(map.getBounds().pad(0.4)),
    zoomend: () => setBounds(map.getBounds().pad(0.4)),
  });

  const isValidLatLng = (lat: any, lng: any) =>
    typeof lat === 'number' && !isNaN(lat) && isFinite(lat) &&
    typeof lng === 'number' && !isNaN(lng) && isFinite(lng);

  const visibleFountains = useMemo(() => {
    return fountains.filter(f =>
      isValidLatLng(f.lat, f.lng) &&
      (bounds.contains([f.lat, f.lng]) || f.id === nearestFountainId)
    );
  }, [fountains, bounds, nearestFountainId]);

  return (
    <>
      {visibleFountains.map((fountain) => (
        <Marker
          key={fountain.id}
          position={[fountain.lat, fountain.lng]}
          icon={getIconForFountain(fountain)}
          eventHandlers={{
            click: () => onFountainSelect(fountain),
          }}
        />
      ))}
    </>
  );
}

// ============================================================================
// Main Map Component
// ============================================================================

interface MapProps {
  userLocation: { lat: number; lng: number } | null;
  customLocation: { lat: number; lng: number } | null;
  fountains: Fountain[];
  onFountainSelect: (fountain: Fountain) => void;
  onMapClick: (latlng: { lat: number; lng: number }) => void;
  mapType: string;
  mapCenterCommand: { lat: number; lng: number; ts: number } | null;
  nearestFountain: Fountain | null;
  isFollowMode: boolean;
  heading: number | null;
}

export function MapView({
  userLocation,
  customLocation,
  fountains,
  onFountainSelect,
  onMapClick,
  mapType,
  mapCenterCommand,
  nearestFountain,
  isFollowMode,
  heading
}: MapProps) {
  // Default to Madrid if no location is available yet
  const defaultCenter = { lat: 40.4168, lng: -3.7038 };
  const rawCenter = customLocation || userLocation || defaultCenter;

  // Ensure we never pass NaN to Leaflet
  const isValidLatLng = (lat: any, lng: any) =>
    typeof lat === 'number' && !isNaN(lat) && isFinite(lat) &&
    typeof lng === 'number' && !isNaN(lng) && isFinite(lng);

  const center = isValidLatLng(rawCenter.lat, rawCenter.lng) ? rawCenter : defaultCenter;

  const polylinePositions = useMemo(() => {
    if (!nearestFountain || !isValidLatLng(nearestFountain.lat, nearestFountain.lng)) return null;
    return [
      [center.lat, center.lng] as [number, number],
      [nearestFountain.lat, nearestFountain.lng] as [number, number]
    ];
  }, [center.lat, center.lng, nearestFountain]);

  /**
   * Returns the appropriate tile layer URL based on the selected map type.
   */
  const getMapUrl = () => {
    switch (mapType) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'terrain':
        return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      case 'light':
        return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      case 'dark':
        return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      case 'standard':
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  /**
   * Returns the appropriate attribution text for the selected map type.
   * This is legally required by map tile providers.
   */
  const getMapAttribution = () => {
    switch (mapType) {
      case 'satellite':
        return 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
      case 'terrain':
        return 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)';
      case 'light':
      case 'dark':
        return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
      case 'standard':
      default:
        return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    }
  };

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={15}
      preferCanvas={true}
      style={{ height: '100%', width: '100%', zIndex: 0 }}
      zoomControl={false} // Disabled default zoom control for cleaner UI
      attributionControl={false}
      {...({
        rotate: true,
        touchRotate: true,
        rotateControl: {
          closeOnZeroBearing: false
        }
      } as any)}
    >
      <AttributionControl position="bottomright" />
      <MapCenterController command={mapCenterCommand} isFollowMode={isFollowMode} />
      <MapClickHandler onMapClick={onMapClick} />
      <ZoomControls />

      {/* Base Map Layer */}
      <TileLayer
        key={mapType} // Force re-render when mapType changes
        attribution={getMapAttribution()}
        url={getMapUrl()}
      />

      {/* User's Current Location Marker – Google Maps style with heading cone */}
      {userLocation && isValidLatLng(userLocation.lat, userLocation.lng) && (
        <>
          {/* GPS accuracy ring – subtle blue circle shows positional uncertainty */}
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={30}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.08,
              weight: 1,
              opacity: 0.3,
            }}
          />
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={new L.DivIcon({
              className: 'user-location-icon',
              html: `
                <div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;">
                  ${heading !== null ? `
                    <div style="position:absolute;width:72px;height:72px;transform:rotate(${heading}deg);transition:transform 0.15s linear;">
                      <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
                        <path d="M36 36 L22 10 Q36 2 50 10 Z" fill="rgba(59,130,246,0.35)" />
                      </svg>
                    </div>
                  ` : ''}
                  <div class="user-pulse" style="position:relative;width:22px;height:22px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(59,130,246,0.5);z-index:2;"></div>
                </div>
              `,
              iconSize: [56, 56],
              iconAnchor: [28, 28],
            })}
          />
        </>
      )}

      {/* Custom Selected Location Marker (Purple dot) */}
      {customLocation && isValidLatLng(customLocation.lat, customLocation.lng) && (
        <>
          <Marker
            position={[customLocation.lat, customLocation.lng]}
            icon={new L.DivIcon({
              className: 'custom-location-icon',
              html: `<div style="background-color: #8b5cf6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.3);"></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })}
          />
        </>
      )}

      {/* Dashed line to nearest fountain */}
      {polylinePositions && (
        <Polyline
          positions={polylinePositions}
          pathOptions={{
            color: '#3b82f6',
            weight: 3,
            dashArray: '10, 10',
            opacity: 0.7
          }}
        />
      )}

      {/* Water Fountain Markers – only renders visible viewport for performance */}
      <VisibleFountainsLayer
        fountains={fountains}
        onFountainSelect={onFountainSelect}
        nearestFountainId={nearestFountain?.id}
      />
    </MapContainer>
  );
}
