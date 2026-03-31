import { useState, useEffect } from 'react';

/**
 * Tracks the browser's online/offline status.
 * Used to show a banner when the device has no connectivity.
 */
export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState(() => navigator.onLine);

    useEffect(() => {
        const setOnline = () => setIsOnline(true);
        const setOffline = () => setIsOnline(false);
        window.addEventListener('online', setOnline);
        window.addEventListener('offline', setOffline);
        return () => {
            window.removeEventListener('online', setOnline);
            window.removeEventListener('offline', setOffline);
        };
    }, []);

    return isOnline;
}
