import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';
import { AppState, Platform, View, ActivityIndicator } from 'react-native';
import type { AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { registerForPushNotifications, addNotificationReceivedListener, addNotificationResponseListener } from '@/services/notifications';
import { NavigationStackProvider, useNavigationStack } from '@/contexts/NavigationStackContext';

// Keep splash screen visible while we load fonts + session
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

// ─── Inner navigator — reads auth state to decide which screens exist ─────────

/**
 * KEY FIX: When the user is NOT logged in, only `(auth)` screens exist in
 * the stack — so back gestures cannot reach app screens.
 *
 * When the user IS logged in, only app screens exist — so back gestures
 * cannot reach the login screen. This is exactly how Swiggy/Zomato/Uber work.
 */
function RootNavigator() {
  const { isLoading, isLoggedIn } = useAuth();
  const { resetStack } = useNavigationStack();
  const router = useRouter();

  // Reset logical navigation stack when auth state changes
  useEffect(() => {
    resetStack();
  }, [isLoggedIn, resetStack]);

  // Register for push notifications when logged in
  useEffect(() => {
    if (isLoggedIn) {
      registerForPushNotifications();

      // Listen for incoming notifications while app is in foreground
      const subReceived = addNotificationReceivedListener((notification) => {
        console.log('🔔 [SathiApp] Notification received in foreground:', notification.request.content.title);
      });

      // Handle user tapping on a notification
      const subResponse = addNotificationResponseListener((response) => {
        const data = response.notification.request.content.data;
        console.log('👉 [SathiApp] User tapped notification:', data);

        if (data?.screen) {
          try {
            router.push(data.screen as any);
          } catch (e) {
            console.warn('[SathiApp] Failed to route to screen:', data.screen);
          }
        } else {
          try {
            router.push('/(sathi)/notifications');
          } catch (_) {}
        }
      });

      return () => {
        subReceived?.remove();
        subResponse?.remove();
      };
    }
  }, [isLoggedIn, router]);

  // While we're checking AsyncStorage, show a native splash-compatible loader
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#FE6700" />
      </View>
    );
  }

  // ── CONDITIONAL STACK ──
  // By rendering screens conditionally, we ensure that back gestures
  // cannot traverse between auth and app boundaries.
  // Note: Direct children of Stack must be Screen components or null (no Fragments).
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="splash" options={{ gestureEnabled: false, animation: 'fade' }} />
      {!isLoggedIn ? (
        <Stack.Screen name="(auth)" />
      ) : (
        <Stack.Screen name="(sathi)" options={{ gestureEnabled: false }} />
      )}
    </Stack>
  );
}

// ─── Root Layout ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded, error] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  // React Query AppState listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  // Hide splash screen once fonts have loaded
  useEffect(() => {
    if (fontsLoaded || error) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error]);

  if (!fontsLoaded && !error) return null;

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SafeAreaProvider>
          <AuthProvider>
            <NavigationStackProvider>
              <RootNavigator />
            </NavigationStackProvider>
          </AuthProvider>
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
