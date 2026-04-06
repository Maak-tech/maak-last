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

// ── IP-level login rate limiter ────────────────────────────────────────────────
// Complements per-account lockout: an attacker with a list of staff emails can
// cycle through accounts, triggering lockouts on each while bypassing per-account
// limits. IP-level throttling limits the overall attempt rate per source address.
// Limit: 10 attempts per IP per minute.
const loginRateLimiter = new Map<string, { count: number; resetAt: number }>()
const LOGIN_RL_WINDOW_MS = 60_000
const LOGIN_RL_MAX = 10

function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const entry = loginRateLimiter.get(ip)
  if (!entry || now >= entry.resetAt) {
    loginRateLimiter.set(ip, { count: 1, resetAt: now + LOGIN_RL_WINDOW_MS })
    return { allowed: true, retryAfterMs: 0 }
  }
  if (entry.count >= LOGIN_RL_MAX) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }
  entry.count++
  return { allowed: true, retryAfterMs: 0 }
}

// Evict stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of loginRateLimiter) {
    if (now >= entry.resetAt) loginRateLimiter.delete(ip)
  }
}, 5 * 60_000).unref()

export const authRoutes = new Hono()

authRoutes.post('/auth/login', async (c) => {
  const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown'

  const rl = checkLoginRateLimit(ip)
  if (!rl.allowed) {
    return c.json(
      { error: 'Too many login attempts from this IP. Please try again later.' },
      429,
      { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) }
    )
  }
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
      // Threshold: lock after 5 consecutive failures.
      // Use `failed_login_attempts + 1 >= 5` so the lock is set atomically
      // in the same UPDATE that records the 5th failure — the old value
      // `failed_login_attempts` is evaluated in the DB at the time of the UPDATE,
      // so this correctly fires when the pre-increment count is 4 (i.e. this is the 5th bad attempt).
      `UPDATE hospital_staff
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE WHEN failed_login_attempts + 1 >= 5 THEN now() + interval '30 minutes' ELSE locked_until END
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
    { algorithm: 'HS256', expiresIn: '8h' }
  )

  await writeAudit({ staffId: staff.id, action: 'login_success', ipAddress: ip, success: true })

  return c.json({
    token,
    staff: { id: staff.id, name: staff.name, role: staff.role, email: staff.email },
  })
})

// POST /auth/change-password — authenticated password change with current-session revocation.
//
// Security design:
// • Requires `currentPassword` — prevents an attacker who stole an unattended
//   session from silently locking out the real user by changing the password.
// • Revokes the calling JWT immediately — all other tabs/devices using this
//   token are forced to re-authenticate, limiting post-change exposure.
// • Writes an audit record — provides a HIPAA-compliant trail of all
//   credential changes on accounts that have access to PHI.
authRoutes.post('/auth/change-password', async (c) => {
  const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown'
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  // Verify the JWT and extract staffId — use verify() not decode() so that
  // expired or tampered tokens are rejected before hitting the DB.
  let staffId: string
  let jti: string | undefined
  let exp: number | undefined
  try {
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET!) as {
      staffId?: string
      jti?: string
      exp?: number
    }
    if (!payload?.staffId) return c.json({ error: 'Invalid token' }, 401)
    staffId = payload.staffId
    jti = payload.jti
    exp = payload.exp
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  let currentPassword: string, newPassword: string
  try {
    const body = await c.req.json<{ currentPassword?: unknown; newPassword?: unknown }>()
    if (typeof body?.currentPassword !== 'string' || typeof body?.newPassword !== 'string') {
      return c.json({ error: 'currentPassword and newPassword are required' }, 400)
    }
    currentPassword = body.currentPassword
    newPassword = body.newPassword
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  // Enforce minimum password length — NIST SP 800-63B recommends at least 8 chars;
  // use 12 to match hospital security policy for privileged system access.
  if (newPassword.length < 12) {
    return c.json({ error: 'New password must be at least 12 characters' }, 400)
  }
  // Complexity: uppercase letter, digit, and special character are all required.
  // Hospital systems require stronger password policies than consumer apps because
  // a compromised staff account exposes patient PHI for everyone that staff member can access.
  if (!/[A-Z]/.test(newPassword)) {
    return c.json({ error: 'New password must contain at least one uppercase letter' }, 400)
  }
  if (!/[0-9]/.test(newPassword)) {
    return c.json({ error: 'New password must contain at least one digit' }, 400)
  }
  if (!/[^A-Za-z0-9]/.test(newPassword)) {
    return c.json({ error: 'New password must contain at least one special character' }, 400)
  }
  // Prevent trivially cycled passwords by rejecting re-use of the current one.
  // The actual re-use check happens after we load the hash from the DB.

  const staff = await queryOne<Pick<Staff, 'id' | 'password_hash' | 'is_active'>>(
    'SELECT id, password_hash, is_active FROM hospital_staff WHERE id = $1',
    [staffId]
  )

  if (!staff || !staff.is_active) {
    return c.json({ error: 'Account not found or deactivated' }, 401)
  }

  // Verify current password before allowing the change
  const currentValid = await bcrypt.compare(currentPassword, staff.password_hash)
  if (!currentValid) {
    await writeAudit({ staffId, action: 'password_change_failed', ipAddress: ip, success: false })
    return c.json({ error: 'Current password is incorrect' }, 403)
  }

  // Reject re-use: if the new password matches the current hash, refuse —
  // cycling to the same password provides no security improvement.
  const isSamePassword = await bcrypt.compare(newPassword, staff.password_hash)
  if (isSamePassword) {
    return c.json({ error: 'New password must differ from the current password' }, 400)
  }

  // Hash the new password with bcrypt cost factor 12
  const newHash = await bcrypt.hash(newPassword, 12)

  // Update the password and record when it was changed (used for session invalidation
  // and compliance reporting — e.g. flag accounts that haven't rotated in 90 days).
  await query(
    'UPDATE hospital_staff SET password_hash = $1, password_changed_at = now() WHERE id = $2',
    [newHash, staffId]
  )

  // Revoke the current JWT so that any other open tab or device using this
  // token must re-authenticate.  Uses jwt.verify()-validated jti, so this
  // cannot be poisoned with a crafted jti.
  if (jti) {
    await query(
      'INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, to_timestamp($2)) ON CONFLICT DO NOTHING',
      [jti, exp ?? 0]
    )
  }

  await writeAudit({ staffId, action: 'password_changed', ipAddress: ip, success: true })

  return c.json({ ok: true, message: 'Password changed. Please log in again.' })
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
