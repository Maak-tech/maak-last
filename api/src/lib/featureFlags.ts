/**
 * Feature flag evaluation.
 *
 * Usage:
 *   import { isEnabled } from '../lib/featureFlags'
 *   if (await isEnabled('ddi-warnings', { userId })) { ... }
 *
 * The check is lightweight — a single indexed primary-key lookup.
 * Results are NOT cached in this helper; add a TTL cache layer if the flag
 * is checked on every request in a hot path.
 *
 * Flag evaluation order (first matching rule wins):
 *   1. enabledUserIds contains userId → ON
 *   2. enabledOrgIds contains orgId  → ON
 *   3. enabledForAll = true          → ON
 *   4. rolloutPercent > 0            → deterministic hash(userId + flagName) % 100 < rolloutPercent
 *   5. Otherwise                     → OFF
 *
 * The rollout hash is deterministic so a given user always gets the same
 * result for a given rolloutPercent — they don't flip on/off between requests.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { featureFlags } from "../db/schema";
import { createHash } from "node:crypto";

interface FlagContext {
  userId?: string;
  orgId?: string;
}

/**
 * Evaluate a feature flag for the given context.
 * Returns false if the flag does not exist (unknown flags are off by default).
 */
export async function isEnabled(flagName: string, context: FlagContext = {}): Promise<boolean> {
  try {
    const [flag] = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.name, flagName))
      .limit(1);

    if (!flag) return false; // unknown flag → off

    const { userId, orgId } = context;

    // Rule 1: explicit user allowlist
    if (userId && Array.isArray(flag.enabledUserIds) && flag.enabledUserIds.includes(userId)) {
      return true;
    }

    // Rule 2: explicit org allowlist
    if (orgId && Array.isArray(flag.enabledOrgIds) && flag.enabledOrgIds.includes(orgId)) {
      return true;
    }

    // Rule 3: global on
    if (flag.enabledForAll) return true;

    // Rule 4: percentage rollout — deterministic per-user hash
    if (flag.rolloutPercent > 0 && userId) {
      const hash = createHash("sha256")
        .update(`${flagName}:${userId}`)
        .digest("hex");
      // Take the first 8 hex chars (32-bit value), map to 0–99
      const bucket = parseInt(hash.slice(0, 8), 16) % 100;
      return bucket < flag.rolloutPercent;
    }

    return false;
  } catch (err) {
    // Never crash the caller — a DB error means the flag is unknown
    console.error(`[featureFlags] Error evaluating flag "${flagName}":`, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Convenience: evaluate multiple flags at once.
 * Returns a map of flagName → boolean.
 */
export async function evaluateFlags(
  flagNames: string[],
  context: FlagContext = {}
): Promise<Record<string, boolean>> {
  const results = await Promise.all(
    flagNames.map(async (name) => [name, await isEnabled(name, context)] as const)
  );
  return Object.fromEntries(results);
}
