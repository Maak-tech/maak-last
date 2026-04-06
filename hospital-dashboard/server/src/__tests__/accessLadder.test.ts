/**
 * Unit tests for the 3-level patient access ladder.
 *
 * Verifies that:
 *  Level 0 — face/QR match creates a session token (no PHI returned)
 *  Level 1 — GET /patient/preview requires only a valid (unexpired) session
 *  Level 2 — GET /patient/by-session requires session.confirmed === true
 *  Level 3 — Expired sessions (or 'revoked' access_level) are rejected at every level
 *
 * All DB calls are stubbed — no Postgres required.
 * JWT_SECRET and DB_ENCRYPTION_KEY must be set before module imports.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { Hono } from 'hono'

const TEST_JWT_SECRET = 'test-hospital-access-ladder-secret!'
process.env.JWT_SECRET = TEST_JWT_SECRET
process.env.DB_ENCRYPTION_KEY = 'b'.repeat(64)

// ── DB stub ───────────────────────────────────────────────────────────────────

const mockQueryOne = vi.fn()
const mockQuery = vi.fn()
const mockWriteAudit = vi.fn().mockResolvedValue(undefined)

vi.mock('../lib/db.js', () => ({
  queryOne: mockQueryOne,
  query: mockQuery,
  withTransaction: vi.fn(),
}))
vi.mock('../lib/audit.js', () => ({
  writeAudit: mockWriteAudit,
}))

import { patientRoutes } from '../routes/patient.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function signStaff(role = 'doctor', staffId = 'staff-001') {
  return jwt.sign(
    { staffId, role, jti: `jti-${Math.random().toString(36).slice(2)}` },
    TEST_JWT_SECRET,
    { expiresIn: '8h', algorithm: 'HS256' }
  )
}

function makeSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'session-abc',
    patient_id: 'patient-001',
    staff_id: 'staff-001',
    access_level: 'preview',
    method: 'face',
    confirmed: false,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

function makePatient() {
  return {
    id: 'patient-001',
    name: 'Emma Chen',
    date_of_birth: '1958-06-15',
    blood_type: 'A+',
    emergency_contacts: [],
  }
}

function makeTwin() {
  return { risk_score: 78, risk_level: 'high' }
}

async function get(path: string, token: string) {
  return patientRoutes.request(path, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function post(path: string, token: string, body?: object) {
  return patientRoutes.request(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /patient/preview/:sessionToken — Level 1 (preview only)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: token not revoked
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      if (sql.includes('recognition_sessions')) return Promise.resolve(makeSession())
      if (sql.includes('SELECT id, name')) return Promise.resolve(makePatient())
      if (sql.includes('digital_twins')) return Promise.resolve(makeTwin())
      if (sql.includes('biometric_enrollments')) return Promise.resolve({ is_active: true })
      return Promise.resolve(null)
    })
  })

  it('returns name + masked DOB + risk level — no full PHI (medications, conditions, etc.)', async () => {
    const res = await get('/patient/preview/session-abc', signStaff())
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.name).toBe('Emma Chen')
    expect(body.maskedDob).toMatch(/^\*\*\/\*\*\/\d{4}$/)  // **/**/1958
    expect(body.riskLevel).toBe('high')
    // Must NOT contain full PHI
    expect(body.medications).toBeUndefined()
    expect(body.activeConditions).toBeUndefined()
    expect(body.labAbnormalities).toBeUndefined()
  })

  it('returns 401 when session is expired (getValidSession returns null)', async () => {
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      if (sql.includes('recognition_sessions')) return Promise.resolve(null)  // expired
      return Promise.resolve(null)
    })
    const res = await get('/patient/preview/expired-session', signStaff())
    expect(res.status).toBe(401)
  })

  it("returns 403 when session belongs to a different staff member", async () => {
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      if (sql.includes('recognition_sessions')) return Promise.resolve(makeSession({ staff_id: 'other-staff' }))
      return Promise.resolve(null)
    })
    const res = await get('/patient/preview/session-abc', signStaff('doctor', 'staff-001'))
    expect(res.status).toBe(403)
  })

  it('returns 401 when session has access_level = "revoked" (consent withdrawn)', async () => {
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      // getValidSession returns null for revoked sessions (see patient.ts lines 31–33)
      if (sql.includes('recognition_sessions')) return Promise.resolve(null)
      return Promise.resolve(null)
    })
    const res = await get('/patient/preview/session-abc', signStaff())
    expect(res.status).toBe(401)
  })

  it('writes an audit log entry for every preview access', async () => {
    await get('/patient/preview/session-abc', signStaff())
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'patient_preview_viewed', patientId: 'patient-001' })
    )
  })
})

