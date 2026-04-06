'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, getToken, type AuditLog } from '@/lib/api'
import { useAutoLogout } from '@/lib/useAutoLogout'

type FilterOption = {
  label: string
  action: string | undefined
}

const FILTERS: FilterOption[] = [
  { label: 'All',               action: undefined },
  { label: 'Near-miss only',    action: 'near_miss_recognition' },
  { label: 'Confirmed access',  action: 'identity_confirmed' },
  { label: 'Failed attempts',   action: 'login_failed' },
]

export default function AuditPage() {
  const router = useRouter()
  useAutoLogout()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterOption>(FILTERS[0])

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return }
    // Check role — redirect to dashboard if not admin or if parse fails.
    // A parse failure must also redirect: without a valid role we cannot
    // confirm admin access, so we must deny access rather than silently skip the check.
    const staffJson = sessionStorage.getItem('hospital_staff')
    try {
      const s = staffJson ? JSON.parse(staffJson) as { role: string } : null
      if (!s || s.role !== 'admin') { router.push('/dashboard'); return }
    } catch (err: unknown) {
      console.warn('[audit] Failed to parse staff info for role check — denying access:', err instanceof Error ? err.message : String(err))
      router.push('/dashboard')
    }
  }, [router])

  const fetchLogs = useCallback(async (p: number, filter: FilterOption) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getAuditLogs(p, filter.action)
      setLogs(data.logs)
      setHasMore(data.logs.length === data.limit)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLogs(page, activeFilter) }, [page, activeFilter, fetchLogs])

  function handleFilterChange(filter: FilterOption) {
    setActiveFilter(filter)
    setPage(1)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString()
  }

  function actionLabel(action: string) {
    const map: Record<string, string> = {
      login_success:            'Login',
      login_failed:             'Login Failed',
      recognition_attempt:      'Recognition',
      near_miss_recognition:    'Near-miss',
      patient_preview_viewed:   'Preview',
      identity_confirmed:       'Confirmed',
      full_twin_accessed:       'Twin Access',
      enrollment:               'Enrolled',
      revocation:               'Revoked',
    }
    return map[action] ?? action.replace(/_/g, ' ')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-sm font-semibold text-white">Audit Logs</h1>
        <span className="text-xs text-gray-400 ml-auto">Admin only — all access events are recorded</span>
      </header>

      <main className="flex-1 p-6">
        {/* Filter buttons: All | Near-miss only | Confirmed access | Failed attempts */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {FILTERS.map((filter) => {
            const isActive = activeFilter.action === filter.action
            return (
              <button
                key={filter.label}
                onClick={() => handleFilterChange(filter)}
                className={
                  isActive
                    ? 'px-3 py-1.5 rounded-full text-xs font-medium transition border ' +
                      (filter.action === 'near_miss_recognition'
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                        : 'bg-indigo-600 border-indigo-500 text-white')
                    : 'px-3 py-1.5 rounded-full text-xs font-medium transition border bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                }
              >
                {filter.label}
              </button>
            )
          })}
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm mb-4 flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              onClick={() => fetchLogs(page, activeFilter)}
              className="shrink-0 text-xs text-red-300 hover:text-white border border-red-600 hover:border-white rounded px-2 py-1 transition"
            >
              Retry
            </button>
          </div>
        )}

        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium uppercase tracking-wider">Staff</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium uppercase tracking-wider">Patient</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium uppercase tracking-wider">Method</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium uppercase tracking-wider">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      <svg className="w-6 h-6 animate-spin mx-auto" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">No audit logs found</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className={`hover:bg-gray-800/50 transition${log.action === 'near_miss_recognition' ? ' bg-amber-950/20' : ''}`}>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-3 text-xs text-white">{log.staff_name ?? <span className="text-gray-500">—</span>}</td>
                      <td className="px-4 py-3 text-xs text-white">{log.patient_name ?? <span className="text-gray-500">—</span>}</td>
                      <td className="px-4 py-3 text-xs font-medium">
                        <span className={log.action === 'near_miss_recognition' ? 'text-amber-400' : 'text-white'}>
                          {actionLabel(log.action)}
                        </span>
                        {log.action === 'near_miss_recognition' && log.confidence != null && (
                          <span className="ml-2 inline-flex items-center gap-1 bg-amber-900/40 border border-amber-700/60 text-amber-300 text-xs px-1.5 py-0.5 rounded">
                            conf: {log.confidence.toFixed(2)} ⚠️
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 capitalize">{log.method ?? '—'}</td>
                      <td className="px-4 py-3">
                        {log.success === null ? (
                          <span className="text-gray-500 text-xs">—</span>
                        ) : log.success ? (
                          <span className="text-xs bg-green-900/40 text-green-400 px-1.5 py-0.5 rounded border border-green-800">OK</span>
                        ) : (
                          <span className="text-xs bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded border border-red-800">Fail</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{log.ip_address ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="text-sm text-gray-400 hover:text-white disabled:text-gray-700 disabled:cursor-not-allowed transition px-3 py-1.5 rounded-lg hover:bg-gray-800"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore || loading}
            className="text-sm text-gray-400 hover:text-white disabled:text-gray-700 disabled:cursor-not-allowed transition px-3 py-1.5 rounded-lg hover:bg-gray-800"
          >
            Next
          </button>
        </div>
      </main>
    </div>
  )
}
