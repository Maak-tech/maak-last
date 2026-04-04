const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('hospital_token')
}

export function setToken(token: string) {
  sessionStorage.setItem('hospital_token', token)
  sessionStorage.setItem('hospital_last_active', Date.now().toString())
}

export function clearToken() {
  sessionStorage.removeItem('hospital_token')
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  // Merge caller-supplied signal with a 15-second timeout so no hospital API call
  // can hang indefinitely. AbortSignal.any() uses the first signal to fire.
  const timeoutSignal = AbortSignal.timeout(15_000)
  const signal = options?.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal
  const response = await fetch(API_URL + path, {
    ...options,
    signal,
    headers: {
      ...(options?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!response.ok) {
    // On 401 the session is expired or invalid — clear it and redirect to login
    if (response.status === 401 && typeof window !== 'undefined') {
      clearToken()
      window.location.href = '/login'
    }
    const err = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error((err as { error?: string }).error ?? 'Request failed')
  }
  return response.json() as Promise<T>
}

export type StaffInfo = { id: string; name: string; role: string; email: string }
export type PreviewData = {
  name: string
  maskedDob: string
  riskLevel: string
  riskScore: number | null
  confirmed: boolean
}
export type TwinData = {
  patient: {
    id: string
    name: string
    dateOfBirth: string
    bloodType: string | null
    emergencyContacts: Array<{ name: string; phone: string; relation: string }>
  }
  vhi: {
    risk_score: number
    risk_level: string
    summary_json: Record<string, unknown>
    computed_at: string
  } | null
  recentAlerts: Array<{
    id: string
    alert_type: string
    severity: string
    message: string
    created_at: string
  }>
  vitalsTrends: Array<{
    vital_type: string
    recorded_at: string
    value: number
    unit: string
  }>
  activeMedications: Array<{
    id: string
    name: string
    dosage: string
    frequency: string
    adherence: number
  }>
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; staff: StaffInfo }>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),

  logout: () => apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  recognize: (formData: FormData) =>
    apiFetch<{ matched: boolean; sessionToken?: string; fallback?: string }>('/recognize', {
      method: 'POST',
      body: formData,
    }),

  resolveQR: (token: string) =>
    apiFetch<{ sessionToken: string }>('/qr/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }),

  manualSearch: (name: string) =>
    apiFetch<{ results: Array<{ id: string; name: string }> }>('/recognize/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),

  selectPatient: (patientId: string) =>
    apiFetch<{ sessionToken: string }>('/recognize/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId }),
    }),

  getPreview: (sessionToken: string) =>
    apiFetch<PreviewData>(`/patient/preview/${sessionToken}`),

  confirmIdentity: (sessionToken: string) =>
    apiFetch<{ confirmed: boolean }>(`/patient/confirm/${sessionToken}`, { method: 'POST' }),

  // NOTE: Full twin data is fetched via /patient/by-session/:sessionToken (see fetchTwinBySession
  // in dashboard/page.tsx). The /patient/:patientId/twin endpoint exists server-side for callers
  // that already have a patientId, but the dashboard always uses the session-based route.

  getAuditLogs: (page = 1) =>
    apiFetch<{ logs: Array<Record<string, unknown>>; page: number; limit: number }>(
      `/audit?page=${page}`
    ),
}
