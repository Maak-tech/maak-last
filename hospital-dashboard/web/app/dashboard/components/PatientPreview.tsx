'use client'
import { useState } from 'react'
import { api, type PreviewData } from '@/lib/api'

interface Props {
  sessionToken: string
  preview: PreviewData
  onConfirmed: () => void
}

const riskConfig = {
  low: { label: 'Low Risk', bg: 'bg-green-900/40', border: 'border-green-700', text: 'text-green-400', dot: 'bg-green-400' },
  moderate: { label: 'Moderate Risk', bg: 'bg-yellow-900/40', border: 'border-yellow-700', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  high: { label: 'High Risk', bg: 'bg-orange-900/40', border: 'border-orange-700', text: 'text-orange-400', dot: 'bg-orange-400' },
  critical: { label: 'Critical', bg: 'bg-red-900/40', border: 'border-red-700', text: 'text-red-400', dot: 'bg-red-400' },
  unknown: { label: 'Unknown', bg: 'bg-gray-800', border: 'border-gray-700', text: 'text-gray-400', dot: 'bg-gray-400' },
}

export default function PatientPreview({ sessionToken, preview, onConfirmed }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const risk = riskConfig[preview.riskLevel as keyof typeof riskConfig] ?? riskConfig.unknown

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      await api.confirmIdentity(sessionToken)
      onConfirmed()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Confirmation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Patient</p>
            <h2 className="text-xl font-bold text-white">{preview.name}</h2>
            <p className="text-sm text-gray-400 mt-0.5">DOB: {preview.maskedDob}</p>
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${risk.bg} border ${risk.border}`}>
            <span className={`text-lg font-bold ${risk.text}`}>
              {preview.riskScore ?? '?'}
            </span>
          </div>
        </div>

        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${risk.bg} ${risk.border}`}>
          <span className={`w-2 h-2 rounded-full ${risk.dot} animate-pulse`} />
          <span className={`text-sm font-medium ${risk.text}`}>{risk.label}</span>
          {preview.riskScore !== null && (
            <span className="text-xs text-gray-400 ml-auto">Score: {preview.riskScore}/100</span>
          )}
        </div>
      </div>

      {!preview.confirmed ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 text-center">
            Verify this is the correct patient before accessing health data
          </p>
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 text-base"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {loading ? 'Confirming...' : 'Confirm Identity'}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-green-400 justify-center text-sm font-medium">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Identity Confirmed
        </div>
      )}
    </div>
  )
}
