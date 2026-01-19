import { Stack } from "expo-router";

export default function FamilyLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="[memberId]"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
