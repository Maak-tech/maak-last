'use client'
import { useState } from 'react'
import { api } from '@/lib/api'

interface Props {
  sessionToken: string
  onConfirmed: () => void
}

export default function ConfirmStep({ sessionToken, onConfirmed }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      await api.confirmIdentity(sessionToken)
      onConfirmed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-4 py-3 text-yellow-300 text-sm">
        <strong>HIPAA Notice:</strong> Confirm that you have verified the patient&apos;s identity before accessing protected health information.
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {loading ? 'Confirming Identity...' : 'I Confirm This Is the Correct Patient'}
      </button>
    </div>
  )
}
