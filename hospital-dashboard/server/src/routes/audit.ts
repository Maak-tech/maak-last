import { Hono } from 'hono'
import { query } from '../lib/db.js'
import { jwtAuth, requireRole } from '../middleware/jwtAuth.js'

export const auditRoutes = new Hono()

// GET /audit — paginated audit log with optional filters
// Query params:
//   page      (default 1)
//   limit     (default 50, max 200)
//   staffId   — filter by staff member UUID
//   patientId — filter by patient UUID
//   action    — filter by action string (e.g. "recognition_attempt", "data_access")
//   from      — ISO date string lower bound on created_at
//   to        — ISO date string upper bound on created_at
auditRoutes.get('/audit', jwtAuth, requireRole('admin'), async (c) => {
  const page   = Math.max(1, Number(c.req.query('page')  ?? 1))
  const limit  = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? 50)))
  const offset = (page - 1) * limit

  const staffId   = c.req.query('staffId')   ?? null
  const patientId = c.req.query('patientId') ?? null
  const action    = c.req.query('action')    ?? null
  const fromRaw   = c.req.query('from')      ?? null
  const toRaw     = c.req.query('to')        ?? null

  // Validate date strings before passing to Postgres — invalid dates produce 500
  if (fromRaw && isNaN(new Date(fromRaw).getTime())) {
    return c.json({ error: "Invalid 'from' date — use ISO 8601 format" }, 400)
  }
  if (toRaw && isNaN(new Date(toRaw).getTime())) {
    return c.json({ error: "Invalid 'to' date — use ISO 8601 format" }, 400)
  }
  const from = fromRaw
  const to   = toRaw

  // Build dynamic WHERE clause
  const conditions: string[] = []
  const params: unknown[]    = []

  if (staffId) {
    params.push(staffId)
    conditions.push(`l.staff_id = $${params.length}`)
  }
  if (patientId) {
    params.push(patientId)
    conditions.push(`l.patient_id = $${params.length}`)
  }
  if (action) {
    params.push(action)
    conditions.push(`l.action = $${params.length}`)
  }
  if (from) {
    params.push(from)
    conditions.push(`l.created_at >= $${params.length}`)
  }
  if (to) {
    params.push(to)
    conditions.push(`l.created_at <= $${params.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Paginated results
  params.push(limit, offset)
  const logs = await query(
    `SELECT l.*, s.name AS staff_name, p.name AS patient_name
     FROM access_audit_logs l
     LEFT JOIN hospital_staff s ON l.staff_id  = s.id
     LEFT JOIN patients       p ON l.patient_id = p.id
     ${where}
     ORDER BY l.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  // Total count for the same filters (without pagination params)
  const countParams = params.slice(0, -2)
  const [countRow] = await query<{ total: string }>(
    `SELECT COUNT(*) AS total
     FROM access_audit_logs l
     ${where}`,
    countParams
  )
  const total = Number(countRow?.total ?? 0)

  return c.json({
    logs,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  })
})
