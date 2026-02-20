"use client";
import { useCallback } from 'react';

/**
 * A global hook for triggering device vibrations (haptics) securely.
 * Automatically checks for browser compatibility.
 */
export function useHaptics() {
    const vibrate = useCallback((pattern: number | number[]) => {
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            try {
                window.navigator.vibrate(pattern);
            } catch (e) {
                // Silently fail if vibration unsupported or blocked
            }
        }
    }, []);

    // Preset Premium Haptic Patterns
    return {
        vibrate,
        hapticLight: () => vibrate(10), // Short tick (button presses)
        hapticMedium: () => vibrate(30), // Solid pop (confirmations)
        hapticHeavy: () => vibrate(50), // Heavy thud (important actions)
        hapticSuccess: () => vibrate([20, 50, 20]), // Quick double pulse
        hapticError: () => vibrate([50, 100, 50, 100, 50]), // SOS-style triple pulse
    };
}
