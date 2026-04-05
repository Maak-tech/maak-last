import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../lib/db.js'
import { writeAudit } from '../lib/audit.js'

type Staff = {
  id: string
  email: string
  name: string
  role: 'doctor' | 'nurse' | 'admin' | 'viewer'
  password_hash: string
  is_active: boolean
  failed_login_attempts: number
  locked_until: string | null
}

export const authRoutes = new Hono()

authRoutes.post('/auth/login', async (c) => {
  const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown'
  let email: string, password: string
  try {
    const body = await c.req.json<{ email?: unknown; password?: unknown }>()
    if (typeof body?.email !== 'string' || typeof body?.password !== 'string') {
      return c.json({ error: 'email and password are required' }, 400)
    }
    email = body.email
    password = body.password
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const staff = await queryOne<Staff>(
    'SELECT * FROM hospital_staff WHERE email = $1 AND is_active = true',
    [email]
  )

  if (!staff) {
    // Run a dummy bcrypt compare to normalize response time and prevent
    // user-enumeration via timing difference (user-not-found vs wrong-password).
    // The dummy hash must be a valid 60-char bcrypt hash format ($2b$12$ + 22-char salt + 31-char hash)
    // so bcryptjs runs the full key-derivation instead of short-circuiting on an invalid hash.
    await bcrypt.compare(password, '$2b$12$Ei4OstQVEtP2SgXi1p9VXuHeartsGoodSalt1234567890abcdefg')
    await writeAudit({ action: 'login_failed', ipAddress: ip, success: false })
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  // Check lockout
  if (staff.locked_until && new Date(staff.locked_until) > new Date()) {
    return c.json({ error: 'Account locked. Try again later.' }, 403)
  }

  const valid = await bcrypt.compare(password, staff.password_hash)
  if (!valid) {
    await query(
      `UPDATE hospital_staff
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE WHEN failed_login_attempts >= 4 THEN now() + interval '30 minutes' ELSE locked_until END
       WHERE id = $1`,
      [staff.id]
    )
    await writeAudit({ staffId: staff.id, action: 'login_failed', ipAddress: ip, success: false })
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  // Reset failed attempts on success
  await query(
    'UPDATE hospital_staff SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
    [staff.id]
  )

  const jti = uuidv4()
  const token = jwt.sign(
    { staffId: staff.id, role: staff.role, jti },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' }
  )

  await writeAudit({ staffId: staff.id, action: 'login_success', ipAddress: ip, success: true })

  return c.json({
    token,
    staff: { id: staff.id, name: staff.name, role: staff.role, email: staff.email },
  })
})

authRoutes.post('/auth/logout', async (c) => {
  const auth = c.req.header('Authorization')
  if (auth?.startsWith('Bearer ')) {
    try {
      // Use jwt.verify() (not jwt.decode()) so that only tokens with a valid
      // signature can add entries to the revocation list.
      // Using jwt.decode() would allow attackers to craft fake tokens with arbitrary
      // JTIs and far-future expiries, polluting the revoked_tokens table (DoS).
      const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET!) as { jti?: string; exp?: number }
      if (payload?.jti) {
        await query(
          'INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, to_timestamp($2)) ON CONFLICT DO NOTHING',
          [payload.jti, payload.exp ?? 0]
        )
      }
    } catch (err: unknown) {
      // jwt.verify throws JsonWebTokenError/TokenExpiredError for malformed or
      // expired tokens — these are expected during logout and safe to ignore.
      // Re-log only unexpected error types for visibility.
      const name = (err as { name?: string })?.name ?? ''
      if (name !== 'JsonWebTokenError' && name !== 'TokenExpiredError' && name !== 'NotBeforeError') {
        console.warn('[auth/logout] Unexpected error during token revocation:', err instanceof Error ? err.message : String(err))
      }
    }
  }
  return c.json({ ok: true })
})
