import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import * as SecureStore from 'expo-secure-store'
import { useAuth } from '@/contexts/AuthContext'
import { hospitalService } from '@/lib/services/hospitalService'

const QR_CACHE_KEY = 'hospital_qr_token_cache'
const QR_EXPIRY_BUFFER_MS = 5 * 60 * 1000 // Refresh 5 min before expiry

interface CachedQR {
  token: string
  expiresAt: string
}

function useCountdown(expiresAt: string | null): string {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    if (!expiresAt) return
    function update() {
      const ms = new Date(expiresAt!).getTime() - Date.now()
      if (ms <= 0) {
        setRemaining('Expired')
        clearInterval(id)  // Stop ticking once expired — no point continuing
        return
      }
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
  const isExpired = countdown === 'Expired'

  const loadQR = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      // Check cached token first
      if (!forceRefresh) {
        const cached = await SecureStore.getItemAsync(QR_CACHE_KEY)
        if (cached) {
          // Guard against corrupted SecureStore data — a parse failure must not
          // crash the screen; fall through to generate a fresh token instead.
          let parsed: CachedQR | null = null
          try { parsed = JSON.parse(cached) as CachedQR } catch { /* corrupted cache — ignore */ }
          if (parsed?.token && parsed.expiresAt) {
            const expiresMs = new Date(parsed.expiresAt).getTime()
            if (expiresMs - Date.now() > QR_EXPIRY_BUFFER_MS) {
              setQrToken(parsed.token)
              setExpiresAt(parsed.expiresAt)
              setLoading(false)
              return
            }
          }
        }
      }
      // Generate new token
      const data = await hospitalService.generateQR(user.id)
      setQrToken(data.token)
      setExpiresAt(data.expiresAt)
      await SecureStore.setItemAsync(QR_CACHE_KEY, JSON.stringify({ token: data.token, expiresAt: data.expiresAt }))
    } catch (err: unknown) {
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
          {/* Dim the QR visually when expired so staff cannot scan a stale token */}
          <View style={[styles.qrWrapper, isExpired && styles.qrWrapperExpired]}>
            <QRCode
              value={qrToken}
              size={200}
              color="#111827"
              backgroundColor="#ffffff"
            />
            {isExpired && (
              <View style={styles.expiredOverlay}>
                <Text style={styles.expiredOverlayText}>Expired</Text>
                <Text style={styles.expiredOverlaySubtext}>Refreshing…</Text>
              </View>
            )}
          </View>

          <View style={styles.expiryBadge}>
            <View style={[styles.expiryDot, isExpired && styles.expiryDotExpired]} />
            <Text style={[styles.expiryText, isExpired && styles.expiryTextExpired]}>{countdown}</Text>
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
  qrWrapperExpired: {
    opacity: 0.4,
  },
  expiredOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  expiredOverlayText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
  },
  expiredOverlaySubtext: {
    color: '#9ca3af',
    fontSize: 12,
  },
  expiryDotExpired: {
    backgroundColor: '#ef4444',
  },
  expiryTextExpired: {
    color: '#ef4444',
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
