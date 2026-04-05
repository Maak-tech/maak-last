import type { Context, Next } from 'hono'
import jwt from 'jsonwebtoken'
import { queryOne } from '../lib/db.js'

// Fail fast at startup rather than silently returning 401 for every request.
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET environment variable is not set. Set it in .env before starting the server.')
  process.exit(1)
}

export interface StaffPayload {
  staffId: string
  role: 'doctor' | 'nurse' | 'admin' | 'viewer'
  jti: string
}

declare module 'hono' {
  interface ContextVariableMap {
    staff: StaffPayload
  }
}

export async function jwtAuth(c: Context, next: Next) {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = auth.slice(7)
  try {
    // Specify the algorithm explicitly to prevent algorithm confusion attacks
    // (e.g. an attacker switching the header to 'none' or 'RS256').
    const payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as StaffPayload

    // Check token revocation list
    const revoked = await queryOne(
      'SELECT id FROM revoked_tokens WHERE jti = $1 AND expires_at > now()',
      [payload.jti]
    )
    if (revoked) {
      return c.json({ error: 'Token revoked' }, 401)
    }

    c.set('staff', payload)
    await next()
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
}

export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const staff = c.get('staff')
    if (!roles.includes(staff.role)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  }
}
