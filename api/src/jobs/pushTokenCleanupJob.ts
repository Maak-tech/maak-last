/**
 * Push Token Cleanup — runs once per week via Railway cron (Sunday 03:00 UTC).
 *
 * Removes push token rows that have been deactivated (is_active = false) AND
 * have not been updated in 90+ days.  These are permanently orphaned tokens
 * from devices where the app was uninstalled, permissions revoked, or the
 * user switched devices without explicitly logging out.
 *
 * Why hard-delete instead of keeping indefinitely:
 *   - Deactivated tokens are never used for delivery — they are dead weight.
 *   - Retaining them indefinitely leaks the fact that a device existed,
 *     which is a minor HIPAA concern (device identifier → user link).
 *   - Keeping the table compact keeps the push send query fast.
 *
 * Safety:
 *   - Only deletes rows where is_active = false (active tokens are never touched).
 *   - 90-day grace period ensures recently-deactivated tokens are not
 *     immediately purged (e.g. user re-installs and re-registers same token).
 */

import { db } from "../db";
import { and, eq, lt, sql } from "drizzle-orm";
import { pushTokens } from "../db/schema";
import { recordHeartbeat } from "../lib/heartbeat";

const JOB_NAME = "push-token-cleanup";
const EXPECTED_INTERVAL_SECONDS = 7 * 24 * 60 * 60; // 1 week
const RETENTION_DAYS = 90;

async function runPushTokenCleanup(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const result = await db
    .delete(pushTokens)
    .where(
      and(
        eq(pushTokens.isActive, false),
        lt(pushTokens.updatedAt, cutoff)
      )
    );

  // Drizzle returns rowCount on delete
  const deleted = (result as unknown as { rowCount?: number })?.rowCount ?? 0;
  console.log(
    `[pushTokenCleanup] Deleted ${deleted} stale deactivated tokens older than ${RETENTION_DAYS} days.`
  );

  await recordHeartbeat(JOB_NAME, EXPECTED_INTERVAL_SECONDS);
}

runPushTokenCleanup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pushTokenCleanup] Fatal error:", err);
    process.exit(1);
  });
