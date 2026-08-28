import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MLMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Fountain } from '../types';

// ============================================================================
// Offline vector-tile basemap for Catalunya
// ============================================================================
// Renders locally-bundled vector tiles (generated once from OpenStreetMap data
// via Planetiler, see scripts/extract-mbtiles.cjs) so the map keeps working
// with zero network connection. Coverage is limited to the Catalunya bounding
// box baked into public/tiles-vector/catalunya.

const CATALUNYA_BOUNDS: [number, number, number, number] = [0.1564, 40.2125, 4.1748, 42.9243];

const OFFLINE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    catalunya: {
      type: 'vector',
      tiles: [`${location.origin}/tiles-vector/catalunya/{z}/{x}/{y}.pbf`],
      minzoom: 0,
      maxzoom: 12,
      bounds: CATALUNYA_BOUNDS,
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#eef1eb' } },
    { id: 'landcover', type: 'fill', source: 'catalunya', 'source-layer': 'landcover', paint: { 'fill-color': '#e3e8dc' } },
    { id: 'landuse', type: 'fill', source: 'catalunya', 'source-layer': 'landuse', paint: { 'fill-color': '#eae5d6', 'fill-opacity': 0.7 } },
    { id: 'park', type: 'fill', source: 'catalunya', 'source-layer': 'park', paint: { 'fill-color': '#c9e0b8', 'fill-opacity': 0.6 } },
    { id: 'water', type: 'fill', source: 'catalunya', 'source-layer': 'water', paint: { 'fill-color': '#a8cde6' } },
    { id: 'waterway', type: 'line', source: 'catalunya', 'source-layer': 'waterway', paint: { 'line-color': '#a8cde6', 'line-width': 1 } },
    {
      id: 'transportation-case', type: 'line', source: 'catalunya', 'source-layer': 'transportation',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#cdc6b4', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 12, 3.5] },
    },
    {
      id: 'transportation', type: 'line', source: 'catalunya', 'source-layer': 'transportation',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 2] },
    },
    { id: 'building', type: 'fill', source: 'catalunya', 'source-layer': 'building', minzoom: 12, paint: { 'fill-color': '#ded7c4', 'fill-opacity': 0.6 } },
    {
      id: 'boundary', type: 'line', source: 'catalunya', 'source-layer': 'boundary',
      filter: ['<=', ['get', 'admin_level'], 6],
      paint: { 'line-color': '#a89a7d', 'line-width': 1, 'line-dasharray': [3, 2] },
    },
  ],
};

function isValidLatLng(lat: any, lng: any) {
  return typeof lat === 'number' && !isNaN(lat) && isFinite(lat) &&
    typeof lng === 'number' && !isNaN(lng) && isFinite(lng);
}

function createDotEl(color: string, size = 20) {
  const el = document.createElement('div');
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = '50%';
  el.style.background = color;
  el.style.border = '3px solid white';
  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';
  return el;
}

function getFountainColor(fountain: Fountain) {
  if (fountain.type === 'natural') return '#3b82f6';
  if (fountain.potable === 'yes') return '#10b981';
  if (fountain.potable === 'no') return '#ef4444';
  return '#f59e0b';
}

interface Props {
  userLocation: { lat: number; lng: number } | null;
  customLocation: { lat: number; lng: number } | null;
  fountains: Fountain[];
  onFountainSelect: (fountain: Fountain) => void;
  onMapClick: (latlng: { lat: number; lng: number }) => void;
  mapCenterCommand: { lat: number; lng: number; ts: number } | null;
}

/**
 * Fully offline map view rendered from locally-bundled vector tiles.
 * Used as an automatic fallback when the device has no network connection
 * and the target location falls within the pre-downloaded Catalunya extract.
 */
export function OfflineMapView({ userLocation, customLocation, fountains, onFountainSelect, onMapClick, mapCenterCommand }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const customMarkerRef = useRef<Marker | null>(null);
  const fountainMarkersRef = useRef<Map<string, Marker>>(new Map());
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center = customLocation || userLocation || { lat: 41.5912, lng: 1.5209 }; // Catalunya centroid fallback
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OFFLINE_STYLE,
      center: [center.lng, center.lat],
      zoom: 13,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('click', (e) => onMapClickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to commanded location
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapCenterCommand) return;
    if (!isValidLatLng(mapCenterCommand.lat, mapCenterCommand.lng)) return;
    map.easeTo({ center: [mapCenterCommand.lng, mapCenterCommand.lat], duration: 400 });
  }, [mapCenterCommand]);

  // User location marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userLocation || !isValidLatLng(userLocation.lat, userLocation.lng)) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    if (!userMarkerRef.current) {
      userMarkerRef.current = new maplibregl.Marker({ element: createDotEl('#3b82f6', 18) })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [userLocation]);

  // Custom pin marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!customLocation || !isValidLatLng(customLocation.lat, customLocation.lng)) {
      customMarkerRef.current?.remove();
      customMarkerRef.current = null;
      return;
    }
    if (!customMarkerRef.current) {
      customMarkerRef.current = new maplibregl.Marker({ element: createDotEl('#8b5cf6', 18) })
        .setLngLat([customLocation.lng, customLocation.lat])
        .addTo(map);
    } else {
      customMarkerRef.current.setLngLat([customLocation.lng, customLocation.lat]);
    }
  }, [customLocation]);

  // Fountain markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = fountainMarkersRef.current;
    const nextIds = new Set(fountains.map(f => f.id));

    // Remove stale markers
    for (const [id, marker] of existing) {
      if (!nextIds.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    }
    // Add new markers
    for (const fountain of fountains) {
      if (existing.has(fountain.id) || !isValidLatLng(fountain.lat, fountain.lng)) continue;
      const el = createDotEl(getFountainColor(fountain), 16);
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onFountainSelect(fountain);
      });
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([fountain.lng, fountain.lat])
        .addTo(map);
      existing.set(fountain.id, marker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fountains]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
