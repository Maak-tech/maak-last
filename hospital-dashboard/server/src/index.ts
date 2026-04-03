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

const app = new Hono()

app.use('*', logger())
app.use('*', cors({
  origin: [process.env.WEB_URL ?? 'http://localhost:3000', 'http://localhost:19006'],
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

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

const port = Number(process.env.PORT ?? 3001)
serve({ fetch: app.fetch, port }, () => {
  console.log(`Hospital server running on http://localhost:${port}`)
})

export default app