describe('POST /patient/confirm/:sessionToken — Level 2 (confirm identity)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue([])
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      if (sql.includes('recognition_sessions')) return Promise.resolve(makeSession())
      return Promise.resolve(null)
    })
  })

  it('marks session as confirmed and returns confirmed: true', async () => {
    const res = await post('/patient/confirm/session-abc', signStaff())
    expect(res.status).toBe(200)
    const body = await res.json() as { confirmed: boolean; sessionToken: string }
    expect(body.confirmed).toBe(true)
    expect(body.sessionToken).toBe('session-abc')
  })

  it('runs the UPDATE with confirmed = false guard (idempotent confirm)', async () => {
    await post('/patient/confirm/session-abc', signStaff())
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('confirmed = false'),
      expect.arrayContaining(['session-abc', 'staff-001'])
    )
  })

  it('returns 403 when session belongs to a different staff member', async () => {
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      if (sql.includes('recognition_sessions')) return Promise.resolve(makeSession({ staff_id: 'other-staff' }))
      return Promise.resolve(null)
    })
    const res = await post('/patient/confirm/session-abc', signStaff('doctor', 'staff-001'))
    expect(res.status).toBe(403)
  })

  it('returns 401 for an expired session', async () => {
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      if (sql.includes('recognition_sessions')) return Promise.resolve(null)
      return Promise.resolve(null)
    })
    const res = await post('/patient/confirm/expired-session', signStaff())
    expect(res.status).toBe(401)
  })

  it('writes audit log for successful confirmation', async () => {
    await post('/patient/confirm/session-abc', signStaff())
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'identity_confirmed', success: true })
    )
  })

  it('writes audit log for session ownership violation', async () => {
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      if (sql.includes('recognition_sessions')) return Promise.resolve(makeSession({ staff_id: 'other' }))
      return Promise.resolve(null)
    })
    await post('/patient/confirm/session-abc', signStaff())
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'session_ownership_violation', success: false })
    )
  })
})

describe('GET /patient/by-session/:sessionToken — Level 3 (full twin)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      // Confirmed session
      if (sql.includes('recognition_sessions'))
        return Promise.resolve(makeSession({ confirmed: true, access_level: 'confirmed' }))
      if (sql.includes('SELECT id, name')) return Promise.resolve(makePatient())
      if (sql.includes('digital_twins')) return Promise.resolve(makeTwin())
      return Promise.resolve(null)
    })
    mockQuery.mockResolvedValue([])
  })

  it('returns 403 when session is NOT yet confirmed', async () => {
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      if (sql.includes('recognition_sessions'))
        return Promise.resolve(makeSession({ confirmed: false }))
      return Promise.resolve(null)
    })
    const res = await get('/patient/by-session/session-abc', signStaff())
    expect(res.status).toBe(403)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('Confirmed session required')
  })

  it('returns 403 for a viewer role even with a confirmed session', async () => {
    const res = await get('/patient/by-session/session-abc', signStaff('viewer'))
    expect(res.status).toBe(403)
  })

  it('returns 200 with patient data for a confirmed session + doctor role', async () => {
    const res = await get('/patient/by-session/session-abc', signStaff('doctor'))
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.patient).toBeDefined()
  })

  it('returns 403 for an expired session (confirmed but expired)', async () => {
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      if (sql.includes('recognition_sessions')) return Promise.resolve(null)  // expired
      return Promise.resolve(null)
    })
    const res = await get('/patient/by-session/session-abc', signStaff())
    expect(res.status).toBe(403)
  })
})
