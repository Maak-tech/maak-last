import { pool } from './db.js'
import { v4 as uuidv4 } from 'uuid'

export interface AuditEntry {
  staffId?: string
  patientId?: string
  action: string
  method?: string
  success?: boolean
  confidence?: number
  ipAddress?: string
  cameraId?: string
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO access_audit_logs
       (id, staff_id, patient_id, action, method, success, confidence, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [
        uuidv4(),
        entry.staffId ?? null,
        entry.patientId ?? null,
        entry.action,
        entry.method ?? null,
        entry.success ?? null,
        entry.confidence ?? null,
        entry.ipAddress ?? null,
      ]
    )
  } catch (err) {
    // Never throw — audit failures must not block the caller
    console.error('[audit] writeAudit failed — audit trail may have a gap:', err)
  }
}
