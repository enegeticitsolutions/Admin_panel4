import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';

/**
 * Global background/foreground live GPS streaming hook for Sathi Companion volunteers.
 * Mounted in (sathi)/_layout.tsx to continuously stream real-time GPS coordinates
 * to the backend companion tracker whenever the Sathi is active in the mobile app.
 */
export function useSathiLiveLocation() {
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let locationSub: Location.LocationSubscription | null = null;
    let heartbeatTimer: any = null;
    let isCancelled = false;

    const pushLocation = async (lat: number, lng: number) => {
      try {
        // Skip duplicate coordinates to save bandwidth
        if (
          lastCoordsRef.current &&
          Math.abs(lastCoordsRef.current.lat - lat) < 0.00001 &&
          Math.abs(lastCoordsRef.current.lng - lng) < 0.00001
        ) {
          return;
        }

        const token = await AsyncStorage.getItem('userToken');
        if (!token) return;

        const response = await fetch(`${API_URL}/sathi/location`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            latitude: lat,
            longitude: lng,
          }),
        });

        if (response.ok) {
          lastCoordsRef.current = { lat, lng };
          console.log(`[useSathiLiveLocation] Live GPS synced successfully: (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn('[useSathiLiveLocation] Sync rejected:', response.status, errData);
        }
      } catch (err) {
        console.warn('[useSathiLiveLocation] Sync failed:', err);
      }
    };

    const initTracking = async () => {
      try {
        if (Platform.OS === 'web') return;

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[useSathiLiveLocation] Location permission denied');
          return;
        }

        // 1. Initial immediate location fetch using High Accuracy
        try {
          const initial = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          if (initial?.coords && !isCancelled) {
            await pushLocation(initial.coords.latitude, initial.coords.longitude);
          }
        } catch (initialErr) {
          console.warn('[useSathiLiveLocation] Initial position error:', initialErr);
        }

        // 2. Continuous position updates via watcher
        if (!isCancelled) {
          locationSub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000,
              distanceInterval: 5,
            },
            (loc) => {
              if (loc?.coords && !isCancelled) {
                pushLocation(loc.coords.latitude, loc.coords.longitude);
              }
            }
          );
        }

        // 3. Fallback periodic sync every 10s (crucial for Android Emulator mock GPS changes)
        heartbeatTimer = setInterval(async () => {
          if (isCancelled) return;
          try {
            const current = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            if (current?.coords && !isCancelled) {
              await pushLocation(current.coords.latitude, current.coords.longitude);
            }
          } catch (e) {
            // silent heartbeat catch
          }
        }, 10000);

      } catch (err) {
        console.warn('[useSathiLiveLocation] Init error:', err);
      }
    };

    initTracking();

    return () => {
      isCancelled = true;
      if (locationSub) {
        locationSub.remove();
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
    };
  }, []);
}
