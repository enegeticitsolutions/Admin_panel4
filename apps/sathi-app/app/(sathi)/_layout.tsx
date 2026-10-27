import { Stack } from 'expo-router';
import { useSathiLiveLocation } from '@/hooks/useSathiLiveLocation';

export default function SathiLayout() {
  useSathiLiveLocation();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="apply" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="match" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="hours" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="guide" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
    </Stack>
  );
}
