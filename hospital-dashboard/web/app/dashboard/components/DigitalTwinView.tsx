'use client'
import type { TwinData } from '@/lib/api'

interface Props {
  data: TwinData
}

const severityConfig = {
  critical: { bg: 'bg-red-900/40', border: 'border-red-700', text: 'text-red-300', badge: 'bg-red-800 text-red-200' },
  high: { bg: 'bg-orange-900/30', border: 'border-orange-700', text: 'text-orange-300', badge: 'bg-orange-800 text-orange-200' },
  medium: { bg: 'bg-yellow-900/30', border: 'border-yellow-700', text: 'text-yellow-300', badge: 'bg-yellow-800 text-yellow-200' },
  low: { bg: 'bg-blue-900/20', border: 'border-blue-800', text: 'text-blue-300', badge: 'bg-blue-900 text-blue-200' },
}

const riskLevelColor = {
  low: 'text-green-400',
  moderate: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? 'bg-red-500' : value >= 50 ? 'bg-orange-500' : value >= 25 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function VitalTypeLabel(type: string) {
  const map: Record<string, string> = {
    heart_rate: 'Heart Rate',
    sleep_hours: 'Sleep',
    spo2: 'SpO2',
  }
  return map[type] ?? type
}

export default function DigitalTwinView({ data }: Props) {
  const { patient, vhi, recentAlerts, vitalsTrends, activeMedications } = data
  const summary = vhi?.summary_json as Record<string, unknown> | undefined

  // Group vitals by type for display — guard against null/undefined from API
  const vitalsByType = (Array.isArray(vitalsTrends) ? vitalsTrends : []).reduce<Record<string, typeof vitalsTrends>>((acc, v) => {
    if (!acc[v.vital_type]) acc[v.vital_type] = []
    acc[v.vital_type].push(v)
    return acc
  }, {})

  return (
    <div className="space-y-4 text-sm">
      {/* VHI Score */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white">Virtual Health Index</h3>
          <span className={`text-2xl font-bold ${riskLevelColor[vhi?.risk_level as keyof typeof riskLevelColor] ?? 'text-gray-400'}`}>
            {vhi?.risk_score ?? '--'}<span className="text-base text-gray-400">/100</span>
          </span>
        </div>
        {summary && (
          <div className="space-y-2">
            {typeof summary.fall_risk === 'number' && (
              <ScoreBar label="Fall Risk" value={summary.fall_risk as number} />
            )}
            {typeof summary.deterioration_risk === 'number' && (
              <ScoreBar label="Deterioration Risk" value={summary.deterioration_risk as number} />
            )}
            {typeof summary.adherence_score === 'number' && (
              // adherence_score is 0-100 where higher = better adherence.
              // Show it directly so that a full bar means excellent adherence.
              // The colour scale in ScoreBar treats high values as red (risk), so
              // we invert: a high adherence score → low risk bar height.
              // Label as "Non-Adherence Risk" so the bar direction is unambiguous.
              <ScoreBar label="Non-Adherence Risk" value={100 - (summary.adherence_score as number)} />
            )}
          </div>
        )}
        {Array.isArray(summary?.chronic_conditions) && (summary.chronic_conditions as string[]).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(summary.chronic_conditions as string[]).map((c) => (
              <span key={c} className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* Alerts */}
      {recentAlerts.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Active Alerts
          </h3>
          <ul className="space-y-2">
            {recentAlerts.map((alert) => {
              const cfg = severityConfig[alert.severity as keyof typeof severityConfig] ?? severityConfig.low
              return (
                <li key={alert.id} className={`rounded-lg border ${cfg.border} ${cfg.bg} px-3 py-2.5`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs leading-relaxed ${cfg.text}`}>{alert.message}</p>
                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${cfg.badge} capitalize`}>
                      {alert.severity}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Vitals Trends */}
      {Object.keys(vitalsByType).length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h3 className="font-semibold text-white mb-3">Last 7 Days — Vitals</h3>
          <div className="space-y-4">
            {Object.entries(vitalsByType).map(([type, readings]) => {
              const latest = readings[readings.length - 1]
              const values = readings.map((r) => r.value)
              const max = Math.max(...values)
              const min = Math.min(...values)
              return (
                <div key={type}>
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span className="font-medium text-gray-300">{VitalTypeLabel(type)}</span>
                    <span>{latest.value} {latest.unit}</span>
                  </div>
                  <div className="flex items-end gap-0.5 h-8">
                    {readings.map((r, i) => {
                      const range = max - min || 1
                      const height = Math.max(8, ((r.value - min) / range) * 100)
                      return (
                        <div
                          key={`${r.recorded_at}-${r.value}-${i}`}
                          className="flex-1 bg-blue-500/60 rounded-sm"
                          style={{ height: `${height}%` }}
                          title={`${new Date(r.recorded_at).toLocaleDateString()}: ${r.value} ${r.unit}`}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Active Medications */}
      {activeMedications.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h3 className="font-semibold text-white mb-3">Active Medications</h3>
          <ul className="space-y-2">
            {activeMedications.map((med) => {
              const adherenceColor = med.adherence >= 80 ? 'text-green-400' : med.adherence >= 60 ? 'text-yellow-400' : 'text-red-400'
              return (
                <li key={med.id} className="flex items-center justify-between py-1.5 border-b border-gray-700 last:border-0">
                  <div>
                    <p className="text-white font-medium text-xs">{med.name}</p>
                    <p className="text-gray-400 text-xs">{med.dosage} — {med.frequency}</p>
                  </div>
                  <span className={`text-xs font-semibold ${adherenceColor}`}>{med.adherence}%</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Emergency Contacts */}
      {patient.emergencyContacts.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h3 className="font-semibold text-white mb-3">Emergency Contacts</h3>
          <ul className="space-y-2">
            {patient.emergencyContacts.map((contact, i) => (
              <li key={`${contact.phone}-${contact.relation}-${i}`} className="flex items-center justify-between">
                <div>
                  <p className="text-white text-xs font-medium">{contact.name}</p>
                  <p className="text-gray-400 text-xs">{contact.relation}</p>
                </div>
                <a href={`tel:${contact.phone}`} className="text-blue-400 text-xs hover:text-blue-300 transition">
                  {contact.phone}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-600 text-center pb-2">
        DOB: {new Date(patient.dateOfBirth).toLocaleDateString()} &bull; Blood Type: {patient.bloodType ?? 'Unknown'}
      </p>
    </div>
  )
}
