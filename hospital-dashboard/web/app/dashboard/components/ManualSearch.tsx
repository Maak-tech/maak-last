'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { api } from '@/lib/api'

interface Props {
  onSession: (sessionToken: string) => void
}

interface SearchResult {
  id: string
  name: string
}

export default function ManualSearch({ onSession }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear pending debounce timer on unmount to prevent state updates on unmounted component.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const search = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim() || value.length < 2) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await api.manualSearch(value)
        setResults(data.results)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed')
      } finally {
        setLoading(false)
      }
    }, 350)
  }, [])

  async function selectPatient(patientId: string) {
    setSelecting(patientId)
    setError(null)
    try {
      const data = await api.selectPatient(patientId)
      onSession(data.sessionToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select patient')
    } finally {
      setSelecting(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            search(e.target.value)
          }}
          placeholder="Search by patient name..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {results.length > 0 && (
        <ul className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden divide-y divide-gray-700">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => selectPatient(r.id)}
                disabled={selecting !== null}
                className="w-full text-left px-4 py-3 text-sm text-white hover:bg-gray-700 transition flex items-center justify-between disabled:opacity-50"
              >
                <span>{r.name}</span>
                {selecting === r.id ? (
                  <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.length >= 2 && !loading && results.length === 0 && (
        <p className="text-gray-500 text-xs text-center py-2">No patients found matching &quot;{query}&quot;</p>
      )}
    </div>
  )
}
