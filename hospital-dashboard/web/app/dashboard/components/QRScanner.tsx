'use client'
import { useState, type FormEvent } from 'react'
import { api } from '@/lib/api'

interface Props {
  onSession: (sessionToken: string) => void
}

export default function QRScanner({ onSession }: Props) {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = token.trim()
    if (!trimmed) return
    if (trimmed.length > 500) {
      setError('Invalid token format — token is too long')
      return
    }
    // UUID format validation: 8-4-4-4-12 hex characters
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      setError('Invalid QR code format')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await api.resolveQR(token.trim())
      onSession(data.sessionToken)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired QR code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col items-center gap-3">
        <svg className="w-12 h-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        <p className="text-xs text-gray-400 text-center">
          Ask the patient to show their QR code from the Nuralix app, then paste the token below
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste QR token here..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
        {error && (
          <p className="text-red-400 text-xs">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading || !token.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition"
        >
          {loading ? 'Resolving...' : 'Resolve QR Code'}
        </button>
      </form>
    </div>
  )
}
