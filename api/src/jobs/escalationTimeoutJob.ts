/**
 * Escalation Timeout Job — runs every 5 minutes via Railway cron.
 *
 * Finds critical alerts that have NOT been acknowledged within their
 * escalation window and either:
 *   1. Sends a re-notification to the patient + family admins
 *   2. After 3 re-notifications with no response, marks the alert as
 *      requiring emergency contact outreach (sets metadata.needsEmergencyContact = true)
 *      and fires a webhook event "alert.escalation_timeout"
 *
 * Escalation windows by severity:
 *   critical: 15 minutes before first re-notify, then every 15 min (max 3 times)
 *   high:     30 minutes before first re-notify, then every 30 min (max 2 times)
 *   medium:   never re-notified automatically
 *   low:      never re-notified automatically
 */

import { db } from "../db";
import { alerts } from "../db/schema";
import { dispatchWebhookEvent } from "../lib/webhookDispatcher";
import {
  pushToUserAndFamilyAdmins,
} from "../lib/push";
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

// ── Escalation policy ─────────────────────────────────────────────────────────

const ESCALATION_POLICY: Record<
  "critical" | "high",
  { windowMs: number; maxCount: number }
> = {
  critical: { windowMs: 15 * 60 * 1000, maxCount: 3 },
  high:     { windowMs: 30 * 60 * 1000, maxCount: 2 },
};

// ── Concurrency guard ─────────────────────────────────────────────────────────
// Railway cron runs each invocation as a fresh Bun process in the same container.
// A lock file prevents a new run from starting if a previous one is still active.
// If the lock is older than 10 minutes (a stuck run), it is treated as stale and removed.

const LOCK_FILE = path.join("/tmp", "escalation_timeout.lock");
const LOCK_STALE_MS = 10 * 60 * 1000; // 10 minutes

function acquireLock(): boolean {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const stat = fs.statSync(LOCK_FILE);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs < LOCK_STALE_MS) {
        console.warn(
          `[escalationTimeoutJob] Already running (lock age: ${Math.round(ageMs / 1000)}s). Skipping.`
        );
        return false;
      }
      console.warn(
        `[escalationTimeoutJob] Stale lock detected (age: ${Math.round(ageMs / 1000)}s). Overriding.`
      );
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid));
    return true;
  } catch (err: unknown) {
    console.warn(
      "[escalationTimeoutJob] Failed to acquire lock file — proceeding without guard:",
      err instanceof Error ? err.message : String(err)
    );
    return true; // Non-fatal: proceed if file I/O fails
  }
}

function releaseLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  } catch (err: unknown) {
    console.warn(
      "[escalationTimeoutJob] Failed to release lock file:",
      err instanceof Error ? err.message : String(err)
    );
  }
}

// ── Metadata shape ────────────────────────────────────────────────────────────

interface AlertMetadata {
  escalationCount?: number;
  lastEscalatedAt?: string; // ISO string
  needsEmergencyContact?: boolean;
  [key: string]: unknown;
}

// ── Core job logic ────────────────────────────────────────────────────────────

export async function runEscalationTimeoutJob(): Promise<void> {
  if (!acquireLock()) return;

  console.log(`[escalationTimeoutJob] Starting at ${new Date().toISOString()}`);

  try {
    const now = Date.now();

    // Find the oldest threshold we care about (critical = 15 min, high = 30 min).
    // We fetch all unresolved, unacknowledged critical/high alerts created at
    // least 15 minutes ago in a single query, then apply per-severity logic in JS.
    const minWindowMs = Math.min(
      ESCALATION_POLICY.critical.windowMs,
      ESCALATION_POLICY.high.windowMs
    );
    const oldestThreshold = new Date(now - minWindowMs);

    const candidateAlerts = await db
      .select()
      .from(alerts)
      .where(
        and(
          eq(alerts.isAcknowledged, false),
          isNull(alerts.resolvedAt),
          inArray(alerts.severity, ["critical", "high"]),
          // createdAt <= oldestThreshold (older than the shortest window)
          lte(alerts.createdAt, oldestThreshold)
        )
      );

    console.log(
      `[escalationTimeoutJob] Found ${candidateAlerts.length} candidate alert(s).`
    );

    let renotifiedCount = 0;
    let flaggedCount = 0;
    let skippedCount = 0;

    // Process in batches of 20 to keep DB connection pressure manageable.
    const BATCH_SIZE = 20;
    for (let i = 0; i < candidateAlerts.length; i += BATCH_SIZE) {
      const batch = candidateAlerts.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map((alert) => processAlert(alert, now))
      ).then((results) => {
        for (const r of results) {
          if (r.status === "fulfilled") {
            if (r.value === "renotified") renotifiedCount++;
            else if (r.value === "flagged") flaggedCount++;
            else skippedCount++;
          } else {
            console.error(
              "[escalationTimeoutJob] Alert processing error:",
              r.reason instanceof Error ? r.reason.message : String(r.reason)
            );
          }
        }
      });
    }

    console.log(
      `[escalationTimeoutJob] Done. Re-notified: ${renotifiedCount}, Flagged for emergency: ${flaggedCount}, Skipped: ${skippedCount}`
    );
  } finally {
    // Always release the lock — even if the DB query throws.
    releaseLock();
  }
}

