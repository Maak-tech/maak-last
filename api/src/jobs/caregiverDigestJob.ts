/**
 * Caregiver Daily Digest — runs once per day at 07:00 UTC via Railway cron.
 *
 * For every family admin, sends a single push notification summarising the
 * health status of each enrolled family member:
 *   • Members at HIGH or CRITICAL risk (VHI composite ≥ 60)
 *   • Members with unacknowledged alerts in the last 24 h
 *   • Members with medication adherence below 80 % today
 *   • Members with no health data in the last 48 h (stale)
 *
 * Design notes:
 *   - Advisory lock (pg_try_advisory_lock) prevents double-runs if Railway
 *     fires two instances simultaneously.
 *   - Push body never includes PHI — only counts and role nouns.
 *   - One push per admin, regardless of how many family members exist.
 *   - Admins with ALL members healthy receive a positive digest, not silence,
 *     so they know the system is running.
 *   - Respects quiet hours: digest is suppressed if the admin's quiet hours
 *     overlap 07:00 UTC AND they are not high-priority.
 */

import { db } from "../db";
import { and, eq, gte, lt, inArray, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { acquireJobLock, releaseJobLock } from "../lib/jobLock.js";
import {
  users,
  familyMembers,
  vhi,
  alerts,
  medicationReminders,
} from "../db/schema";
import { enqueueNotification } from "../lib/enqueueNotification.js";
import { recordHeartbeat } from "../lib/heartbeat.js";

// ── Entry point ───────────────────────────────────────────────────────────────

async function runCaregiverDigest(): Promise<void> {
  // Distributed lock via job_locks table — works with Neon HTTP driver.
  // (pg_try_advisory_lock is session-scoped and does not work with HTTP connections.)
  const lockToken = await acquireJobLock('caregiverDigestJob', 3600)
  if (!lockToken) {
    logger.warn("[caregiverDigest] Another instance is running — skipping.");
    return;
  }

  try {
    await processDigests();
  } finally {
    await releaseJobLock('caregiverDigestJob', lockToken);
  }
}

// ── Core logic ────────────────────────────────────────────────────────────────

async function processDigests(): Promise<void> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // 1. Find all family admins that have at least one other member
  const adminRows = await db
    .select({
      adminId: familyMembers.userId,
      familyId: familyMembers.familyId,
    })
    .from(familyMembers)
    .where(eq(familyMembers.role, "admin"))
    .limit(500);

  if (adminRows.length === 0) {
    logger.info("[caregiverDigest] No family admins found — nothing to do.");
    return;
  }

  // Group admins by familyId (one admin might manage multiple families)
  const adminsByFamily = new Map<string, string[]>();
  for (const row of adminRows) {
    const existing = adminsByFamily.get(row.familyId) ?? [];
    existing.push(row.adminId);
    adminsByFamily.set(row.familyId, existing);
  }

  let sentCount = 0;
  let errorCount = 0;

  for (const [familyId, adminIds] of adminsByFamily) {
    try {
      // 2. Get all non-admin members in this family
      const memberRows = await db
        .select({ userId: familyMembers.userId, role: familyMembers.role })
        .from(familyMembers)
        .where(
          and(
            eq(familyMembers.familyId, familyId),
            sql`${familyMembers.role} != 'admin'`
          )
        )
        .limit(50);

      if (memberRows.length === 0) continue;

      const memberIds = memberRows.map((r) => r.userId);

      // 3. Fetch VHI for all members in one query
      const vhiRows = await db
        .select({
          userId: vhi.userId,
          data: vhi.data,
          updatedAt: vhi.updatedAt,
        })
        .from(vhi)
        .where(inArray(vhi.userId, memberIds));

      const vhiByUser = new Map(vhiRows.map((r) => [r.userId, r]));

      // 4. Fetch unacknowledged alerts in last 24 h for all members
      const alertRows = await db
        .select({ userId: alerts.userId, severity: alerts.severity })
        .from(alerts)
        .where(
          and(
            inArray(alerts.userId, memberIds),
            eq(alerts.isAcknowledged, false),
            gte(alerts.createdAt, yesterday)
          )
        )
        .limit(200);

      // Count alerts per user
      const alertsByUser = new Map<string, number>();
      for (const a of alertRows) {
        alertsByUser.set(a.userId, (alertsByUser.get(a.userId) ?? 0) + 1);
      }

      // 5. Fetch medication reminders for today — count missed per user
      const todayStart = new Date(now);
      todayStart.setUTCHours(0, 0, 0, 0);

      const reminderRows = await db
        .select({
          userId: medicationReminders.userId,
          status: medicationReminders.status,
        })
        .from(medicationReminders)
        .where(
          and(
            inArray(medicationReminders.userId, memberIds),
            gte(medicationReminders.scheduledAt, todayStart),
            lt(medicationReminders.scheduledAt, now)
          )
        )
        .limit(500);

      const missedByUser = new Map<string, number>();
      const totalByUser = new Map<string, number>();
      for (const r of reminderRows) {
        totalByUser.set(r.userId, (totalByUser.get(r.userId) ?? 0) + 1);
        if (r.status === "missed") {
          missedByUser.set(r.userId, (missedByUser.get(r.userId) ?? 0) + 1);
        }
      }

      // 6. Build digest summary
      const digest = buildDigest({
        memberIds,
        vhiByUser,
        alertsByUser,
        missedByUser,
        totalByUser,
        twoDaysAgo,
      });

      // 8. Send to each admin in this family
      for (const adminId of adminIds) {
        try {
          // Quiet hours check: suppress non-critical digest during user's quiet hours
          const [adminUser] = await db
            .select({ preferences: users.preferences })
            .from(users)
            .where(eq(users.id, adminId))
            .limit(1);

          const prefs = adminUser?.preferences as Record<string, unknown> | null;
          const quietHours = prefs?.quietHours as { start?: string; end?: string } | null;
          if (quietHours?.start && quietHours?.end && !digest.hasUrgent) {
            const now = new Date();
            const [startH, startM] = quietHours.start.split(':').map(Number);
            const [endH, endM] = quietHours.end.split(':').map(Number);
            const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;

            const isQuiet = startMinutes > endMinutes
              ? nowMinutes >= startMinutes || nowMinutes < endMinutes  // overnight: e.g. 22:00-07:00
              : nowMinutes >= startMinutes && nowMinutes < endMinutes; // same-day: e.g. 01:00-06:00

            if (isQuiet) {
              logger.info({ adminId, quietStart: quietHours.start, quietEnd: quietHours.end }, "[caregiverDigest] Suppressing non-urgent digest (quiet hours)");
              continue; // skip this admin
            }
          }

          await enqueueNotification({
            userId: adminId,
            title: digest.title,
            body: digest.body,
            data: { screen: "family_dashboard", familyId },
            // Deterministic key: one digest per admin per family per day.
            // This prevents duplicate digests if the cron fires twice.
            idempotencyKey: `digest:${adminId}:${familyId}:${new Date().toISOString().slice(0, 10)}`,
          });
          sentCount++;
        } catch (pushErr) {
          logger.error(
            { adminId, err: pushErr },
            "[caregiverDigest] Push failed for admin"
          );
          errorCount++;
        }
      }
    } catch (familyErr) {
      logger.error(
        { familyId, err: familyErr },
        "[caregiverDigest] Error processing family"
      );
      errorCount++;
    }
  }

  logger.info(
    { sent: sentCount, errors: errorCount, families: adminsByFamily.size },
    "[caregiverDigest] Done"
  );
}

