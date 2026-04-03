import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/contexts/AuthContext'
import { hospitalService } from '@/lib/services/hospitalService'

export default function HospitalIndex() {
  const router = useRouter()
  const { user } = useAuth()
  const [enrolled, setEnrolled] = useState<boolean | null>(null)
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    hospitalService.getEnrollmentStatus(user.id)
      .then((status) => {
        setEnrolled(status.enrolled)
        setEnrolledAt(status.enrolledAt)
      })
      .catch(() => setEnrolled(false))
      .finally(() => setLoading(false))
  }, [user?.id])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hospital Features</Text>
      <Text style={styles.subtitle}>Nuralix biometric identity services</Text>

      {/* Enrollment status */}
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Biometric Enrollment</Text>
        {loading ? (
          <ActivityIndicator color="#3b82f6" />
        ) : (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, enrolled ? styles.statusDotGreen : styles.statusDotGray]} />
            <Text style={[styles.statusText, enrolled ? styles.statusTextGreen : styles.statusTextGray]}>
              {enrolled ? 'Enrolled' : 'Not enrolled'}
            </Text>
            {enrolled && enrolledAt && (
              <Text style={styles.statusDate}>
                {new Date(enrolledAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Action buttons */}
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.push('/hospital/enroll' as any)}
      >
        <Text style={styles.primaryButtonText}>
          {enrolled ? 'Re-enroll Face' : 'Enroll My Face'}
        </Text>
        <Text style={styles.buttonSubtext}>Allow hospital staff to identify you</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push('/hospital/qr' as any)}
      >
        <Text style={styles.secondaryButtonText}>Show QR Code</Text>
        <Text style={styles.buttonSubtextDark}>Share with hospital staff to pull up your records</Text>
      </TouchableOpacity>

      <Text style={styles.privacyNote}>
        Your biometric data is encrypted and used only for identity verification at authorized healthcare facilities.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  statusCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  statusLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotGreen: {
    backgroundColor: '#22c55e',
  },
  statusDotGray: {
    backgroundColor: '#6b7280',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusTextGreen: {
    color: '#22c55e',
  },
  statusTextGray: {
    color: '#6b7280',
  },
  statusDate: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 'auto',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  secondaryButton: {
    backgroundColor: '#1f2937',
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#374151',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  buttonSubtext: {
    color: '#93c5fd',
    fontSize: 12,
  },
  buttonSubtextDark: {
    color: '#6b7280',
    fontSize: 12,
  },
  privacyNote: {
    fontSize: 11,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 16,
  },
})
