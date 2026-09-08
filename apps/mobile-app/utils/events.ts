import { DeviceEventEmitter } from 'react-native';
import { useEffect } from 'react';

const GLOBAL_REFRESH_EVENT = 'GLOBAL_REFRESH_DATA';

/**
 * Emits a global refresh event. 
 * Call this function after a successful mutation (e.g. logging a medication, updating a visit).
 */
export const emitGlobalRefresh = () => {
    DeviceEventEmitter.emit(GLOBAL_REFRESH_EVENT);
};

/**
 * Hook to listen for global refresh events.
 * @param callback The function to call when a refresh is requested (e.g. your data fetching function)
 */
export const useGlobalRefresh = (callback: () => void) => {
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener(GLOBAL_REFRESH_EVENT, () => {
            callback();
        });

        return () => {
            subscription.remove();
        };
    }, [callback]);
};
