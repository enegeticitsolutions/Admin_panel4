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
import { registerForPushNotifications } from '@/services/notifications';
import { NavigationStackProvider, useNavigationStack } from '@/contexts/NavigationStackContext';
import { CustomAlertProvider } from '@/contexts/CustomAlertContext';
import * as Notifications from 'expo-notifications';
import { triggerEmergencyAlert } from '@/services/emergencyTrigger';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GlobalApiInterceptor } from '@/components/GlobalApiInterceptor';

import { queryClient } from '@/services/queryClient';

// Keep splash screen visible while we load fonts + session
SplashScreen.preventAutoHideAsync();

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
  const { isLoading, isLoggedIn, role } = useAuth();
  const { resetStack } = useNavigationStack();
  const router = useRouter();

  // Hide splash screen only when auth state is fully loaded 
  // (we already know fonts are loaded because this component wouldn't mount otherwise)
  useEffect(() => {
    if (!isLoading) {
      // Add a small delay to ensure the navigation stack has time to paint the first frame
      // before the native splash screen is dismissed.
      const timer = setTimeout(() => {
        SplashScreen.hideAsync();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const wasLoggedIn = useRef(isLoggedIn);

  // Reset logical navigation stack when auth state changes
  useEffect(() => {
    resetStack();
    // Only force navigation back to the auth stack if the user actually logged out,
    // otherwise this redirects on app launch and skips the custom animated splash screen!
    if (wasLoggedIn.current && !isLoggedIn && !isLoading) {
      router.replace('/(auth)');
    }
    wasLoggedIn.current = isLoggedIn;
  }, [isLoggedIn, isLoading, resetStack]);

  // Register for push notifications and listen for incoming messages when logged in
  useEffect(() => {
    if (isLoggedIn) {
      registerForPushNotifications();
    }
  }, [isLoggedIn]);

  // Real-time Query Cache Invalidation on Push Notification Delivery & Action Navigation
  useEffect(() => {
    if (!isLoggedIn || Platform.OS === 'web') return;

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Push Notification Received] Auto-refreshing dashboard queries:', notification.request.content.data);
      queryClient.invalidateQueries({ queryKey: ['subscriberDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaryDashboardInfo'] });
      queryClient.invalidateQueries({ queryKey: ['medicationsToday'] });
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'medication_reminder' || data?.medicationId) {
        console.log('[Push Notification Response] Opening Medication Tracker:', data);
        router.push('/(beneficiary)/meds');
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [isLoggedIn, router]);

  // ─── SOS Background Persistent Notification (Beneficiary only) ───────────────
  useEffect(() => {
    if (!isLoggedIn || role !== 'beneficiary' || Platform.OS === 'web') return;

    const SOS_CATEGORY = 'SOS_EMERGENCY';
    const SOS_CHANNEL = 'sos-emergency';

    let responseSub: Notifications.EventSubscription | null = null;

    const setupSosNotification = async () => {
      try {
        // 1. Create high-priority Android channel for SOS
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(SOS_CHANNEL, {
            name: '🚨 SOS Emergency',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 250, 500],
            lightColor: '#E7000B',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            sound: null,
            bypassDnd: true,
          });
        }

        // 2. Register action category with an SOS button
        await Notifications.setNotificationCategoryAsync(SOS_CATEGORY, [
          {
            identifier: 'SOS_TRIGGER',
            buttonTitle: '🚨 Send Emergency SOS',
            options: {
              isDestructive: true,
              isAuthenticationRequired: false,
              opensAppToForeground: false, // fires in background
            },
          },
        ]);

        // 3. Cancel any previously scheduled SOS notification, then schedule persistent one
        await Notifications.cancelAllScheduledNotificationsAsync();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🛡️ MaiHoonNa Emergency Ready',
            body: 'Tap "Send Emergency SOS" to instantly alert your care team.',
            categoryIdentifier: SOS_CATEGORY,
            // sticky/persistent behavior is enforced by the MAX-importance Android channel
            ...(Platform.OS === 'android' ? { channelId: SOS_CHANNEL } : {}),
            data: { type: 'SOS_BACKGROUND' },
          },
          trigger: null, // deliver immediately
        });

        // 4. Listen for notification action responses (fires even when app is background)
        responseSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
          const actionId = response.actionIdentifier;
          const data = response.notification.request.content.data;
          if (actionId === 'SOS_TRIGGER' && data?.type === 'SOS_BACKGROUND') {
            console.log('[SOS] Background SOS triggered from notification action');
            try {
              await triggerEmergencyAlert('SOS Emergency triggered via background notification action');
            } catch (err) {
              console.error('[SOS] Background trigger failed:', err);
            }
          }
        });
      } catch (err) {
        console.warn('[SOS] Failed to set up persistent SOS notification:', err);
      }
    };

    setupSosNotification();

    // Cleanup: remove SOS notification on logout
    return () => {
      responseSub?.remove();
      Notifications.cancelAllScheduledNotificationsAsync().catch(() => { });
    };
  }, [isLoggedIn, role]);

  console.log('RootNavigator Render:', { isLoading, isLoggedIn, role });
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
      {!isLoggedIn ? (
        <Stack.Screen name="(auth)" />
      ) : (
        <Stack.Screen name="(subscriber)" options={{ gestureEnabled: false }} />
      )}
      {isLoggedIn ? (
        <Stack.Screen name="(beneficiary)" options={{ gestureEnabled: false }} />
      ) : null}
      {isLoggedIn ? (
        <Stack.Screen name="(care-companion)" options={{ gestureEnabled: false }} />
      ) : null}
      <Stack.Screen name="(setup)" />
      {isLoggedIn ? (
        <Stack.Screen name="package-utilization" />
      ) : null}
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

  console.log('RootLayout Render:', { fontsLoaded, error });
  if (!fontsLoaded && !error) return null;

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister }}>
      <ErrorBoundary>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <SafeAreaProvider>
            <CustomAlertProvider>
              <GlobalApiInterceptor>
                <AuthProvider>
                  <NavigationStackProvider>
                    <RootNavigator />
                  </NavigationStackProvider>
                </AuthProvider>
                <StatusBar style="auto" />
              </GlobalApiInterceptor>
            </CustomAlertProvider>
          </SafeAreaProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </PersistQueryClientProvider>
  );
}
