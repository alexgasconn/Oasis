import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

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

export function useOfflinePackageStatus() {
    const [status, setStatus] = useState<'preparing' | 'ready' | 'unavailable'>(() =>
        Capacitor.isNativePlatform() ? 'ready' : 'serviceWorker' in navigator ? 'preparing' : 'unavailable'
    );

    useEffect(() => {
        if (Capacitor.isNativePlatform() || !('serviceWorker' in navigator)) return;
        let cancelled = false;
        const failed = () => setStatus('unavailable');
        window.addEventListener('offline-package-error', failed);
        navigator.serviceWorker.ready.then(() => {
            if (!cancelled) setStatus('ready');
        }).catch(failed);
        return () => {
            cancelled = true;
            window.removeEventListener('offline-package-error', failed);
        };
    }, []);

    return status;
}
