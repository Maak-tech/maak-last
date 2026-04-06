import { Linking } from 'react-native'
import { router } from 'expo-router'

const ROUTE_MAP: Record<string, string> = {
  emergency: '/emergency',
  vitals: '/(tabs)/vitals',
  medications: '/(tabs)/medications',
  symptoms: '/(tabs)/symptoms',
  family: '/(tabs)/family',
  nora: '/(tabs)/nora',
  calendar: '/(tabs)/calendar',
  profile: '/(tabs)/profile',
}

/**
 * Parses an incoming deep link URL and navigates to the appropriate screen.
 * Supports:
 *   maak://emergency
 *   maak://vitals
 *   maak://family/join?code=ABC123
 *   maak://medications
 *   https://maakhealth.com/join?code=ABC123  (universal links)
 */
export function handleDeepLink(url: string): void {
  if (!url) return

  try {
    // Normalize: handle both maak:// and https:// schemes
    let path: string
    let params: URLSearchParams

    if (url.startsWith('maak://')) {
      const withoutScheme = url.replace('maak://', '')
      const [pathPart, queryPart] = withoutScheme.split('?')
      path = pathPart ?? ''
      params = new URLSearchParams(queryPart ?? '')
    } else {
      const parsed = new URL(url)
      path = parsed.pathname.replace(/^\//, '')
      params = parsed.searchParams
    }

    // Family join with invite code
    if (path === 'family/join' || path === 'join') {
      const code = params.get('code')
      if (code) {
        router.push({ pathname: '/join', params: { code } })
        return
      }
    }

    // Direct route mappings
    const route = ROUTE_MAP[path]
    if (route) {
      router.push(route as any)
      return
    }

    // Fallback: log unknown deep link
    console.warn('[DeepLink] Unknown path:', path)
  } catch (err) {
    console.warn('[DeepLink] Failed to parse URL:', url, err)
  }
}

/**
 * Initialize deep link listeners. Call once from app root.
 * Returns a cleanup function.
 */
export function initDeepLinks(): () => void {
  // Handle links when app is already open
  const subscription = Linking.addEventListener('url', ({ url }) => {
    handleDeepLink(url)
  })

  // Handle link that launched the app from killed state
  Linking.getInitialURL().then((url) => {
    if (url) handleDeepLink(url)
  }).catch(() => {})

  return () => subscription.remove()
}
