import { Stack } from 'expo-router';

export default function CareCompanionLayout() {
    return (
        <Stack>
            {/*
              gestureEnabled: false on the root 'index' screen prevents the iOS swipe-back
              gesture from exiting the care companion section. The auth guard is handled
              at the root layout level — not per-screen.
            */}
            <Stack.Screen name="index" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="schedule" options={{ headerShown: false }} />
            <Stack.Screen name="history" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen name="privacy-security" options={{ headerShown: false }} />
            <Stack.Screen name="settings/change-password" options={{ headerShown: false }} />
            <Stack.Screen name="visit-details" options={{ headerShown: false }} />
        </Stack>
    );
}
