import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="medical-history" options={{ headerShown: false }} />
      <Stack.Screen name="personal-info" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" options={{ headerShown: false }} />
      <Stack.Screen name="health-integrations" options={{ headerShown: false }} />
      <Stack.Screen name="notification-settings" options={{ headerShown: false }} />
      <Stack.Screen name="fall-detection" options={{ headerShown: false }} />
      <Stack.Screen name="motion-permissions" options={{ headerShown: false }} />
      <Stack.Screen name="help-support" options={{ headerShown: false }} />
      <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
      <Stack.Screen name="terms-conditions" options={{ headerShown: false }} />
      <Stack.Screen name="health/apple-intro" options={{ headerShown: false }} />
      <Stack.Screen name="health/apple-permissions" options={{ headerShown: false }} />
      <Stack.Screen name="health/apple-connected" options={{ headerShown: false }} />
      <Stack.Screen name="health/fitbit-intro" options={{ headerShown: false }} />
      <Stack.Screen name="health/fitbit-permissions" options={{ headerShown: false }} />
    </Stack>
  );
}

