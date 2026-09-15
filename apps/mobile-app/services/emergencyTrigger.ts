/**
 * emergencyTrigger.ts — Shared SOS Emergency Trigger Logic
 *
 * Used by:
 *  - BeneficiaryDashboard (button tap)
 *  - _layout.tsx background notification response handler
 *
 * Handles:
 *  1. Best-possible location acquisition (live GPS → cached GPS → null)
 *  2. Reverse geocoding to human-readable address
 *  3. POST to backend /beneficiary/:id/emergency with all context
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { Platform, Linking } from 'react-native';

/**
 * 24/7 Emergency Helpline Number (Default Fallback)
 */
export const DEFAULT_EMERGENCY_HELPLINE_NUMBER = '01142258823';
export const EMERGENCY_HELPLINE_NUMBER = DEFAULT_EMERGENCY_HELPLINE_NUMBER;

// In-memory cache with AsyncStorage fallback for offline / instant access
let cachedHelplineNumber: string | null = null;
const STORAGE_KEY_HELPLINE = '@mhn_emergency_helpline';

/**
 * Returns the current emergency helpline number.
 * Reads in-memory cache -> AsyncStorage -> default fallback ('01142258823')
 */
export async function getEmergencyHelplineNumber(): Promise<string> {
  if (cachedHelplineNumber) {
    return cachedHelplineNumber;
  }
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_HELPLINE);
    if (stored) {
      cachedHelplineNumber = stored;
      return stored;
    }
  } catch {}
  return DEFAULT_EMERGENCY_HELPLINE_NUMBER;
}

/**
 * Synchronous getter for cases where async is not possible, returning cached or default.
 */
export function getCachedEmergencyHelplineNumber(): string {
  return cachedHelplineNumber || DEFAULT_EMERGENCY_HELPLINE_NUMBER;
}

/**
 * Fetches the latest system config from backend and updates local cache.
 */
