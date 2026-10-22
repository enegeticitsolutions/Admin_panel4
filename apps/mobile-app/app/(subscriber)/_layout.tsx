import { Stack } from 'expo-router';
import React from 'react';

export default function SubscriberLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" options={{ gestureEnabled: true }} />
    </Stack>
  );
}