// ── Per-alert processor ───────────────────────────────────────────────────────

async function processAlert(
  alert: typeof alerts.$inferSelect,
  now: number
): Promise<"renotified" | "flagged" | "skipped"> {
  const severity = alert.severity as "critical" | "high";

  // Only process severities we have a policy for (guards against future enum additions)
  if (!(severity in ESCALATION_POLICY)) return "skipped";

  const policy = ESCALATION_POLICY[severity];
  const meta: AlertMetadata = (alert.metadata as AlertMetadata) ?? {};

  const escalationCount = meta.escalationCount ?? 0;
  const lastEscalatedAt = meta.lastEscalatedAt
    ? new Date(meta.lastEscalatedAt).getTime()
    : (alert.createdAt?.getTime() ?? now); // treat createdAt as the initial "last escalated" baseline

  // ── Already flagged for emergency contact — nothing more to do ────────────
  if (meta.needsEmergencyContact === true) return "skipped";

  // ── Determine if enough time has passed since the last escalation ─────────
  const msSinceLastEscalation = now - lastEscalatedAt;
  if (msSinceLastEscalation < policy.windowMs) return "skipped";

  // ── Max re-notifications reached: flag for emergency contact ──────────────
  if (escalationCount >= policy.maxCount) {
    await flagForEmergencyContact(alert, meta, severity);
    return "flagged";
  }

  // ── Send re-notification ──────────────────────────────────────────────────
  await sendEscalationNotification(alert, meta, escalationCount + 1, policy.maxCount, severity);
  return "renotified";
}

// ── Re-notification sender ────────────────────────────────────────────────────

async function sendEscalationNotification(
  alert: typeof alerts.$inferSelect,
  currentMeta: AlertMetadata,
  newCount: number,
  maxCount: number,
  severity: "critical" | "high"
): Promise<void> {
  const remainingAttempts = maxCount - newCount;

  // PHI rule: never include raw health values or patient names in push notification bodies.
  const userMsg = {
    title: `Unacknowledged ${severity} alert`,
    body: `You have an unacknowledged ${severity} alert that requires your attention. Please review it now.`,
    data: { screen: "vitals", alertId: alert.id, type: alert.type, severity },
    priority: "high" as const,
    sound: "default" as const,
  };

  const adminMsg = {
    title: `Family member has an unacknowledged ${severity} alert`,
    body: `A family member has an unacknowledged ${severity} alert. Escalation ${newCount}/${maxCount}.`,
    data: { screen: "family_dashboard", alertId: alert.id, userId: alert.userId, type: alert.type, severity },
    priority: "high" as const,
    sound: "default" as const,
  };

  // Send to patient + all family admins concurrently
  await pushToUserAndFamilyAdmins(alert.userId, userMsg, adminMsg);

  // Persist updated escalation metadata
  const updatedMeta: AlertMetadata = {
    ...currentMeta,
    escalationCount: newCount,
    lastEscalatedAt: new Date().toISOString(),
  };

  await db
    .update(alerts)
    .set({ metadata: updatedMeta })
    .where(eq(alerts.id, alert.id));

  console.log(
    `[escalationTimeoutJob] Re-notified for alert ${alert.id} (userId=${alert.userId}, severity=${severity}, escalation=${newCount}/${maxCount}, remaining=${remainingAttempts})`
  );
}

// ── Emergency contact flagger ─────────────────────────────────────────────────

async function flagForEmergencyContact(
  alert: typeof alerts.$inferSelect,
  currentMeta: AlertMetadata,
  severity: "critical" | "high"
): Promise<void> {
  const updatedMeta: AlertMetadata = {
    ...currentMeta,
    needsEmergencyContact: true,
    emergencyContactFlaggedAt: new Date().toISOString(),
  };

  await db
    .update(alerts)
    .set({ metadata: updatedMeta })
    .where(eq(alerts.id, alert.id));

  // Fire webhook so orgs / care coordinators can act on this
  await dispatchWebhookEvent("alert.escalation_timeout", alert.userId, {
    alertId: alert.id,
    userId: alert.userId,
    familyId: alert.familyId ?? null,
    type: alert.type,
    severity,
    escalationCount: currentMeta.escalationCount ?? 0,
    createdAt: alert.createdAt?.toISOString() ?? null,
    flaggedAt: updatedMeta.emergencyContactFlaggedAt,
  });

  console.log(
    `[escalationTimeoutJob] Flagged alert ${alert.id} for emergency contact outreach ` +
    `(userId=${alert.userId}, severity=${severity})`
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────
// Guard with import.meta.main so this file can be safely imported as a module
// without auto-running the full cycle and calling process.exit().

if (import.meta.main) {
  runEscalationTimeoutJob()
    .then(async () => {
      const { recordHeartbeat } = await import("../lib/heartbeat");
      await recordHeartbeat("escalation-timeout", 5 * 60);
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(
        "[escalationTimeoutJob] Fatal error:",
        err instanceof Error ? err.message : String(err)
      );
      releaseLock();
      try {
        const { recordHeartbeatError } = await import("../lib/heartbeat");
        await recordHeartbeatError("escalation-timeout", 5 * 60, err instanceof Error ? err.message : String(err));
      } catch { /* ignore */ }
      process.exit(1);
    });
}
