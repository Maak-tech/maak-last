/**
 * Unit tests for the hospital JWT authentication middleware and requireRole guard.
 *
 * The DB (queryOne for revocation check) is stubbed so tests run fully offline.
 * jwtAuth.ts calls process.exit(1) at module load if JWT_SECRET is missing, so
 * we set it before any import.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { Hono } from 'hono'

const TEST_JWT_SECRET = 'test-hospital-jwt-secret-32-chars!!'
process.env.JWT_SECRET = TEST_JWT_SECRET
process.env.DB_ENCRYPTION_KEY = 'a'.repeat(64)

// Stub the DB module before importing the middleware.
vi.mock('../lib/db.js', () => ({
  queryOne: vi.fn().mockResolvedValue(null),   // default: token NOT revoked
  query: vi.fn().mockResolvedValue([]),
  withTransaction: vi.fn().mockResolvedValue(undefined),
}))

import { jwtAuth, requireRole } from '../middleware/jwtAuth.js'
import { queryOne } from '../lib/db.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function signToken(payload: object, secret = TEST_JWT_SECRET, expiresIn = '8h') {
  return jwt.sign(payload, secret, { expiresIn, algorithm: 'HS256' })
}

function validPayload(role = 'doctor') {
  return { staffId: 'staff-001', role, jti: 'jti-test-001' }
}

function makeApp(extraMiddleware?: ReturnType<typeof requireRole>) {
  const app = new Hono()
  const chain = extraMiddleware
    ? app.get('/test', jwtAuth, extraMiddleware, (c) => c.json({ ok: true }))
    : app.get('/test', jwtAuth, (c) => c.json({ ok: true }))
  return app
}

async function req(app: Hono, authHeader?: string) {
  const headers: Record<string, string> = {}
  if (authHeader) headers['Authorization'] = authHeader
  return app.request('/test', { headers })
}

// ── jwtAuth ───────────────────────────────────────────────────────────────────

describe('jwtAuth', () => {
  beforeEach(() => {
    vi.mocked(queryOne).mockResolvedValue(null)  // token not revoked by default
  })

  it('returns 401 when Authorization header is missing', async () => {
    const res = await req(makeApp())
    expect(res.status).toBe(401)
  })

  it('returns 401 when Authorization header does not start with "Bearer "', async () => {
    const res = await req(makeApp(), 'Basic abc123')
    expect(res.status).toBe(401)
  })

  it('returns 401 when token is signed with wrong secret', async () => {
    const token = signToken(validPayload(), 'wrong-secret')
    const res = await req(makeApp(), `Bearer ${token}`)
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Invalid token')
  })

  it('returns 401 when token is expired', async () => {
    const token = jwt.sign(validPayload(), TEST_JWT_SECRET, {
      expiresIn: -1,   // already expired
      algorithm: 'HS256',
    })
    const res = await req(makeApp(), `Bearer ${token}`)
    expect(res.status).toBe(401)
  })

  it('returns 401 when payload is missing staffId', async () => {
    const token = signToken({ role: 'doctor', jti: 'jti-bad' })
    const res = await req(makeApp(), `Bearer ${token}`)
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Invalid token format')
  })

  it('returns 401 when payload has invalid role', async () => {
    const token = signToken({ staffId: 'staff-001', role: 'superadmin', jti: 'jti-bad' })
    const res = await req(makeApp(), `Bearer ${token}`)
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Invalid token format')
  })

  it('returns 401 when token is in the revocation list', async () => {
    vi.mocked(queryOne).mockResolvedValue({ id: 'revoked-jti' })  // token IS revoked
    const token = signToken(validPayload())
    const res = await req(makeApp(), `Bearer ${token}`)
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Token revoked')
  })

  it('passes through and attaches staff context for a valid token', async () => {
    const token = signToken(validPayload('nurse'))
    const app = new Hono()
    app.get('/test', jwtAuth, (c) => {
      const staff = c.get('staff')
      return c.json({ staffId: staff.staffId, role: staff.role })
    })
    const res = await app.request('/test', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const body = await res.json() as { staffId: string; role: string }
    expect(body.staffId).toBe('staff-001')
    expect(body.role).toBe('nurse')
  })

  it('checks the revocation list using the jti from the token payload', async () => {
    const token = signToken({ staffId: 's1', role: 'admin', jti: 'unique-jti-xyz' })
    await req(makeApp(), `Bearer ${token}`)
    expect(vi.mocked(queryOne)).toHaveBeenCalledWith(
      expect.stringContaining('revoked_tokens'),
      ['unique-jti-xyz']
    )
  })
})

// ── requireRole ───────────────────────────────────────────────────────────────

describe('requireRole', () => {
  beforeEach(() => {
    vi.mocked(queryOne).mockResolvedValue(null)
  })

  it('allows a doctor token through a doctor-only route', async () => {
    const token = signToken(validPayload('doctor'))
    const app = makeApp(requireRole('doctor'))
    const res = await req(app, `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('allows an admin token through a doctor/admin route', async () => {
    const token = signToken(validPayload('admin'))
    const app = makeApp(requireRole('doctor', 'admin'))
    const res = await req(app, `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('returns 403 when a nurse token hits a doctor-only route', async () => {
    const token = signToken(validPayload('nurse'))
    const app = makeApp(requireRole('doctor'))
    const res = await req(app, `Bearer ${token}`)
    expect(res.status).toBe(403)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Forbidden')
  })

  it('returns 403 when a viewer token tries to access an admin-only route', async () => {
    const token = signToken(validPayload('viewer'))
    const app = makeApp(requireRole('doctor', 'nurse', 'admin'))
    const res = await req(app, `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('allows any of the specified roles through', async () => {
    for (const role of ['doctor', 'nurse', 'admin'] as const) {
      const token = signToken(validPayload(role))
      const app = makeApp(requireRole('doctor', 'nurse', 'admin'))
      const res = await req(app, `Bearer ${token}`)
      expect(res.status).toBe(200)
    }
  })
})
