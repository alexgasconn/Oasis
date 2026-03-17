import { X, Navigation, Share2 } from 'lucide-react';
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

/**
 * FountainDetails Component
 * 
 * Displays a bottom sheet with details about a selected fountain,
 * including its type, distance from the user, and a button to navigate to it.
 */
export function FountainDetails({ fountain, onClose, userLocation, t, unitSystem }: Props) {
  // Don't render anything if no fountain is selected
  if (!fountain) return null;

  // Calculate the distance from the user's location to the fountain
  let distanceText = "";
  if (userLocation) {
    const dist = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, fountain.lat, fountain.lng);
    distanceText = formatDistance(dist, unitSystem, t);
  }

  /**
   * Opens directions to the selected fountain.
   * Uses Apple Maps on iOS and Google Maps elsewhere.
   */
  const handleNavigate = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS 
      ? `maps://maps.apple.com/?daddr=${fountain.lat},${fountain.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${fountain.lat},${fountain.lng}`;
    window.open(url, '_blank');
  };

  /**
   * Shares the fountain location using the Web Share API if available.
   */
  const handleShare = async () => {
    const shareData = {
      title: 'Water Fountain Location',
      text: `Check out this water fountain I found!`,
      url: `https://www.google.com/maps/search/?api=1&query=${fountain.lat},${fountain.lng}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(shareData.url);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <>
      {/* Backdrop overlay - clicking it closes the details sheet */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm z-[999] animate-fade-in"
        onClick={onClose}
      />
      
      {/* Bottom Sheet Container */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-[1000] animate-slide-up">
        <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          
          {/* Drag Handle (Visual indicator only, not functional for dragging yet) */}
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />

          {/* Header Section: Title, Distance, and Close Button */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {fountain.type === 'natural' ? t.naturalSpring : t.fountain}
              </h2>
              <div className="flex items-center gap-3">
                <PotabilityBadge fountain={fountain} t={t} />
                {distanceText && (
                  <span className="text-gray-500 font-medium text-lg">
                    • {distanceText}
                  </span>
                )}
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors shrink-0 ml-4"
              aria-label="Close details"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Primary Actions: Navigate and Share */}
          <div className="flex gap-3">
            <button
              onClick={handleNavigate}
              className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-semibold text-xl flex items-center justify-center gap-3 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20"
            >
              <Navigation className="w-6 h-6" />
              {t.navigate}
            </button>
            <button
              onClick={handleShare}
              className="p-4 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 active:scale-[0.98] transition-all"
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
