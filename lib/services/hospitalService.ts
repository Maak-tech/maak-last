import * as SecureStore from 'expo-secure-store'

const HOSPITAL_API_URL =
  process.env.EXPO_PUBLIC_HOSPITAL_API_URL ?? 'http://localhost:3001'

async function getPatientToken(): Promise<string | null> {
  // Use the better-auth session token for patient requests
  return SecureStore.getItemAsync('maak_session_token') // key used by better-auth expo client
}

async function hospitalFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getPatientToken()
  const res = await fetch(HOSPITAL_API_URL + path, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`Hospital API error: ${res.status}`)
  return res.json() as Promise<T>
}

export const hospitalService = {
  enrollFace: async (
    imageBase64: string,
    patientId: string
  ): Promise<{ enrolled: boolean }> => {
    const formData = new FormData()
    formData.append('patientId', patientId)
    formData.append('consentGiven', 'true')
    // React Native FormData accepts uri/type/name blobs
    const blob = {
      uri: `data:image/jpeg;base64,${imageBase64}`,
      type: 'image/jpeg',
      name: 'face.jpg',
    } as unknown as Blob
    formData.append('image', blob)

    const token = await getPatientToken()
    const res = await fetch(HOSPITAL_API_URL + '/enroll', {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    })
    if (!res.ok) throw new Error('Enrollment failed')
    return res.json() as Promise<{ enrolled: boolean }>
  },

  revokeEnrollment: (patientId: string) =>
    hospitalFetch<{ revoked: boolean }>(`/enroll/${patientId}`, {
      method: 'DELETE',
    }),

  getEnrollmentStatus: (patientId: string) =>
    hospitalFetch<{ enrolled: boolean; enrolledAt: string | null }>(
      `/enroll/${patientId}/status`
    ),

  generateQR: async (patientId: string): Promise<{ token: string; expiresAt: string }> => {
    const token = await getPatientToken()
    const res = await fetch(HOSPITAL_API_URL + `/patient/qr/${patientId}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    if (!res.ok) throw new Error('QR generation failed')
    return res.json() as Promise<{ token: string; expiresAt: string }>
  },
}
