import { useRef, useState } from 'react';
import { X, Navigation, Share2, Clock } from 'lucide-react';
import { Fountain } from '../types';
import { getDistanceFromLatLonInKm } from '../utils/distance';
import { formatDistance, UnitSystem } from '../translations';
import { PotabilityBadge } from './PotabilityBadge';

interface Props {
  fountain: Fountain | null;
  onClose: () => void;
  userLocation: { lat: number; lng: number } | null;
  t: any; // Translation object
  unitSystem: UnitSystem;
}

/** Average walking speed used for time estimates. */
const WALKING_KMH = 4;

function getWalkingTime(distKm: number): string {
  const minutes = Math.round((distKm / WALKING_KMH) * 60);
  if (minutes < 2) return '< 2 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/**
 * FountainDetails Component
 *
 * Touch-draggable bottom sheet showing fountain details.
 * Drag down â‰¥ 90px (or a quick flick) to dismiss.
 */
export function FountainDetails({ fountain, onClose, userLocation, t, unitSystem }: Props) {
  const [dragY, setDragY] = useState(0);
  const startTouchY = useRef(0);
  const isDraggingRef = useRef(false);

  if (!fountain) return null;

  let distanceKm: number | null = null;
  let distanceText = '';
  if (userLocation) {
    distanceKm = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, fountain.lat, fountain.lng);
    distanceText = formatDistance(distanceKm, unitSystem, t);
  }

  /**
   * Opens navigation. Uses the `geo:` URI on Android to trigger native Maps apps,
   * falling back to Google Maps web on desktop.
   */
  const handleNavigate = () => {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    let url: string;
    if (isAndroid) {
      // geo: URI is handled natively by any installed maps app (Google Maps, Waze, OsmAndâ€¦)
      url = `geo:${fountain.lat},${fountain.lng}?q=${fountain.lat},${fountain.lng}`;
    } else if (isIOS) {
      url = `maps://maps.apple.com/?daddr=${fountain.lat},${fountain.lng}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${fountain.lat},${fountain.lng}`;
    }
    window.open(url, '_blank');
  };

  const handleShare = async () => {
    const shareData = {
      title: fountain.type === 'natural' ? t.naturalSpring : t.fountain,
      text: `${fountain.type === 'natural' ? t.naturalSpring : t.fountain} â€“ ${distanceText ? `${distanceText} ` : ''}`,
      url: `https://www.google.com/maps/search/?api=1&query=${fountain.lat},${fountain.lng}`,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(shareData.url); } catch { /* ignore */ }
    }
  };

  // â”€â”€ Touch drag to dismiss â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    startTouchY.current = e.touches[0].clientY;
    isDraggingRef.current = true;
  };
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dy = e.touches[0].clientY - startTouchY.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    const velocity = e.changedTouches[0].clientY - startTouchY.current;
    if (dragY >= 90 || velocity > 300) {
      onClose();
    }
    setDragY(0);
  };

  const sheetStyle: React.CSSProperties = {
    transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
    transition: dragY > 0 ? 'none' : 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
  };

  return (
    <>
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/30 z-[999] animate-fade-in"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] z-[1000] animate-slide-up"
        style={sheetStyle}
      >
        {/* Drag handle â€“ touch-draggable area */}
        <div
          className="pt-3 pb-0 flex flex-col items-center cursor-grab active:cursor-grabbing select-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-4" />
        </div>

        <div className="px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {/* Header */}
          <div className="flex justify-between items-start mb-5">
            <div className="flex-1 pr-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {fountain.type === 'natural' ? t.naturalSpring : t.fountain}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <PotabilityBadge fountain={fountain} t={t} />
                {distanceText && (
                  <span className="text-gray-500 font-medium text-base">Â· {distanceText}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 bg-gray-100 rounded-full hover:bg-gray-200 active:scale-90 transition-all shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Walking time estimate */}
          {distanceKm !== null && (
            <div className="flex items-center gap-2 mb-5 px-4 py-3 bg-gray-50 rounded-2xl">
              <Clock className="w-5 h-5 text-gray-400 shrink-0" />
              <span className="text-gray-600 font-medium">{t.walkingTimeLabel} <strong className="text-gray-900">{getWalkingTime(distanceKm)}</strong></span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleNavigate}
              className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2.5 hover:bg-blue-700 active:scale-[0.97] transition-all shadow-lg shadow-blue-600/25"
            >
              <Navigation className="w-6 h-6" />
              {t.navigate}
            </button>
            <button
              onClick={handleShare}
              className="p-4 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 active:scale-[0.97] transition-all"
              aria-label="Share fountain"
            >
              <Share2 className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