// ── Digest builder ────────────────────────────────────────────────────────────

interface DigestInput {
  memberIds: string[];
  vhiByUser: Map<string, { data: unknown; updatedAt: Date | null }>;
  alertsByUser: Map<string, number>;
  missedByUser: Map<string, number>;
  totalByUser: Map<string, number>;
  twoDaysAgo: Date;
}

interface DigestResult {
  title: string;
  body: string;
  hasUrgent: boolean;
}

function buildDigest(input: DigestInput): DigestResult {
  const {
    memberIds,
    vhiByUser,
    alertsByUser,
    missedByUser,
    totalByUser,
    twoDaysAgo,
  } = input;

  const issues: string[] = [];
  let hasUrgent = false;
  let allHealthy = true;

  for (const memberId of memberIds) {
    const vhiRow = vhiByUser.get(memberId);
    const vhiData = vhiRow?.data as Record<string, unknown> | null;
    const compositeRisk =
      (vhiData?.currentState as Record<string, unknown> | null)?.riskScores as
        | Record<string, unknown>
        | null;
    const riskScore =
      typeof compositeRisk?.compositeRisk === "number"
        ? compositeRisk.compositeRisk
        : null;

    // Stale data — no VHI update in 48 h
    const lastUpdate = vhiRow?.updatedAt;
    if (!lastUpdate || lastUpdate < twoDaysAgo) {
      issues.push(`A family member hasn't synced health data in 48 hours`);
      allHealthy = false;
      continue;
    }

    // High/critical risk
    if (riskScore !== null && riskScore >= 75) {
      issues.push(`A family member's health risk is elevated`);
      hasUrgent = true;
      allHealthy = false;
    } else if (riskScore !== null && riskScore >= 60) {
      issues.push(`A family member's health needs attention`);
      allHealthy = false;
    }

    // Unacknowledged alerts
    const alertCount = alertsByUser.get(memberId) ?? 0;
    if (alertCount > 0) {
      issues.push(`A family member has ${alertCount} unreviewed alert${alertCount > 1 ? "s" : ""}`);
      allHealthy = false;
    }

    // Missed medications today
    const missed = missedByUser.get(memberId) ?? 0;
    const total = totalByUser.get(memberId) ?? 0;
    if (total > 0 && missed > 0) {
      issues.push(`A family member missed ${missed} medication dose${missed !== 1 ? "s" : ""} today`);
      if (missed >= 2) allHealthy = false;
    }
  }

  if (allHealthy) {
    return {
      title: "Family Health: All Clear ✓",
      body: `All ${memberIds.length} family member${memberIds.length > 1 ? "s are" : " is"} on track today. Keep it up!`,
      hasUrgent: false,
    };
  }

  // Limit body to first 3 issues to keep push readable
  const displayIssues = issues.slice(0, 3);
  const overflow = issues.length - displayIssues.length;

  const body =
    displayIssues.join(" · ") +
    (overflow > 0 ? ` · +${overflow} more` : "");

  return {
    title: hasUrgent
      ? "Family Health: Urgent Attention Needed"
      : `Family Health Update — ${issues.length} item${issues.length > 1 ? "s" : ""}`,
    body,
    hasUrgent,
  };
}

// ── Run ───────────────────────────────────────────────────────────────────────

runCaregiverDigest()
  .then(async () => {
    try { await recordHeartbeat('caregiverDigestJob', 86400) } catch (e) { logger.warn({ err: e }, '[caregiverDigest] heartbeat failed') }
    process.exit(0);
  })
  .catch((err) => {
    logger.error({ err }, "[caregiverDigest] Fatal error");
    process.exit(1);
  });
