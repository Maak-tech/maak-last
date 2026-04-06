import { db } from '../db/index.js'
import { subscriptions, users } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'

/**
 * Server-side premium check. Use in route handlers that require a paid subscription.
 * Checks the subscriptions table, not the client-provided isPremium flag.
 */
export async function requirePremium(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  // Check active subscription
  const [sub] = await db.select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, 'active')
      )
    )
    .limit(1)

  if (sub) return { allowed: true }

  // Fallback: check isPremium in preferences (for grandfathered users)
  const [user] = await db.select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const prefs = user?.preferences as Record<string, unknown> ?? {}
  if (prefs.isPremium === true) return { allowed: true }

  return { allowed: false, reason: 'Premium subscription required' }
}
