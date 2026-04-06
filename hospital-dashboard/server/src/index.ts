import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth.js'
import { enrollRoutes } from './routes/enroll.js'
import { recognizeRoutes } from './routes/recognize.js'
import { qrRoutes } from './routes/qr.js'
import { patientRoutes } from './routes/patient.js'
import { auditRoutes } from './routes/audit.js'
import { shiftRoutes } from './routes/shift.js'
import { query } from './lib/db.js'

// ── Startup environment validation ─────────────────────────────────────────────
// Fail fast with a clear message rather than silently producing cryptic runtime
// failures (undefined credentials, connection refused) on the first request.
const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'DB_ENCRYPTION_KEY',
  'COMPREFACE_URL',
  'COMPREFACE_API_KEY',
] as const

const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key])
if (missingEnv.length > 0) {
  console.error(`[FATAL] Missing required environment variables: ${missingEnv.join(', ')}`)
  console.error('        Copy .env.example to .env and fill in all values before starting.')
  process.exit(1)
}

const app = new Hono()

app.use('*', logger())
app.use('*', cors({
  origin: [process.env.WEB_URL ?? 'http://localhost:3000', process.env.EXPO_URL ?? 'http://localhost:19006'],
  allowHeaders: ['Authorization', 'Content-Type', 'X-Session-Token'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

// HTTPS redirect in production
app.use('*', async (c, next) => {
  if (process.env.NODE_ENV === 'production' && c.req.header('x-forwarded-proto') === 'http') {
    return c.redirect('https://' + c.req.header('host') + c.req.url, 301)
  }
  return next()
})

app.route('/', authRoutes)
app.route('/', enrollRoutes)
app.route('/', recognizeRoutes)
app.route('/', qrRoutes)
app.route('/', patientRoutes)
app.route('/', auditRoutes)
app.route('/', shiftRoutes)

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

const port = Number(process.env.PORT ?? 3001)
serve({ fetch: app.fetch, port }, () => {
  console.log(`Hospital server running on http://localhost:${port}`)
})

// ── Periodic cleanup ───────────────────────────────────────────────────────────
// Prune expired revoked_tokens rows daily to prevent unbounded table growth.
// The revoked_tokens table only tracks currently-valid revocations — HIPAA audit
// logs live in access_audit_logs and must NOT be deleted by this job.
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const cleanupInterval = setInterval(async () => {
  try {
    const result = await query('DELETE FROM revoked_tokens WHERE expires_at < now()')
    const deleted = (result as unknown as { rowCount?: number }).rowCount ?? 0
    if (deleted > 0) {
      console.log(`[cleanup] Pruned ${deleted} expired revoked token(s)`)
    }
  } catch (err: unknown) {
    console.error(
      '[cleanup] Failed to prune revoked_tokens:',
      err instanceof Error ? err.message : String(err)
    )
  }
}, CLEANUP_INTERVAL_MS)
// Allow the process to exit normally without waiting for this interval.
cleanupInterval.unref()

export default app
