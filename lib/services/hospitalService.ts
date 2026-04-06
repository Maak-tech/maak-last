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
    signal: options?.signal ?? AbortSignal.timeout(15_000),
    headers: {
      ...(options?.headers ?? {}),
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    // Parse response body for a more descriptive error message.
    let detail = ''
    try {
      const body = await res.json() as { error?: string; message?: string }
      detail = body.error ?? body.message ?? ''
    } catch { /* ignore parse failure */ }
    throw new Error(`Hospital API error ${res.status}${detail ? `: ${detail}` : ''}`)
  }
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
    // /enroll/self validates the patient's better-auth session against the main Nuralix API.
    // /enroll (staff-only) is separate and requires a hospital staff JWT.
    const res = await fetch(HOSPITAL_API_URL + '/enroll/self', {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
      signal: AbortSignal.timeout(30_000), // 30 s — image upload + CompreFace round-trip
    })
    if (!res.ok) {
      let detail = ''
      try {
        const body = await res.json() as { error?: string; message?: string }
        detail = body.error ?? body.message ?? ''
      } catch { /* ignore parse failure */ }
      throw new Error(`Enrollment failed${detail ? `: ${detail}` : ''}`)
    }
    return res.json() as Promise<{ enrolled: boolean }>
  },

  revokeEnrollment: (patientId: string) =>
    hospitalFetch<{ revoked: boolean }>(`/enroll/${patientId}`, {
      method: 'DELETE',
    }),

  // Patient self-service: checks own enrollment status using the patient session token.
  // Uses /enroll/self/status — the staff-only /enroll/:id/status requires a hospital JWT
  // and is therefore not callable from the patient app.
  getEnrollmentStatus: (_patientId: string) =>
    hospitalFetch<{ enrolled: boolean; enrolledAt: string | null }>(
      '/enroll/self/status'
    ),

  generateQR: async (_patientId: string): Promise<{ token: string; expiresAt: string }> => {
    // /patient/qr/generate validates the patient's better-auth session against the
    // main Nuralix API to identify the patient — patientId param is not needed.
    const token = await getPatientToken()
    const res = await fetch(HOSPITAL_API_URL + '/patient/qr/generate', {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      let detail = ''
      try {
        const body = await res.json() as { error?: string; message?: string }
        detail = body.error ?? body.message ?? ''
      } catch { /* ignore parse failure */ }
      throw new Error(`QR generation failed${detail ? `: ${detail}` : ''}`)
    }
    return res.json() as Promise<{ token: string; expiresAt: string }>
  },
}
