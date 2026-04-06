import { Platform } from 'react-native'

let attChecked = false
let attGranted = false

/**
 * Request App Tracking Transparency permission on iOS 14.5+.
 * Must be called before any analytics/tracking SDK initialization.
 * Safe to call multiple times — returns cached result after first call.
 */
export async function requestATTPermission(): Promise<boolean> {
  if (attChecked) return attGranted

  if (Platform.OS !== 'ios') {
    attChecked = true
    attGranted = true
    return true
  }

  try {
    const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency')
    const { status } = await requestTrackingPermissionsAsync()
    attChecked = true
    attGranted = status === 'granted'
    return attGranted
  } catch {
    // expo-tracking-transparency not available or ATT not required on this iOS version
    attChecked = true
    attGranted = true
    return true
  }
}

export function getATTStatus(): boolean {
  return attGranted
}
