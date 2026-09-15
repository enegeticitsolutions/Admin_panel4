/**
 * AuthContext — Centralized authentication state for the entire app.
 *
 * This is the Swiggy/Flipkart pattern:
 * - Login state is loaded ONCE from AsyncStorage on startup
 * - All screens consume `useAuth()` — no more inline AsyncStorage calls
 * - `login(token, userData)` persists the session and updates global state
 * - `logout()` clears the session and updates global state
 * - The root layout (_layout.tsx) uses `isLoggedIn` to decide which
 *   screen group to render, making back-navigation into auth impossible
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerForPushNotifications, unregisterPushToken } from '@/services/notifications';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserData {
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
}

interface AuthContextValue extends AuthState {
  login: (token: string, userData: UserData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (token: string, userData: UserData) => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isLoggedIn: false,
    token: null,
    user: null,
    role: null,
  });

  // Load persisted session on startup — runs exactly ONCE
  useEffect(() => {
    const loadSession = async () => {
      try {
        let storedToken: string | null = null;
        if (Platform.OS !== 'web') {
          try {
            storedToken = await require('expo-secure-store').getItemAsync('secureUserToken');
          } catch (_) {}
        }
        if (!storedToken) {
          storedToken = await AsyncStorage.getItem('userToken');
          if (storedToken && Platform.OS !== 'web') {
            try {
              await require('expo-secure-store').setItemAsync('secureUserToken', storedToken);
            } catch (_) {}
          }
        }
        const storedUser = await AsyncStorage.getItem('userData');

        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser) as UserData;
          setState({
            isLoading: false,
            isLoggedIn: true,
            token: storedToken,
            user: parsedUser,
            role: parsedUser.role,
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

  // Called after successful OTP verify or password login
  const login = useCallback(async (token: string, userData: UserData) => {
    const promises: Promise<any>[] = [
      AsyncStorage.setItem('userToken', token),
      AsyncStorage.setItem('userData', JSON.stringify(userData)),
    ];
    if (Platform.OS !== 'web') {
      promises.push(
        require('expo-secure-store').setItemAsync('secureUserToken', token),
        require('expo-secure-store').setItemAsync('secureUserData', JSON.stringify(userData))
      );
    }
    await Promise.all(promises);
    setState({
      isLoading: false,
      isLoggedIn: true,
      token,
      user: userData,
      role: userData.role,
    });

    // Synchronize push notification token for this device with backend immediately
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
        require('expo-secure-store').setItemAsync('secureUserToken', token),
        require('expo-secure-store').setItemAsync('secureUserData', JSON.stringify(userData))
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

  // Called from logout button — clears everything
  const logout = useCallback(async () => {
    const currentToken = state.token;
    try {
      // Inform backend to clear fcmToken for this user session
      await unregisterPushToken(currentToken || undefined);
    } catch (e) {
      console.warn('[AuthContext] Failed to unregister push token during logout:', e);
    }

    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.clear();
      if (Platform.OS !== 'web') {
        await require('expo-secure-store').deleteItemAsync('secureUserToken').catch(() => {});
        await require('expo-secure-store').deleteItemAsync('secureUserData').catch(() => {});
      }
    } catch (err) {
      console.error('[AuthContext] Failed to clear session on logout:', err);
    }
    setState({
      isLoading: false,
      isLoggedIn: false,
      token: null,
      user: null,
      role: null,
    });
  }, [state.token]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Use this hook in any screen to access auth state:
 *
 * const { isLoggedIn, user, role, login, logout } = useAuth();
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() must be used inside <AuthProvider>. Check that _layout.tsx wraps screens with <AuthProvider>.');
  }
  return context;
}
