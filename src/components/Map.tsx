import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
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
 * @param color The hex color code for the marker.
 */
const createIcon = (color: string) => {
  return new L.DivIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10], // Centers the icon over the coordinate
  });
};

// Pre-defined icons for different types of water sources
const icons = {
  potable: createIcon('#10b981'), // emerald-500 (Safe to drink)
  unknown: createIcon('#f59e0b'), // amber-500 (Unknown status)
  notPotable: createIcon('#ef4444'), // red-500 (Not safe to drink)
  natural: createIcon('#3b82f6'), // blue-500 (Natural spring)
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
 * A utility component that flies the map to a specific location when commanded.
 * This prevents the map from fighting the user's manual panning.
 */
function MapCenterController({ command }: { command: { lat: number; lng: number; ts: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (command && typeof command.lat === 'number' && !isNaN(command.lat) && typeof command.lng === 'number' && !isNaN(command.lng)) {
      map.flyTo([command.lat, command.lng], 15, { duration: 0.8 });
    }
  }, [command, map]);
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
}

export function MapView({ userLocation, customLocation, fountains, onFountainSelect, onMapClick, mapType, mapCenterCommand, nearestFountain }: MapProps) {
  // Default to Madrid if no location is available yet
  const defaultCenter = { lat: 40.4168, lng: -3.7038 }; 
  const rawCenter = customLocation || userLocation || defaultCenter;
  
  // Ensure we never pass NaN to Leaflet
  const isValidLatLng = (lat: any, lng: any) => typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng);
  const center = isValidLatLng(rawCenter.lat, rawCenter.lng) ? rawCenter : defaultCenter;

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
      style={{ height: '100%', width: '100%', zIndex: 0 }}
      zoomControl={false} // Disabled default zoom control for cleaner UI
      rotate={true}
      touchRotate={true}
      rotateControl={{
        closeOnZeroBearing: false
      }}
    >
      <MapCenterController command={mapCenterCommand} />
      <MapClickHandler onMapClick={onMapClick} />
      
      {/* Base Map Layer */}
      <TileLayer
        key={mapType} // Force re-render when mapType changes
        attribution={getMapAttribution()}
        url={getMapUrl()}
      />
      
      {/* User's Current Location Marker (Blue dot) */}
      {userLocation && (
        <>
          <Marker 
            position={[userLocation.lat, userLocation.lng]}
            icon={new L.DivIcon({
              className: 'user-location-icon',
              html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            })}
          />
        </>
      )}

      {/* Custom Selected Location Marker (Purple dot) */}
      {customLocation && (
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
      {nearestFountain && (
        <Polyline 
          positions={[
            [center.lat, center.lng],
            [nearestFountain.lat, nearestFountain.lng]
          ]}
          pathOptions={{
            color: '#3b82f6',
            weight: 3,
            dashArray: '10, 10',
            opacity: 0.7
          }}
        />
      )}

      {/* Water Fountain Markers */}
      {fountains.map((fountain) => (
        <Marker
          key={fountain.id}
          position={[fountain.lat, fountain.lng]}
          icon={getIconForFountain(fountain)}
          eventHandlers={{
            click: () => onFountainSelect(fountain),
          }}
        />
      ))}
    </MapContainer>
  );
}
