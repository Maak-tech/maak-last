import { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { useAuth } from '@/contexts/AuthContext'
import { hospitalService } from '@/lib/services/hospitalService'

type Step = 'consent' | 'camera' | 'uploading' | 'success' | 'error'

export default function EnrollScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('consent')
  const [consentGiven, setConsentGiven] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)

  async function handleCapture() {
    if (!cameraRef.current || !user?.id) return
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      })
      if (!photo?.base64) throw new Error('Failed to capture photo')
      setStep('uploading')
      await hospitalService.enrollFace(photo.base64, user.id)
      setStep('success')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Enrollment failed')
      setStep('error')
    }
  }

  async function handleRequestPermission() {
    try {
      const result = await requestPermission()
      if (result.granted) {
        setStep('camera')
      } else {
        setErrorMsg('Camera permission is required to enroll. Please enable it in your device settings and try again.')
        setStep('error')
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to request camera permission')
      setStep('error')
    }
  }

  // Step 1: Consent
  if (step === 'consent') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Biometric Consent</Text>

        <View style={styles.consentCard}>
          <Text style={styles.consentHeading}>Before enrolling your face, please read:</Text>
          <View style={styles.consentPoints}>
            {[
              'Only a mathematical representation of your face (embedding) is stored — your actual photo is never saved.',
              'Hospital staff can use facial recognition to identify you during visits.',
              'You can revoke enrollment at any time from this screen.',
              'Your biometric data will NOT be shared with third parties.',
              'Data is used solely for identity verification within this healthcare facility.',
            ].map((point, i) => (
              <View key={i} style={styles.consentPoint}>
                <Text style={styles.consentBullet}>•</Text>
                <Text style={styles.consentPointText}>{point}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setConsentGiven((v) => !v)}
        >
          <View style={[styles.checkbox, consentGiven && styles.checkboxChecked]}>
            {consentGiven && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            I understand and consent to biometric enrollment
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, !consentGiven && styles.buttonDisabled]}
          disabled={!consentGiven}
          onPress={() => {
            if (!permission?.granted) {
              handleRequestPermission()
            } else {
              setStep('camera')
            }
          }}
        >
          <Text style={styles.primaryButtonText}>Continue to Camera</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  // Step 2: Camera
  if (step === 'camera') {
    if (!permission?.granted) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Camera permission is required for face enrollment.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleRequestPermission}>
            <Text style={styles.primaryButtonText}>Grant Camera Permission</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="front">
          <View style={styles.cameraOverlay}>
            <View style={styles.faceGuide} />
            <Text style={styles.cameraHint}>Position your face in the oval</Text>
          </View>
        </CameraView>
        <View style={styles.cameraActions}>
          <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Step 3: Uploading
  if (step === 'uploading') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Enrolling biometrics...</Text>
        <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
      </View>
    )
  }

  // Step 4: Success
  if (step === 'success') {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </View>
        <Text style={styles.title}>Enrollment Complete</Text>
        <Text style={styles.successSubtext}>
          Your face has been enrolled. Hospital staff can now identify you using facial recognition.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Step 5: Error
  return (
    <View style={styles.centerContainer}>
      <View style={styles.errorIcon}>
        <Text style={styles.errorIconText}>✕</Text>
      </View>
      <Text style={styles.title}>Enrollment Failed</Text>
      <Text style={styles.errorDetailText}>{errorMsg}</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('camera')}>
        <Text style={styles.primaryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  contentContainer: { padding: 20 },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  faceGuide: {
    width: 160,
    height: 200,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
  },
  cameraHint: {
    color: '#93c5fd',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cameraActions: {
    backgroundColor: '#000',
    paddingVertical: 32,
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  consentCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  consentHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 12,
  },
  consentPoints: { gap: 8 },
  consentPoint: { flexDirection: 'row', gap: 8 },
  consentBullet: { color: '#3b82f6', fontSize: 14 },
  consentPointText: { flex: 1, fontSize: 13, color: '#9ca3af', lineHeight: 18 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#6b7280',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
  },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  checkboxLabel: { flex: 1, fontSize: 13, color: '#e5e7eb', lineHeight: 18 },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '100%',
  },
  buttonDisabled: { backgroundColor: '#1f2937', opacity: 0.5 },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  loadingText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  loadingSubtext: { color: '#6b7280', fontSize: 13 },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#14532d',
    borderWidth: 1,
    borderColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconText: { color: '#22c55e', fontSize: 28, fontWeight: 'bold' },
  successSubtext: { color: '#6b7280', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#450a0a',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIconText: { color: '#ef4444', fontSize: 28, fontWeight: 'bold' },
  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center' },
  errorDetailText: { color: '#f87171', fontSize: 13, textAlign: 'center', lineHeight: 18 },
})
