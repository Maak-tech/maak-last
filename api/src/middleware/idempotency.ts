import type { Context, Next } from 'elysia'
import { db } from '../db/index.js'
import { sql } from 'drizzle-orm'
import { logger } from '../lib/logger.js'

// In-memory fallback when Redis is not configured
// For production multi-instance deployments, use Redis
const memCache = new Map<string, { body: unknown; statusCode: number; expiresAt: number }>()

// Cleanup expired in-memory entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memCache) {
    if (now > entry.expiresAt) memCache.delete(key)
  }
}, 5 * 60_000).unref?.()

const IDEMPOTENCY_TTL_MS = 86_400_000 // 24 hours
const MAX_KEY_LENGTH = 64

export function idempotencyMiddleware(resourceName: string) {
  return {
    // Elysia onBeforeHandle — check for existing result
    async beforeHandle({ request, set, store }: { request: Request; set: { status?: number }; store: Record<string, unknown> }) {
      if (request.method !== 'POST') return

      const key = request.headers.get('X-Idempotency-Key')
      if (!key) return
      if (key.length > MAX_KEY_LENGTH) {
        set.status = 400
        return { error: `X-Idempotency-Key must be ≤ ${MAX_KEY_LENGTH} characters` }
      }

      const userId = (store as { session?: { userId: string } }).session?.userId ?? 'anon'
      const scopedKey = `${userId}:${resourceName}:${key}`

      const cached = memCache.get(scopedKey)
      if (cached && Date.now() < cached.expiresAt) {
        logger.debug({ scopedKey, resourceName }, '[idempotency] Cache hit — returning cached response')
        ;(store as Record<string, unknown>)._idempotencyHit = cached
        set.status = cached.statusCode
        return cached.body
      }

      // Store the key for post-handler caching
      ;(store as Record<string, unknown>)._idempotencyKey = scopedKey
    },

    // Elysia onAfterHandle — cache the result
    async afterHandle({ store, response }: { store: Record<string, unknown>; response: unknown }) {
      const scopedKey = (store as Record<string, unknown>)._idempotencyKey as string | undefined
      if (!scopedKey || (store as Record<string, unknown>)._idempotencyHit) return

      const statusCode = typeof response === 'object' && response !== null && 'status' in response
        ? (response as { status: number }).status
        : 200

      if (statusCode >= 200 && statusCode < 300) {
        memCache.set(scopedKey, {
          body: response,
          statusCode,
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        })
      }
    },
  }
}
