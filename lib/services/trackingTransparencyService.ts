import { Platform } from "react-native";

export async function initializeTrackingTransparency(): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    // Dynamically import to avoid crashing on Android or when package is absent
    const { requestTrackingPermissionsAsync } = await import(
      "expo-tracking-transparency"
    );
    await requestTrackingPermissionsAsync();
  } catch {
    // expo-tracking-transparency not installed or permission already determined
  }
}
