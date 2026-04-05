'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, getToken, type StaffInfo } from '@/lib/api'
import { useAutoLogout } from '@/lib/useAutoLogout'

type Step = 'search' | 'capture' | 'consent' | 'submitting' | 'done' | 'error'

interface Patient { id: string; name: string }

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function EnrollPage() {
  useAutoLogout()  // HIPAA §164.312(a)(1): auto-logout after 15 minutes of inactivity
  const router = useRouter()
  const [step, setStep] = useState<Step>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [consentChecked, setConsentChecked] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [staff, setStaff] = useState<StaffInfo | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('hospital_staff')
    if (stored) {
      try { setStaff(JSON.parse(stored) as StaffInfo) } catch (err: unknown) { console.warn('[enroll] Failed to parse staff info:', err) }
    }
    if (!getToken()) router.push('/login')
  }, [router])

  // Start camera when on capture step
  useEffect(() => {
    if (step !== 'capture') return
    let stream: MediaStream | null = null
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } } })
      .then((s) => {
        stream = s
        streamRef.current = s
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch(() => setCameraError('Camera access denied'))
    return () => {
      stream?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [step])

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    setErrorMsg(null)
    try {
      const data = await api.manualSearch(searchQuery)
      setSearchResults(data.results)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Patient search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  // Revoke blob URL when it's replaced or on unmount — prevents memory leak
  useEffect(() => {
    return () => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    }
  }, [capturedUrl])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const v = videoRef.current
    const c = canvasRef.current
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')?.drawImage(v, 0, 0)
    c.toBlob((blob) => {
      if (!blob) return
      setCapturedBlob(blob)
      setCapturedUrl(URL.createObjectURL(blob))
      // Stop camera stream after capture
      streamRef.current?.getTracks().forEach((t) => t.stop())
      setStep('consent')
    }, 'image/jpeg', 0.9)
  }, [])

  async function handleSubmit() {
    if (!selectedPatient || !capturedBlob || !consentChecked) return
    setStep('submitting')
    setErrorMsg(null)
    try {
      const token = getToken()
      const formData = new FormData()
      formData.append('patientId', selectedPatient.id)
      formData.append('consentGiven', 'true')
      formData.append('image', capturedBlob, 'face.jpg')
      const res = await fetch(`${API_URL}/enroll`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
        signal: AbortSignal.timeout(30_000), // 30 s — image upload + CompreFace round-trip
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Enrollment failed' }))
        throw new Error((err as { error?: string }).error ?? 'Enrollment failed')
      }
      setStep('done')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Enrollment failed')
      setStep('error')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-sm font-semibold text-white">Biometric Enrollment</h1>
        {staff && <span className="text-xs text-gray-400 ml-auto">{staff.name}</span>}
      </header>

      <main className="flex-1 flex items-start justify-center p-6">
        <div className="w-full max-w-md space-y-6">

          {/* Step 1: Search patient */}
          {step === 'search' && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-bold text-white">Step 1: Find Patient</h2>
                <p className="text-sm text-gray-400 mt-1">Search for the patient to enroll</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Patient name..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
                >
                  {searching ? '...' : 'Search'}
                </button>
              </div>
              {errorMsg && (
                <p className="text-red-400 text-sm">{errorMsg}</p>
              )}
              {searchResults.length > 0 && (
                <ul className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-700">
                  {searchResults.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => { setSelectedPatient(p); setStep('capture') }}
                        className="w-full text-left px-4 py-3.5 text-sm text-white hover:bg-gray-700 transition flex items-center justify-between"
                      >
                        <span>{p.name}</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Step 2: Capture photo */}
          {step === 'capture' && selectedPatient && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-bold text-white">Step 2: Capture Face</h2>
                <p className="text-sm text-gray-400 mt-1">Enrolling: <span className="text-blue-400">{selectedPatient.name}</span></p>
              </div>
              {cameraError ? (
                <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 text-red-300 text-sm text-center">
                  {cameraError}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-black border border-gray-700">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-56 object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-32 h-40 rounded-full border-2 border-blue-400 border-dashed opacity-60" />
                    </div>
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <button
                    onClick={capturePhoto}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Take Photo
                  </button>
                </div>
              )}
              <button onClick={() => { setStep('search'); setErrorMsg(null) }} className="w-full text-gray-400 hover:text-white text-sm transition py-2">
                Back
              </button>
            </div>
          )}

          {/* Step 3: Consent + Submit */}
          {step === 'consent' && selectedPatient && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-bold text-white">Step 3: Confirm Consent</h2>
                <p className="text-sm text-gray-400 mt-1">Review captured photo and confirm consent</p>
              </div>
              {capturedUrl && (
                <div className="rounded-xl overflow-hidden border border-gray-700">
                  <img src={capturedUrl} alt="Captured face" className="w-full h-48 object-cover" />
                </div>
              )}
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">
                <p className="text-sm text-gray-300">
                  Patient: <span className="text-white font-medium">{selectedPatient.name}</span>
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-300 leading-relaxed">
                    I confirm that the patient has provided explicit written consent for biometric enrollment and understands that their facial data will be used solely for identity verification within this healthcare facility.
                  </span>
                </label>
              </div>
              <button
                onClick={handleSubmit}
                disabled={!consentChecked}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
              >
                Enroll Patient
              </button>
              <button onClick={() => setStep('capture')} className="w-full text-gray-400 hover:text-white text-sm transition py-2">
                Retake Photo
              </button>
            </div>
          )}

          {/* Submitting */}
          {step === 'submitting' && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <svg className="w-10 h-10 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-gray-400 text-sm">Enrolling biometrics...</p>
            </div>
          )}

          {/* Done */}
          {step === 'done' && selectedPatient && (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 bg-green-900/40 border border-green-700 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Enrollment Complete</h2>
                <p className="text-sm text-gray-400 mt-1">{selectedPatient.name} has been successfully enrolled.</p>
              </div>
              <button
                onClick={() => { setStep('search'); setSelectedPatient(null); setSearchQuery(''); setSearchResults([]); setCapturedBlob(null); setCapturedUrl(null); setConsentChecked(false); setErrorMsg(null) }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition"
              >
                Enroll Another Patient
              </button>
              <button onClick={() => router.push('/dashboard')} className="w-full text-gray-400 hover:text-white text-sm transition py-2">
                Back to Dashboard
              </button>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 bg-red-900/40 border border-red-700 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Enrollment Failed</h2>
                <p className="text-sm text-red-400 mt-1">{errorMsg}</p>
              </div>
              <button
                onClick={() => setStep('consent')}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
