const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Token storage ─────────────────────────────────────────────────────────────
// The JWT is kept in a module-level variable (in-memory) instead of
// sessionStorage. sessionStorage is readable by any script on the same origin,
// so an XSS attack can steal a sessionStorage token trivially. An in-memory
// variable has the same tab-scoped lifecycle (cleared on tab/navigation away)
// but is invisible to injected scripts.
//
// For an even stronger posture, upgrade to httpOnly cookies: have the server
// set `Set-Cookie: hospital_token=...; HttpOnly; Secure; SameSite=Strict` on
// login, configure the Hono CORS middleware with `credentials: true`, and use
// `credentials: 'include'` in fetch calls below.
//
// All token access is funnelled through getToken/setToken/clearToken so that
// switching storage strategy is a single-file change.
// ─────────────────────────────────────────────────────────────────────────────
let _token: string | null = null

// One-time migration: if a previous build stored the token in sessionStorage,
// pull it into memory and erase the persistent copy immediately.
if (typeof window !== 'undefined') {
  const legacy = sessionStorage.getItem('hospital_token')
  if (legacy) {
    _token = legacy
    sessionStorage.removeItem('hospital_token')
  }
}

export function getToken(): string | null {
  return _token
}

export function setToken(token: string) {
  _token = token
  // Keep last-active timestamp in sessionStorage only (no PHI, no token).
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('hospital_last_active', Date.now().toString())
  }
}

export function clearToken() {
  _token = null
  // Belt-and-suspenders: also remove any legacy sessionStorage copy.
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('hospital_token')
  }
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

  getTwinBySession: (sessionToken: string) =>
    apiFetch<TwinData>(`/patient/by-session/${sessionToken}`),

  getAuditLogs: (page = 1) =>
    apiFetch<{ logs: AuditLog[]; page: number; limit: number }>(
      `/audit?page=${page}`
    ),
}

export interface AuditLog {
  id: string
  staff_name: string | null
  patient_name: string | null
  action: string
  method: string | null
  success: boolean | null
  confidence: number | null
  ip_address: string | null
  created_at: string
}
