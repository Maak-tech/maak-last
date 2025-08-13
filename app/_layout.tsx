import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/contexts/AuthContext';
import { FallDetectionProvider } from '@/contexts/FallDetectionContext';
import * as Notifications from 'expo-notifications';
import '@/lib/i18n';

// Configure how notifications should be displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    // Request notification permissions on app start
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
      } else {
        console.log('Notification permissions granted');
      }
    };
    
    requestPermissions();
  }, []);
  return (
    <AuthProvider>
      <FallDetectionProvider>
        <StatusBar style="auto" />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen
            name="debug-notifications"
            options={{ title: 'Debug Notifications' }}
          />
          <Stack.Screen name="+not-found" />
        </Stack>
      </FallDetectionProvider>
    </AuthProvider>
  );
}
