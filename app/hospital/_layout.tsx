import { Stack } from 'expo-router'

export default function HospitalLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Hospital Features' }} />
      <Stack.Screen name="enroll" options={{ title: 'Face Enrollment' }} />
      <Stack.Screen name="qr" options={{ title: 'My QR Code' }} />
    </Stack>
  )
}
