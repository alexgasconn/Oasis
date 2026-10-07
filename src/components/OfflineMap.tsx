import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Map as MLMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Fountain } from '../types';

maplibregl.setWorkerUrl(mapLibreWorkerUrl);

// ============================================================================
// Offline vector-tile basemap for Catalunya
// ============================================================================
// Renders locally-bundled vector tiles (generated once from OpenStreetMap data
// via Planetiler, see scripts/extract-mbtiles.cjs) so the map keeps working
// with zero network connection. Coverage is limited to the Catalunya bounding
// box baked into public/tiles-vector/catalunya.

const CATALUNYA_BOUNDS: [number, number, number, number] = [0.1564, 40.2125, 4.1748, 42.9243];

function createOfflineStyle(mapType: string): maplibregl.StyleSpecification {
    const dark = mapType === 'dark';
    const light = mapType === 'light';
    return {
        version: 8,
        sources: {
            catalunya: {
                type: 'vector',
                tiles: [`${location.origin}/tiles-vector/catalunya/{z}/{x}/{y}.pbf`],
                minzoom: 0,
                maxzoom: 12,
                bounds: CATALUNYA_BOUNDS,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            },
            fountains: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
            guidance: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        },
        layers: [
            { id: 'background', type: 'background', paint: { 'background-color': dark ? '#202428' : light ? '#f5f5f3' : '#eef1eb' } },
            { id: 'landcover', type: 'fill', source: 'catalunya', 'source-layer': 'landcover', paint: { 'fill-color': dark ? '#29342d' : light ? '#eeeeeb' : '#e3e8dc' } },
            { id: 'landuse', type: 'fill', source: 'catalunya', 'source-layer': 'landuse', paint: { 'fill-color': dark ? '#33332d' : light ? '#e8e8e5' : '#eae5d6', 'fill-opacity': 0.7 } },
            { id: 'park', type: 'fill', source: 'catalunya', 'source-layer': 'park', paint: { 'fill-color': dark ? '#354d3c' : light ? '#dde8dc' : '#c9e0b8', 'fill-opacity': 0.6 } },
            { id: 'water', type: 'fill', source: 'catalunya', 'source-layer': 'water', paint: { 'fill-color': dark ? '#244754' : light ? '#cbdde3' : '#a8cde6' } },
            { id: 'waterway', type: 'line', source: 'catalunya', 'source-layer': 'waterway', paint: { 'line-color': dark ? '#244754' : light ? '#cbdde3' : '#a8cde6', 'line-width': 1 } },
            {
                id: 'transportation-case', type: 'line', source: 'catalunya', 'source-layer': 'transportation',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': dark ? '#191c1f' : light ? '#d3d3d0' : '#cdc6b4', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 12, 3.5] },
            },
            {
                id: 'transportation', type: 'line', source: 'catalunya', 'source-layer': 'transportation',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': dark ? '#777b7e' : '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 2] },
            },
            { id: 'building', type: 'fill', source: 'catalunya', 'source-layer': 'building', minzoom: 12, paint: { 'fill-color': dark ? '#55534e' : light ? '#d9d9d6' : '#ded7c4', 'fill-opacity': 0.6 } },
            {
                id: 'boundary', type: 'line', source: 'catalunya', 'source-layer': 'boundary',
                filter: ['<=', ['get', 'admin_level'], 6],
                paint: { 'line-color': dark ? '#989284' : light ? '#aaa9a4' : '#a89a7d', 'line-width': 1, 'line-dasharray': [3, 2] },
            },
            { id: 'guidance', type: 'line', source: 'guidance', paint: { 'line-color': '#3b82f6', 'line-width': 3, 'line-dasharray': [3, 3] } },
            { id: 'fountains', type: 'circle', source: 'fountains', paint: { 'circle-color': ['get', 'color'], 'circle-radius': 7, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } },
        ],
    };
}

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
    mapType: string;
    nearestFountain: Fountain | null;
}

/**
 * Fully offline map view rendered from locally-bundled vector tiles.
 * Used as an automatic fallback when the device has no network connection
 * and the target location falls within the pre-downloaded Catalunya extract.
 */
export function OfflineMapView({ userLocation, customLocation, fountains, onFountainSelect, onMapClick, mapCenterCommand, mapType, nearestFountain }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MLMap | null>(null);
    const userMarkerRef = useRef<Marker | null>(null);
    const customMarkerRef = useRef<Marker | null>(null);
    const onMapClickRef = useRef(onMapClick);
    onMapClickRef.current = onMapClick;
    const onFountainSelectRef = useRef(onFountainSelect);
    onFountainSelectRef.current = onFountainSelect;
    const fountainsRef = useRef(fountains);
    fountainsRef.current = fountains;

    // Initialize map once
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;
        const center = customLocation || userLocation || { lat: 41.5912, lng: 1.5209 }; // Catalunya centroid fallback
        const map = new maplibregl.Map({
            container: containerRef.current,
            style: createOfflineStyle(mapType),
            center: [center.lng, center.lat],
            zoom: 13,
            attributionControl: false,
            maxBounds: CATALUNYA_BOUNDS,
            maxZoom: 18,
        });
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
        map.on('click', (event) => {
            const feature = map.getLayer('fountains') ? map.queryRenderedFeatures(event.point, { layers: ['fountains'] })[0] : undefined;
            const fountain = feature && fountainsRef.current.find(item => item.id === feature.properties.id);
            if (fountain) onFountainSelectRef.current(fountain);
            else onMapClickRef.current({ lat: event.lngLat.lat, lng: event.lngLat.lng });
        });
        map.on('mouseenter', 'fountains', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'fountains', () => { map.getCanvas().style.cursor = ''; });
        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const update = () => {
            for (const layer of createOfflineStyle(mapType).layers) {
                for (const [property, value] of Object.entries(layer.paint || {})) {
                    map.setPaintProperty(layer.id, property as Parameters<MLMap['setPaintProperty']>[1], value);
                }
            }
        };
        if (map.getLayer('background')) update();
        map.on('style.load', update);
        return () => { map.off('style.load', update); };
    }, [mapType]);

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

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const update = () => {
            (map.getSource('fountains') as maplibregl.GeoJSONSource).setData({
                type: 'FeatureCollection',
                features: fountains.filter(fountain => isValidLatLng(fountain.lat, fountain.lng)).map(fountain => ({
                    type: 'Feature',
                    properties: { id: fountain.id, color: getFountainColor(fountain) },
                    geometry: { type: 'Point', coordinates: [fountain.lng, fountain.lat] },
                })),
            });
        };
        if (map.getSource('fountains')) update();
        map.on('style.load', update);
        return () => { map.off('style.load', update); };
    }, [fountains]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const origin = customLocation || userLocation;
        const update = () => {
            (map.getSource('guidance') as maplibregl.GeoJSONSource).setData({
                type: 'FeatureCollection',
                features: origin && nearestFountain && isValidLatLng(origin.lat, origin.lng) && isValidLatLng(nearestFountain.lat, nearestFountain.lng) ? [{
                    type: 'Feature', properties: {},
                    geometry: { type: 'LineString', coordinates: [[origin.lng, origin.lat], [nearestFountain.lng, nearestFountain.lat]] },
                }] : [],
            });
        };
        if (map.getSource('guidance')) update();
        map.on('style.load', update);
        return () => { map.off('style.load', update); };
    }, [customLocation, userLocation, nearestFountain]);

    return <div ref={containerRef} className="offline-map" style={{ height: '100%', width: '100%' }} />;
}
