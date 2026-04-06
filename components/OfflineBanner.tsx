import React, { useEffect, useRef, useState } from 'react'
import { Alert, Animated, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { offlineService, onQueueFull } from '@/lib/services/offlineService'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const translateY = useRef(new Animated.Value(-56)).current
  const insets = useSafeAreaInsets()
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'ar'

  useEffect(() => {
    // Subscribe to online/offline changes via the real public API
    const unsubscribe = offlineService.onNetworkStatusChange((online: boolean) => {
      setIsOffline(!online)
    })

    // Poll for pending queue count every 5 seconds
    const timer = setInterval(async () => {
      try {
        const queue = await offlineService.getOfflineQueue()
        setPendingCount(Array.isArray(queue) ? queue.length : 0)
      } catch {}
    }, 5000)

    return () => {
      unsubscribe()
      clearInterval(timer)
    }
  }, [])

  // Show an alert when the offline queue is full so the user knows data may be lost
  useEffect(() => {
    const unsubscribe = onQueueFull(() => {
      Alert.alert(
        isRTL ? 'تحذير: مساحة التخزين ممتلئة' : 'Storage Full',
        isRTL
          ? 'تعذّر حفظ بعض البيانات الصحية. يرجى الاتصال بالإنترنت لمزامنة البيانات.'
          : 'Some health data could not be saved offline. Please reconnect to sync your data.',
        [{ text: isRTL ? 'موافق' : 'OK' }],
      )
    })
    return unsubscribe
  }, [isRTL])

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isOffline ? 0 : -(56 + insets.top),
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
  }, [isOffline, insets.top, translateY])

  return (
    <Animated.View
      style={[
        styles.banner,
        { paddingTop: insets.top + 6, transform: [{ translateY }] },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={
        pendingCount > 0
          ? `No internet connection. ${pendingCount} changes waiting to sync.`
          : 'No internet connection'
      }
      pointerEvents="none"
    >
      <Text style={styles.text}>
        {pendingCount > 0
          ? `📡 Offline — ${pendingCount} change${pendingCount === 1 ? '' : 's'} will sync`
          : '📡 No internet connection'}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F59E0B',
    paddingBottom: 10,
    paddingHorizontal: 16,
    zIndex: 9999,
    alignItems: 'center',
    // Shadow for visibility
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
})
