/**
 * AuthContext — Centralized authentication state for the entire app.
 *
 * Key Design Principles:
 * - Login state is loaded ONCE from AsyncStorage on startup
 * - All screens consume `useAuth()`
 * - `login(token, userData)` persists the session and updates global state
 * - `logout()` clears session state immediately and performs network/cache cleanup in background
 * - `disableBiometrics()` allows the user to explicitly remove device-stored biometric credentials
 * - Biometric credentials (SecureStore) persist across normal logouts so Face ID / Touch ID remains available
 * - `switchRole(targetRole)` switches active role for dual-role users without logging out
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '@/constants/api';
import { registerForPushNotifications, unregisterPushToken } from '@/services/notifications';
import { queryClient } from '@/services/queryClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserData {
  id: string;
  name: string;
  phone: string;
  role: 'subscriber' | 'beneficiary' | 'care_companion' | 'volunteer' | string;
  [key: string]: any;
}

interface AuthState {
  isLoading: boolean;
  isLoggedIn: boolean;
  token: string | null;
  user: UserData | null;
  role: string | null;
  /** Roles the logged-in user is eligible to switch to (e.g. ['subscriber', 'beneficiary']) */
  availableRoles: string[];
  /** Beneficiary.id for this user's own self-profile (only when dual-role) */
  selfBeneficiaryId: string | null;
  /** Whether a role switch is in progress */
  isSwitchingRole: boolean;
  /** Whether a logout operation is actively in progress */
  isLoggingOut: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, userData: UserData, availableRoles?: string[], selfBeneficiaryId?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  disableBiometrics: () => Promise<void>;
  updateUser: (token: string, userData: UserData) => Promise<void>;
  /** Switch between subscriber ↔ beneficiary (self) roles — dual-role users only */
  switchRole: (targetRole: 'subscriber' | 'beneficiary') => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const SESSION_STORAGE_KEYS = [
  'userToken',
  'userData',
  'availableRoles',
  'selfBeneficiaryId',
  'selectedBeneficiaryId',
  'activeSubscription',
];

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isLoggedIn: false,
    token: null,
    user: null,
    role: null,
    availableRoles: [],
    selfBeneficiaryId: null,
    isSwitchingRole: false,
    isLoggingOut: false,
  });

  const isLoggingOutRef = useRef(false);

  // Load persisted session on startup — runs exactly ONCE
  useEffect(() => {
    const loadSession = async () => {
      try {
        let storedToken: string | null = null;
        if (Platform.OS !== 'web') {
          storedToken = await SecureStore.getItemAsync('secureUserToken');
        }
        if (!storedToken) {
          storedToken = await AsyncStorage.getItem('userToken');
          // Migrate legacy token to SecureStore if present
          if (storedToken && Platform.OS !== 'web') {
            await SecureStore.setItemAsync('secureUserToken', storedToken).catch(() => {});
          }
        }

        const [storedUser, storedAvailableRoles, storedSelfBenId] = await Promise.all([
          AsyncStorage.getItem('userData'),
          AsyncStorage.getItem('availableRoles'),
          AsyncStorage.getItem('selfBeneficiaryId'),
        ]);

        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser) as UserData;
          const parsedRoles: string[] = storedAvailableRoles ? JSON.parse(storedAvailableRoles) : [parsedUser.role];
          setState({
            isLoading: false,
            isLoggedIn: true,
            token: storedToken,
            user: parsedUser,
            role: parsedUser.role,
            availableRoles: parsedRoles,
            selfBeneficiaryId: storedSelfBenId || null,
            isSwitchingRole: false,
            isLoggingOut: false,
          });
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (err) {
        console.error('[AuthContext] Failed to load session:', err);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadSession();
  }, []);

  // Called after successful OTP verify, password login, or biometric login
  const login = useCallback(async (
    token: string,
    userData: UserData,
    availableRoles: string[] = [userData.role],
    selfBeneficiaryId: string | null = null,
  ) => {
    const roles = availableRoles.length > 0 ? availableRoles : [userData.role];
    const promises: Promise<any>[] = [
      AsyncStorage.setItem('userToken', token),
      AsyncStorage.setItem('userData', JSON.stringify(userData)),
      AsyncStorage.setItem('availableRoles', JSON.stringify(roles)),
      AsyncStorage.setItem('selfBeneficiaryId', selfBeneficiaryId ?? ''),
    ];

    if (Platform.OS !== 'web') {
      promises.push(
        SecureStore.setItemAsync('secureUserToken', token),
        SecureStore.setItemAsync('secureUserData', JSON.stringify(userData))
      );
    }

    await Promise.all(promises);

    setState({
      isLoading: false,
      isLoggedIn: true,
      token,
      user: userData,
      role: userData.role,
      availableRoles: roles,
      selfBeneficiaryId,
      isSwitchingRole: false,
      isLoggingOut: false,
    });

    // Synchronize push notification token for this device with backend in background
    registerForPushNotifications(token).catch(err => {
      console.warn('[AuthContext] Push token registration on login failed:', err);
    });
  }, []);

  // Updates current user profile details dynamically
  const updateUser = useCallback(async (token: string, userData: UserData) => {
    const promises: Promise<any>[] = [
      AsyncStorage.setItem('userToken', token),
      AsyncStorage.setItem('userData', JSON.stringify(userData)),
    ];
    if (Platform.OS !== 'web') {
      promises.push(
        SecureStore.setItemAsync('secureUserToken', token),
        SecureStore.setItemAsync('secureUserData', JSON.stringify(userData))
      );
    }
    await Promise.all(promises);
    setState(prev => ({
      ...prev,
      token,
      user: userData,
      role: userData.role,
    }));
  }, []);

  /**
   * switchRole — switches the active role for a dual-role user
   */
  const switchRole = useCallback(async (targetRole: 'subscriber' | 'beneficiary') => {
    const currentToken = state.token;
    if (!currentToken) throw new Error('Not authenticated');

    setState(prev => ({ ...prev, isSwitchingRole: true }));

    try {
      const res = await fetch(`${API_URL}/auth/switch-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ targetRole }),
      });

      const json = await res.json();
      if (!res.ok || !json.data?.token) {
        throw new Error(json.message || 'Failed to switch role');
      }

      const { token, user: newUser, availableRoles, selfBeneficiaryId } = json.data;
      const userData: UserData = { ...newUser };
      const roles: string[] = availableRoles && availableRoles.length > 0 ? availableRoles : [targetRole];

      const savePromises: Promise<any>[] = [
        AsyncStorage.setItem('userToken', token),
        AsyncStorage.setItem('userData', JSON.stringify(userData)),
        AsyncStorage.setItem('availableRoles', JSON.stringify(roles)),
        AsyncStorage.setItem('selfBeneficiaryId', selfBeneficiaryId ?? ''),
      ];
      if (Platform.OS !== 'web') {
        savePromises.push(
          SecureStore.setItemAsync('secureUserToken', token),
          SecureStore.setItemAsync('secureUserData', JSON.stringify(userData))
        );
      }
      await Promise.all(savePromises);

      setState({
        isLoading: false,
        isLoggedIn: true,
        token,
        user: userData,
        role: targetRole,
        availableRoles: roles,
        selfBeneficiaryId: selfBeneficiaryId ?? null,
        isSwitchingRole: false,
        isLoggingOut: false,
      });

      registerForPushNotifications(token).catch(err => {
        console.warn('[AuthContext] Push token sync on switchRole failed:', err);
      });
    } catch (err) {
      setState(prev => ({ ...prev, isSwitchingRole: false }));
      throw err;
    }
  }, [state.token]);

  /**
   * logout — Instant, non-blocking, idempotent logout
   *
   * 1. Updates UI state immediately to trigger instant navigation to login screen.
   * 2. Clears React Query cache to prevent stale profile/dashboard data retention.
   * 3. Cleans up active session keys from AsyncStorage.
   * 4. Retains biometric credential in SecureStore for seamless Face ID / Touch ID on next launch.
   * 5. Unregisters push token on backend asynchronously in background without blocking UI.
   */
  const logout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    const tokenToUnregister = state.token;

    // 1. Immediately update context state so UI shifts to login with zero lag
    setState({
      isLoading: false,
      isLoggedIn: false,
      token: null,
      user: null,
      role: null,
      availableRoles: [],
      selfBeneficiaryId: null,
      isSwitchingRole: false,
      isLoggingOut: true,
    });

    // 2. Clear query cache
    try {
      queryClient.clear();
    } catch (e) {
      console.warn('[AuthContext] Failed to clear queryClient cache:', e);
    }

    // 3. Remove active session storage in background
    try {
      await AsyncStorage.multiRemove(SESSION_STORAGE_KEYS);
    } catch (err) {
      console.error('[AuthContext] Failed to clear session keys from AsyncStorage:', err);
    }

    // 4. Background push token unregistration
    if (tokenToUnregister) {
      unregisterPushToken(tokenToUnregister).catch(e => {
        console.warn('[AuthContext] Background push token unregistration note:', e);
      });
    }

    isLoggingOutRef.current = false;
    setState(prev => ({ ...prev, isLoggingOut: false }));
  }, [state.token]);

  /**
   * disableBiometrics — unlinks device biometric credentials (e.g. from user profile settings)
   */
  const disableBiometrics = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      await Promise.all([
        SecureStore.deleteItemAsync('secureUserToken'),
        SecureStore.deleteItemAsync('secureUserData'),
      ]);
    } catch (e) {
      console.warn('[AuthContext] Failed to delete biometric credentials:', e);
    }
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    disableBiometrics,
    updateUser,
    switchRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() must be used inside <AuthProvider>. Check that _layout.tsx wraps screens with <AuthProvider>.');
  }
  return context;
}
