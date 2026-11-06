import { Stack } from 'expo-router';
import React from 'react';

export default function CommunityLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="events/[id]" />
      <Stack.Screen name="blogs/[id]" />
      <Stack.Screen name="podcasts/[id]" />
    </Stack>
  );
}

