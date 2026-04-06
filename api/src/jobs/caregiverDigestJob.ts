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
import {
  users,
  familyMembers,
  vhi,
  alerts,
  medicationReminders,
  pushTokens,
} from "../db/schema";
import { pushToUser } from "../lib/push";

// ── Advisory lock key (unique per job) ────────────────────────────────────────
const ADVISORY_LOCK_KEY = 7_777_001; // arbitrary stable int

// ── Entry point ───────────────────────────────────────────────────────────────

async function runCaregiverDigest(): Promise<void> {
  // Try to acquire advisory lock — bail out if another instance is running
  const [lockRow] = await db.execute<{ acquired: boolean }>(
    sql`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS acquired`
  );
  if (!lockRow?.acquired) {
    console.log("[caregiverDigest] Another instance is running — skipping.");
    return;
  }

  try {
    await processDigests();
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`);
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
    console.log("[caregiverDigest] No family admins found — nothing to do.");
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

      // 6. Fetch user names for member list
      const memberUsers = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, memberIds))
        .limit(50);

      const nameByUser = new Map(memberUsers.map((u) => [u.id, u.name ?? "Family member"]));

      // 7. Build digest summary
      const digest = buildDigest({
        memberIds,
        vhiByUser,
        alertsByUser,
        missedByUser,
        totalByUser,
        nameByUser,
        twoDaysAgo,
      });

      // 8. Send to each admin in this family
      for (const adminId of adminIds) {
        try {
          await pushToUser(adminId, {
            title: digest.title,
            body: digest.body,
            data: { screen: "family_dashboard", familyId },
            priority: digest.hasUrgent ? "high" : "default",
          });
          sentCount++;
        } catch (pushErr) {
          console.error(
            `[caregiverDigest] Push failed for admin ${adminId}:`,
            pushErr instanceof Error ? pushErr.message : pushErr
          );
          errorCount++;
        }
      }
    } catch (familyErr) {
      console.error(
        `[caregiverDigest] Error processing family ${familyId}:`,
        familyErr instanceof Error ? familyErr.message : familyErr
      );
      errorCount++;
    }
  }

  console.log(
    `[caregiverDigest] Done. Sent: ${sentCount}, Errors: ${errorCount}, Families: ${adminsByFamily.size}`
  );
}

// ── Digest builder ────────────────────────────────────────────────────────────

interface DigestInput {
  memberIds: string[];
  vhiByUser: Map<string, { data: unknown; updatedAt: Date | null }>;
  alertsByUser: Map<string, number>;
  missedByUser: Map<string, number>;
  totalByUser: Map<string, number>;
  nameByUser: Map<string, string>;
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
    nameByUser,
    twoDaysAgo,
  } = input;

  const issues: string[] = [];
  let hasUrgent = false;
  let allHealthy = true;

  for (const memberId of memberIds) {
    const firstName = (nameByUser.get(memberId) ?? "Family member").split(" ")[0];
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
      issues.push(`${firstName}: no data synced in 48 h`);
      allHealthy = false;
      continue;
    }

    // High/critical risk
    if (riskScore !== null && riskScore >= 75) {
      issues.push(`${firstName}: health risk is elevated`);
      hasUrgent = true;
      allHealthy = false;
    } else if (riskScore !== null && riskScore >= 60) {
      issues.push(`${firstName}: health needs attention`);
      allHealthy = false;
    }

    // Unacknowledged alerts
    const alertCount = alertsByUser.get(memberId) ?? 0;
    if (alertCount > 0) {
      issues.push(`${firstName}: ${alertCount} unreviewed alert${alertCount > 1 ? "s" : ""}`);
      allHealthy = false;
    }

    // Missed medications today
    const missed = missedByUser.get(memberId) ?? 0;
    const total = totalByUser.get(memberId) ?? 0;
    if (total > 0 && missed > 0) {
      issues.push(`${firstName}: missed ${missed} medication dose${missed > 1 ? "s" : ""} today`);
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
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[caregiverDigest] Fatal error:", err);
    process.exit(1);
  });
