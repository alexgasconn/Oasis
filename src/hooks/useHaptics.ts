/**
 * Provides haptic feedback via the Web Vibration API.
 * Gracefully falls back to no-op on devices that don't support it.
 * Patterns mimic native Android haptic categories.
 */
export function useHaptics() {
    const trigger = (type: 'selection' | 'light' | 'medium' | 'heavy' = 'light') => {
        if (!('vibrate' in navigator)) return;
        switch (type) {
            case 'selection': navigator.vibrate(8); break;
            case 'light': navigator.vibrate(15); break;
            case 'medium': navigator.vibrate(25); break;
            case 'heavy': navigator.vibrate([30, 15, 30]); break;
        }
    };
    return { trigger };
}
