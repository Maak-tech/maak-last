import { Hono } from 'hono'
import { query } from '../lib/db.js'
import { jwtAuth, requireRole } from '../middleware/jwtAuth.js'

export const auditRoutes = new Hono()

auditRoutes.get('/audit', jwtAuth, requireRole('admin'), async (c) => {
  const page = Number(c.req.query('page') ?? 1)
  const limit = Number(c.req.query('limit') ?? 50)
  const offset = (page - 1) * limit

  const logs = await query(
    `SELECT l.*, s.name as staff_name, p.name as patient_name
     FROM access_audit_logs l
     LEFT JOIN hospital_staff s ON l.staff_id = s.id
     LEFT JOIN patients p ON l.patient_id = p.id
     ORDER BY l.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )

  return c.json({ logs, page, limit })
})