export async function refreshEmergencyHelplineNumber(): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/public/company/config`);
    const json = await res.json();
    const dynamicNumber = json?.data?.EMERGENCY_HELPLINE_NUMBER;
    if (dynamicNumber && typeof dynamicNumber === 'string') {
      cachedHelplineNumber = dynamicNumber.trim();
      await AsyncStorage.setItem(STORAGE_KEY_HELPLINE, cachedHelplineNumber);
      return cachedHelplineNumber;
    }
  } catch (err) {
    console.warn('[EmergencyTrigger] Failed to refresh helpline number from API:', err);
  }
  return getEmergencyHelplineNumber();
}

// Background initial refresh
refreshEmergencyHelplineNumber().catch(() => {});

/**
 * Initiates an immediate phone call to the Emergency Helpline
 */
export async function dialEmergencyHelpline(targetNumber?: string): Promise<void> {
  const numberToDial = targetNumber || (await getEmergencyHelplineNumber());
  const telUrl = `tel:${numberToDial.replace(/[^\d+]/g, '')}`;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.location.href = telUrl;
      }
    } else {
      const canOpen = await Linking.canOpenURL(telUrl);
      if (canOpen) {
        await Linking.openURL(telUrl);
      } else {
        await Linking.openURL(telUrl);
      }
    }
  } catch (err) {
    console.warn('[EmergencyTrigger] Failed to dial emergency helpline:', err);
  }
}

export interface EmergencyTriggerResult {
  success: boolean;
  ticketNumber?: string;
  message?: string;
  locationAddress?: string;
  lat?: number;
  lng?: number;
  helplineNumber?: string;
  error?: string;
}

export interface LocationSnapshot {
  lat: number;
  lng: number;
  accuracy?: number;
  address: string;
  source: 'live_gps' | 'cached_gps' | 'registered_address';
}

/**
 * Acquire the best possible location:
 * 1. Try requesting foreground permission and live GPS (high accuracy, 8s timeout)
 * 2. Fall back to last known GPS fix (fast, no battery hit)
 * 3. Fall back to null (backend uses registered address)
 */
export async function getBestLocation(): Promise<LocationSnapshot | null> {
  if (Platform.OS === 'web') return null;

  try {
    // Request foreground permission (no-op if already granted)
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      // Try last known even without explicit permission ask (returns null if unavailable)
      const last = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 }); // 30 min
      if (last) {
        const address = await reverseGeocode(last.coords.latitude, last.coords.longitude);
        return {
          lat: last.coords.latitude,
          lng: last.coords.longitude,
          accuracy: last.coords.accuracy ?? undefined,
          address,
          source: 'cached_gps',
        };
      }
      return null;
    }

    // Try live GPS with a race against timeout
    const livePos = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
    ]);

    if (livePos && typeof livePos === 'object' && 'coords' in livePos) {
      const { latitude, longitude, accuracy } = livePos.coords;
      const address = await reverseGeocode(latitude, longitude);
      return {
        lat: latitude,
        lng: longitude,
        accuracy: accuracy ?? undefined,
        address,
        source: 'live_gps',
      };
    }

    // Live GPS timed out — try cached
    const cachedPos = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 });
    if (cachedPos) {
      const address = await reverseGeocode(cachedPos.coords.latitude, cachedPos.coords.longitude);
      return {
        lat: cachedPos.coords.latitude,
        lng: cachedPos.coords.longitude,
        accuracy: cachedPos.coords.accuracy ?? undefined,
        address,
        source: 'cached_gps',
      };
    }

    return null;
  } catch (err) {
    console.warn('[EmergencyTrigger] Location acquisition failed:', err);
    return null;
  }
}

/**
 * Reverse geocode GPS coordinates to a human-readable address string.
 */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (results && results.length > 0) {
      const r = results[0];
      const parts = [
        r.name,
        r.street,
        r.district,
        r.city,
        r.region,
        r.postalCode,
      ].filter(Boolean);
      return parts.join(', ');
    }
  } catch (err) {
    console.warn('[EmergencyTrigger] Reverse geocode failed:', err);
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export interface EmergencyTriggerOptions {
  autoDial?: boolean;
}

/**
 * Core function to POST an emergency alert to the backend and dial helpline.
 * Can be called from the button handler OR the background notification handler.
 *
 * @param description  Optional custom description to include in the alert.
 * @param options      Optional config (e.g. autoDial: true to call 01142258823)
 */
export async function triggerEmergencyAlert(
  description = 'SOS Emergency Support triggered from Mobile App',
  options: EmergencyTriggerOptions = { autoDial: true }
): Promise<EmergencyTriggerResult> {
  // Automatically dial the emergency helpline number (01142258823)
  if (options.autoDial) {
    dialEmergencyHelpline().catch(err => {
      console.warn('[EmergencyTrigger] Auto-dial error:', err);
    });
  }

  try {
    const [storedUser, storedToken] = await Promise.all([
      AsyncStorage.getItem('userData'),
      AsyncStorage.getItem('userToken'),
    ]);

    const dynamicHelpline = await getEmergencyHelplineNumber();

    if (!storedUser || !storedToken) {
      return { success: false, error: 'Not authenticated', helplineNumber: dynamicHelpline };
    }

    const parsedUser = JSON.parse(storedUser);
    const userId = parsedUser.id;

    // Acquire best-possible location
    const location = await getBestLocation();

    const body: Record<string, any> = { description };
    if (location) {
      body.lat = location.lat;
      body.lng = location.lng;
      body.address = location.address;
    }

    const postRes = await fetch(`${API_URL}/beneficiary/${userId}/emergency`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${storedToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const postData = await postRes.json();

    if (postRes.ok && postData.success) {
      return {
        success: true,
        ticketNumber: postData.data?.ticketNumber || 'EMG-ALERT',
        message: 'Your Subscriber, Care Companions, and Admin Emergency Center have been notified.',
        locationAddress: location?.address || postData.data?.locationAddress,
        lat: location?.lat,
        lng: location?.lng,
        helplineNumber: dynamicHelpline,
      };
    }

    return {
      success: false,
      error: postData.message || 'Failed to trigger emergency alert.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error while triggering emergency alert.',
    };
  }
}
