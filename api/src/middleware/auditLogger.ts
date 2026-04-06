import { db } from '../db/index.js'
import { auditTrail } from '../db/schema.js'
import { logger } from '../lib/logger.js'
import { randomUUID } from 'crypto'

/**
 * PHI access categories that trigger audit logging.
 * Map of route path pattern → data category string.
 */
const PHI_ROUTES: Record<string, string> = {
  '/api/health/vitals': 'vitals',
  '/api/health/symptoms': 'symptoms',
  '/api/health/medications': 'medications',
  '/api/health/labs': 'lab_results',
  '/api/health/allergies': 'allergies',
  '/api/health/moods': 'moods',
  '/api/health/escalations': 'escalations',
  '/api/user/export': 'full_export',
  '/api/user/profile': 'profile',
  '/api/genetics': 'genetics',
  '/api/clinical-notes': 'clinical_notes',
}

function getPhiCategory(pathname: string): string | null {
  for (const [pattern, category] of Object.entries(PHI_ROUTES)) {
    if (pathname.includes(pattern)) return category
  }
  return null
}

/**
 * Elysia onAfterResponse hook for automatic PHI audit logging.
 * Fire-and-forget — never blocks the response.
 *
 * Usage in the Elysia app:
 *   .onAfterResponse(phiAuditLogger)
 *
 * The hook writes one row to `audit_trail` for every successful (< 400)
 * request that touches a PHI route.  Failed requests are intentionally
 * skipped: if data was never disclosed there is nothing to audit.
 */
export function phiAuditLogger({
  request,
  set,
  store,
}: {
  request: Request
  set: { status?: number | string }
  store: Record<string, unknown>
}) {
  const method = request.method
  const url = new URL(request.url)
  const category = getPhiCategory(url.pathname)

  // Only log PHI-touching routes
  if (!category) return

  const userId = (store as Record<string, unknown>).userId as string | undefined
  const requestId = (store as Record<string, unknown>).requestId as string | undefined
  const statusCode = typeof set.status === 'number' ? set.status : 200

  // Don't log failed requests — no PHI was disclosed
  if (statusCode >= 400) return

  const action =
    method === 'GET'
      ? 'read'
      : method === 'POST'
        ? 'write'
        : method === 'DELETE'
          ? 'delete'
          : 'update'

  // Fire and forget — audit logging must never block the response
  const auditEntry = {
    id: randomUUID(),
    userId: userId ?? 'anonymous',
    actorId: userId ?? 'anonymous',
    actorType: 'user' as const,
    action,
    resourceType: category,
    resourceId: url.pathname,
    metadata: {
      requestId: requestId ?? null,
      statusCode,
    } as Record<string, unknown>,
    ipAddress:
      request.headers.get('x-forwarded-for') ??
      request.headers.get('cf-connecting-ip') ??
      'unknown',
    userAgent: request.headers.get('user-agent') ?? null,
    createdAt: new Date(),
  }

  db.insert(auditTrail)
    .values(auditEntry)
    .catch((err: unknown) =>
      logger.error({ err, auditEntry }, 'Failed to write PHI audit log')
    )
}
