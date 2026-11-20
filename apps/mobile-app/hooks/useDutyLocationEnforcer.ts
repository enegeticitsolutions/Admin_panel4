import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { API_URL } from '@/constants/api';

export interface ActiveShiftSession {
  id: string;
  loginTime: string;
  loginLat?: number | null;
  loginLng?: number | null;
  loginAddress?: string | null;
  lastLocationLat?: number | null;
  lastLocationLng?: number | null;
  lastLocationTime?: string | null;
  elapsedSeconds?: number;
}

export interface TodayShiftSummary {
  totalMinutesWorked: number;
  totalHoursWorked: number;
  sessionsCount: number;
}

export function useDutyLocationEnforcer() {
  const [isWorking, setIsWorking] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveShiftSession | null>(null);
  const [todaySummary, setTodaySummary] = useState<TodayShiftSummary>({
    totalMinutesWorked: 0,
    totalHoursWorked: 0,
    sessionsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isLocationBlocked, setIsLocationBlocked] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const guardIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isWorkingRef = useRef(isWorking);
  isWorkingRef.current = isWorking;

  // 1. Fetch duty & attendance status from backend
  const checkStatus = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/care-companion/attendance/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        setLoading(false);
        return;
      }

      const json = await res.json();
      if (json.success && json.data) {
        const working = Boolean(json.data.isWorking);
        setIsWorking(working);
        setActiveSession(json.data.activeAttendance || null);
        if (json.data.todaySummary) {
          setTodaySummary(json.data.todaySummary);
        }
        if (json.data.activeAttendance?.elapsedSeconds) {
          setElapsedSeconds(json.data.activeAttendance.elapsedSeconds);
        } else if (!working) {
          setElapsedSeconds(0);
        }
      }
    } catch (e) {
      console.warn('[DutyLocationEnforcer] Failed to check status:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Telemetry ping sender
  const sendLocationPing = useCallback(async (latitude: number, longitude: number) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token || !isWorkingRef.current) return;

      await fetch(`${API_URL}/care-companion/attendance/location-ping`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude,
          longitude,
          isGpsActive: true,
        }),
      });
    } catch (err) {
      console.warn('[DutyLocationEnforcer] Ping failed:', err);
    }
  }, []);

  // 3. Location Guard Check: ensures GPS is enabled while on duty
  const verifyLocationEnabled = useCallback(async () => {
    if (!isWorkingRef.current) {
      setIsLocationBlocked(false);
      return;
    }

    try {
      const hasServices = await Location.hasServicesEnabledAsync();
      if (!hasServices) {
        setIsLocationBlocked(true);
        return;
      }

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsLocationBlocked(true);
        return;
      }

      // Everything is fine
      setIsLocationBlocked(false);
    } catch (err) {
      console.warn('[DutyLocationEnforcer] Guard check error:', err);
    }
  }, []);

  // 4. Punch In (Log In to Shift)
  const punchIn = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    setActionLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Authentication token missing. Please log in.');

      // Check permissions
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        throw new Error('Location permission is strictly required to start duty.');
      }

      const hasServices = await Location.hasServicesEnabledAsync();
      if (!hasServices) {
        throw new Error('Please turn ON your device GPS / Location before clocking in.');
      }

      // Capture high-accuracy position
      let coords: { latitude: number; longitude: number } | null = null;
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
      } catch (locErr) {
        console.warn('[DutyLocationEnforcer] Current position failed, trying last known:', locErr);
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          coords = {
            latitude: last.coords.latitude,
            longitude: last.coords.longitude,
          };
        }
      }

      if (!coords) {
        throw new Error('Could not acquire your GPS location. Please check device location settings.');
      }

      const res = await fetch(`${API_URL}/care-companion/attendance/login`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Clock in failed');
      }

      setIsWorking(true);
      setActiveSession(json.data.attendance || null);
      setElapsedSeconds(0);
      setIsLocationBlocked(false);

      return { success: true, message: json.message };
    } catch (err: any) {
      console.error('[DutyLocationEnforcer] Punch-in error:', err);
      return { success: false, message: err.message || 'Failed to start shift' };
    } finally {
      setActionLoading(false);
    }
  }, []);

  // 5. Punch Out (Log Out of Shift)
  const punchOut = useCallback(async (): Promise<{ success: boolean; durationMinutes?: number; message?: string }> => {
    setActionLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Authentication token missing.');

      let coords: { latitude?: number; longitude?: number } = {};
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
      } catch {
        // If GPS is unavailable during punch out, still allow clock-out
      }

      const res = await fetch(`${API_URL}/care-companion/attendance/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(coords),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Clock out failed');
      }

      setIsWorking(false);
      setActiveSession(null);
      setIsLocationBlocked(false);
      setElapsedSeconds(0);
      await checkStatus();

      return {
        success: true,
        durationMinutes: json.data?.durationMinutes || 0,
        message: json.message,
      };
    } catch (err: any) {
      console.error('[DutyLocationEnforcer] Punch-out error:', err);
      return { success: false, message: err.message || 'Failed to clock out' };
    } finally {
      setActionLoading(false);
    }
  }, [checkStatus]);

  // Initial load
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Handle active duty timers, location watchers, and guards
  useEffect(() => {
    if (!isWorking) {
      // Clean up all active listeners
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (guardIntervalRef.current) {
        clearInterval(guardIntervalRef.current);
        guardIntervalRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      setIsLocationBlocked(false);
      return;
    }

    // 1. Ticking shift duration timer
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    // 2. Regular Location Guard: checks every 6 seconds if GPS was turned off
    verifyLocationEnabled();
    guardIntervalRef.current = setInterval(verifyLocationEnabled, 6000);

    // 3. AppState change listener (e.g. user toggles GPS from control center and returns)
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        verifyLocationEnabled();
      }
    });

    // 4. Location Tracking Watcher
    let isSubscribed = true;
    (async () => {
      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 30000,
            distanceInterval: 20,
          },
          (loc) => {
            if (isSubscribed && loc?.coords) {
              sendLocationPing(loc.coords.latitude, loc.coords.longitude);
            }
          }
        );
        locationSubscriptionRef.current = sub;
      } catch (err) {
        console.warn('[DutyLocationEnforcer] Failed to start watchPositionAsync:', err);
      }
    })();

    // 5. Fallback periodic ping (every 40s) in case position hasn't moved
    pingIntervalRef.current = setInterval(async () => {
      try {
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        if (cur?.coords) {
          sendLocationPing(cur.coords.latitude, cur.coords.longitude);
        }
      } catch {
        // Handled by guard
      }
    }, 40000);

    return () => {
      isSubscribed = false;
      appStateSub.remove();
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (guardIntervalRef.current) {
        clearInterval(guardIntervalRef.current);
        guardIntervalRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, [isWorking, verifyLocationEnabled, sendLocationPing]);

  return {
    isWorking,
    activeSession,
    todaySummary,
    loading,
    actionLoading,
    isLocationBlocked,
    elapsedSeconds,
    punchIn,
    punchOut,
    checkStatus,
    verifyLocationEnabled,
  };
}
