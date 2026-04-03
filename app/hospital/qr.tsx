import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { useAuth } from '@/contexts/AuthContext'
import { hospitalService } from '@/lib/services/hospitalService'

const QR_CACHE_KEY = 'hospital_qr_token_cache'
const QR_EXPIRY_BUFFER_MS = 5 * 60 * 1000 // Refresh 5 min before expiry

interface CachedQR {
  token: string
  expiresAt: string
}

function QRCodePlaceholder({ value }: { value: string }) {
  // Simple visual QR placeholder — use a real QR library in production
  // e.g. react-native-qrcode-svg
  return (
    <View style={qrStyles.container}>
      <View style={qrStyles.qrBox}>
        <Text style={qrStyles.qrToken} numberOfLines={3}>{value}</Text>
        <Text style={qrStyles.qrNote}>Install react-native-qrcode-svg to render QR image</Text>
      </View>
    </View>
  )
}

const qrStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  qrBox: {
    width: 200,
    height: 200,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  qrToken: {
    fontSize: 8,
    color: '#111827',
    fontFamily: 'monospace',
    textAlign: 'center',
    wordBreak: 'break-all',
  },
  qrNote: {
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
})

function useCountdown(expiresAt: string | null): string {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    if (!expiresAt) return
    function update() {
      const ms = new Date(expiresAt!).getTime() - Date.now()
      if (ms <= 0) { setRemaining('Expired'); return }
      const h = Math.floor(ms / 3_600_000)
      const m = Math.floor((ms % 3_600_000) / 60_000)
      const s = Math.floor((ms % 60_000) / 1_000)
      setRemaining(h > 0 ? `${h}h ${m}m remaining` : `${m}m ${s}s remaining`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  return remaining
}

export default function QRScreen() {
  const { user } = useAuth()
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const countdown = useCountdown(expiresAt)

  const loadQR = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      // Check cached token first
      if (!forceRefresh) {
        const cached = await SecureStore.getItemAsync(QR_CACHE_KEY)
        if (cached) {
          const parsed: CachedQR = JSON.parse(cached)
          const expiresMs = new Date(parsed.expiresAt).getTime()
          if (expiresMs - Date.now() > QR_EXPIRY_BUFFER_MS) {
            setQrToken(parsed.token)
            setExpiresAt(parsed.expiresAt)
            setLoading(false)
            return
          }
        }
      }
      // Generate new token
      const data = await hospitalService.generateQR(user.id)
      setQrToken(data.token)
      setExpiresAt(data.expiresAt)
      await SecureStore.setItemAsync(QR_CACHE_KEY, JSON.stringify({ token: data.token, expiresAt: data.expiresAt }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate QR code')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { loadQR() }, [loadQR])

  // Auto-refresh when expired
  useEffect(() => {
    if (!expiresAt) return
    const ms = new Date(expiresAt).getTime() - Date.now() - QR_EXPIRY_BUFFER_MS
    if (ms <= 0) { loadQR(true); return }
    const id = setTimeout(() => loadQR(true), ms)
    return () => clearTimeout(id)
  }, [expiresAt, loadQR])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My QR Code</Text>
      <Text style={styles.subtitle}>Show this to hospital staff to pull up your records</Text>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Generating QR code...</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadQR(true)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && qrToken && (
        <View style={styles.qrContainer}>
          <View style={styles.qrWrapper}>
            <QRCodePlaceholder value={qrToken} />
          </View>

          <View style={styles.expiryBadge}>
            <View style={styles.expiryDot} />
            <Text style={styles.expiryText}>{countdown}</Text>
          </View>

          <View style={styles.tokenPreview}>
            <Text style={styles.tokenLabel}>Token</Text>
            <Text style={styles.tokenValue} numberOfLines={1}>{qrToken.slice(0, 8)}...{qrToken.slice(-8)}</Text>
          </View>
        </View>
      )}

      {!loading && (
        <TouchableOpacity style={styles.refreshButton} onPress={() => loadQR(true)}>
          <Text style={styles.refreshButtonText}>Generate New QR Code</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.note}>
        This QR code expires after 2 hours and can only be used once. A new code will be generated automatically.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 32,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 12,
    marginTop: 40,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 14,
  },
  errorCard: {
    backgroundColor: '#450a0a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    width: '100%',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#1f2937',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1f2937',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#374151',
  },
  expiryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  expiryText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
  },
  tokenPreview: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  tokenLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tokenValue: {
    fontSize: 11,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  refreshButton: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 16,
  },
  refreshButtonText: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '600',
  },
  note: {
    fontSize: 11,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
  },
})
