'use client'
import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api, clearToken, type PreviewData, type TwinData } from '@/lib/api'
import CameraCapture from './components/CameraCapture'
import QRScanner from './components/QRScanner'
import ManualSearch from './components/ManualSearch'
import PatientPreview from './components/PatientPreview'
import DigitalTwinView from './components/DigitalTwinView'

type IdentifyTab = 'camera' | 'qr' | 'manual'
type DashboardState =
  | { phase: 'idle' }
  | { phase: 'preview'; sessionToken: string; preview: PreviewData }
  | { phase: 'loading_twin'; sessionToken: string; preview: PreviewData }
  | { phase: 'twin'; sessionToken: string; data: TwinData }

interface StaffInfo { id: string; name: string; role: string; email: string }

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function fetchTwinBySession(sessionToken: string): Promise<TwinData> {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('hospital_token') : null
  const res = await fetch(`${API_URL}/patient/by-session/${sessionToken}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? 'Failed to load twin')
  }
  return res.json() as Promise<TwinData>
}

export default function DashboardPage() {
  const router = useRouter()
  const [tab, setTab] = useState<IdentifyTab>('camera')
  const [state, setState] = useState<DashboardState>({ phase: 'idle' })
  const [identifyError, setIdentifyError] = useState<string | null>(null)
  const [identifyLoading, setIdentifyLoading] = useState(false)
  const [staff, setStaff] = useState<StaffInfo | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('hospital_staff')
    if (stored) {
      try {
        setStaff(JSON.parse(stored) as StaffInfo)
      } catch (err) {
        console.warn('[Dashboard] Failed to parse stored staff info — clearing session:', err)
        sessionStorage.removeItem('hospital_staff')
        router.push('/login')
      }
    }
  }, [router])

  const loadPreview = useCallback(async (sessionToken: string) => {
    setIdentifyLoading(true)
    setIdentifyError(null)
    try {
      const preview = await api.getPreview(sessionToken)
      setState({ phase: 'preview', sessionToken, preview })
    } catch (err) {
      setIdentifyError(err instanceof Error ? err.message : 'Failed to load patient preview')
    } finally {
      setIdentifyLoading(false)
    }
  }, [])

  const handleCameraCapture = useCallback(async (formData: FormData) => {
    setIdentifyLoading(true)
    setIdentifyError(null)
    try {
      const result = await api.recognize(formData)
      if (!result.matched || !result.sessionToken) {
        setIdentifyError(result.fallback ?? 'Face not recognized. Try QR or manual search.')
        setIdentifyLoading(false)
        return
      }
      await loadPreview(result.sessionToken)
    } catch (err) {
      setIdentifyError(err instanceof Error ? err.message : 'Recognition failed')
      setIdentifyLoading(false)
    }
  }, [loadPreview])

  const handleSession = useCallback(async (sessionToken: string) => {
    await loadPreview(sessionToken)
  }, [loadPreview])

  const handleConfirmed = useCallback(async () => {
    if (state.phase !== 'preview') return
    const { sessionToken, preview } = state
    setState({ phase: 'loading_twin', sessionToken, preview })
    setIdentifyError(null)
    try {
      const twinData = await fetchTwinBySession(sessionToken)
      setState({ phase: 'twin', sessionToken, data: twinData })
    } catch (err) {
      setIdentifyError(err instanceof Error ? err.message : 'Failed to load health data')
      setState({ phase: 'preview', sessionToken, preview: { ...preview, confirmed: true } })
    }
  }, [state])

  const reset = useCallback(() => {
    setState({ phase: 'idle' })
    setIdentifyError(null)
  }, [])

  async function handleLogout() {
    try {
      await api.logout()
    } catch (err) {
      // Logout API failure should not block the local session from being cleared
      console.warn('[Dashboard] Logout API call failed (clearing local session anyway):', err)
    }
    clearToken()
    sessionStorage.removeItem('hospital_staff')
    router.push('/login')
  }

  const isLoadingTwin = state.phase === 'loading_twin'

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top Nav */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <span className="font-bold text-white text-sm">Nuralix Hospital Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          {staff && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-white font-medium">{staff.name}</p>
              <p className="text-xs text-gray-400 capitalize">{staff.role}</p>
            </div>
          )}
          <div className="flex gap-2">
            {staff?.role === 'admin' && (
              <button
                onClick={() => router.push('/audit')}
                className="text-xs text-gray-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-gray-800"
              >
                Audit Logs
              </button>
            )}
            <button
              onClick={() => router.push('/enroll')}
              className="text-xs text-gray-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-gray-800"
            >
              Enroll
            </button>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-red-400 transition px-3 py-1.5 rounded-lg hover:bg-gray-800"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main 3-panel layout */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x md:divide-gray-800 overflow-auto">

        {/* Panel 1: Identify */}
        <div className="p-5 space-y-4 overflow-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Identify Patient</h2>
            {state.phase !== 'idle' && (
              <button onClick={reset} className="text-xs text-gray-400 hover:text-white transition">
                Reset
              </button>
            )}
          </div>

          {/* Tab selector */}
          <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
            {(['camera', 'qr', 'manual'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setIdentifyError(null) }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition capitalize ${
                  tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {t === 'camera' ? 'Camera' : t === 'qr' ? 'QR Code' : 'Search'}
              </button>
            ))}
          </div>

          {identifyError && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-xs">
              {identifyError}
            </div>
          )}

          {tab === 'camera' && (
            <CameraCapture onCapture={handleCameraCapture} loading={identifyLoading} />
          )}
          {tab === 'qr' && (
            <QRScanner onSession={handleSession} />
          )}
          {tab === 'manual' && (
            <ManualSearch onSession={handleSession} />
          )}
        </div>

        {/* Panel 2: Preview */}
        <div className="p-5 space-y-4 overflow-auto border-t md:border-t-0 border-gray-800">
          <h2 className="text-base font-semibold text-white">Patient Preview</h2>
          {state.phase === 'idle' && !identifyLoading && (
            <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
              <svg className="w-10 h-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-gray-500 text-sm">Scan a patient to begin</p>
            </div>
          )}
          {identifyLoading && (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <svg className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-gray-400 text-sm">Identifying...</p>
              </div>
            </div>
          )}
          {(state.phase === 'preview' || state.phase === 'loading_twin') && (
            <PatientPreview
              sessionToken={state.sessionToken}
              preview={state.preview}
              onConfirmed={handleConfirmed}
            />
          )}
          {state.phase === 'twin' && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{state.data.patient.name} — Identity Confirmed</span>
            </div>
          )}
        </div>

        {/* Panel 3: Digital Twin */}
        <div className="p-5 overflow-auto border-t md:border-t-0 border-gray-800">
          <h2 className="text-base font-semibold text-white mb-4">Digital Twin</h2>
          {(state.phase === 'idle' || state.phase === 'preview') && (
            <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
              <svg className="w-10 h-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-500 text-sm">Confirm identity to view health data</p>
            </div>
          )}
          {isLoadingTwin && (
            <div className="flex items-center justify-center h-32">
              <svg className="w-6 h-6 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
          {state.phase === 'twin' && <DigitalTwinView data={state.data} />}
        </div>
      </main>
    </div>
  )
}
