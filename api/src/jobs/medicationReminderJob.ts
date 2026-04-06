/**
 * Medication Reminder Job — runs every minute via Railway cron.
 *
 * Finds pending medication reminders where scheduled_at <= now() and
 * status = 'pending', sends a push notification to the patient, marks
 * the reminder as 'sent', and handles missed reminders gracefully.
 *
 * Design:
 *   - Processes reminders in batches of 50
 *   - Reminders more than 2 hours overdue are marked 'missed' (not sent)
 *     because sending a 3-hour-old medication reminder is confusing
 *   - Push body never contains medication name (PHI) — uses generic language
 *     with a deep link to the medications screen in the data payload
 *   - Marks reminder status atomically: UPDATE WHERE status='pending' AND id=$1
 *     to prevent double-delivery if the job overlaps
 *
 * Note: the schema comment lists status as 'pending'|'taken'|'missed'|'snoozed'
 * but the column is plain text, so 'sent' is a valid additional state used
 * exclusively by this job to distinguish push-delivered from user-confirmed taken.
 */

import { db } from "../db";
import { medicationReminders, medications } from "../db/schema";
import { pushToUser } from "../lib/push";
import { and, eq, gte, lt, lte, sql } from "drizzle-orm";

// ── Constants ─────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;
const MISSED_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours in ms

// ── Core job logic ────────────────────────────────────────────────────────────

export async function runMedicationReminderJob(): Promise<void> {
  console.log(`[medicationReminderJob] Starting at ${new Date().toISOString()}`);

  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - MISSED_THRESHOLD_MS);

  // ── Step 1: Mark overdue reminders (> 2 hours past scheduled_at) as missed ──
  // These are reminders that were never delivered — sending them now would be
  // confusing ("Time to take your medication" hours late), so we silently close them.

  const missedResult = await db
    .update(medicationReminders)
    .set({ status: "missed" })
    .where(
      and(
        eq(medicationReminders.status, "pending"),
        lt(medicationReminders.scheduledAt, twoHoursAgo)
      )
    );

  const missedCount = (missedResult as unknown as { rowCount?: number }).rowCount ?? 0;
  if (missedCount > 0) {
    console.log(`[medicationReminderJob] Marked ${missedCount} overdue reminder(s) as 'missed'.`);
  }

  // ── Step 2: Fetch current pending reminders (within the 2-hour window) ──────
  // scheduledAt <= now AND scheduledAt >= now - 2h, status = 'pending'
  // ORDER BY scheduledAt ASC so we process oldest-due first.

  const pendingReminders = await db
    .select({
      id: medicationReminders.id,
      medicationId: medicationReminders.medicationId,
      userId: medicationReminders.userId,
      scheduledAt: medicationReminders.scheduledAt,
    })
    .from(medicationReminders)
    .where(
      and(
        eq(medicationReminders.status, "pending"),
        lte(medicationReminders.scheduledAt, now),
        gte(medicationReminders.scheduledAt, twoHoursAgo)
      )
    )
    .orderBy(sql`${medicationReminders.scheduledAt} ASC`)
    .limit(BATCH_SIZE);

  if (pendingReminders.length === 0) {
    console.log("[medicationReminderJob] No pending reminders to deliver. Done.");
    return;
  }

  console.log(
    `[medicationReminderJob] Processing ${pendingReminders.length} pending reminder(s).`
  );

  // ── Step 3: Deliver push notifications in a Promise.allSettled batch ─────────

  let sentCount = 0;
  let failedCount = 0;

  const results = await Promise.allSettled(
    pendingReminders.map((reminder) => deliverReminder(reminder))
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value) sentCount++;
    } else {
      failedCount++;
      console.error(
        "[medicationReminderJob] Reminder delivery error:",
        result.reason instanceof Error ? result.reason.message : String(result.reason)
      );
    }
  }

  console.log(
    `[medicationReminderJob] Done. Sent: ${sentCount}, Failed: ${failedCount}, Missed (overdue): ${missedCount}`
  );
}

// ── Per-reminder delivery ─────────────────────────────────────────────────────

async function deliverReminder(reminder: {
  id: string;
  medicationId: string;
  userId: string;
  scheduledAt: Date | null;
}): Promise<boolean> {
  // Atomically claim the reminder: only update if it is still 'pending'.
  // This prevents double-delivery in the unlikely event two job instances overlap.
  const updateResult = await db
    .update(medicationReminders)
    .set({ status: "sent" })
    .where(
      and(
        eq(medicationReminders.id, reminder.id),
        eq(medicationReminders.status, "pending")
      )
    );

  const rowsAffected = (updateResult as unknown as { rowCount?: number }).rowCount ?? 0;
  if (rowsAffected === 0) {
    // Another instance already processed this reminder — skip silently.
    return false;
  }

  // PHI rule: never include medication name or dosage in the push body.
  // The deep-link data payload carries the reminderId so the app can surface
  // the correct medication when the user taps the notification.
  await pushToUser(reminder.userId, {
    title: "💊 Medication Reminder",
    body: "Time to take your medication. Tap to confirm.",
    data: {
      screen: "health",
      tab: "medications",
      reminderId: reminder.id,
    },
    sound: "default",
    priority: "default",
  });

  console.log(
    `[medicationReminderJob] Delivered reminder ${reminder.id} to user ${reminder.userId} ` +
    `(scheduledAt=${reminder.scheduledAt?.toISOString() ?? "unknown"})`
  );

  return true;
}

// ── Entry point ───────────────────────────────────────────────────────────────
// Guard with import.meta.main so this file can be safely imported as a module
// without auto-running the full cycle and calling process.exit().

if (import.meta.main) {
  runMedicationReminderJob()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(
        "[medicationReminderJob] Fatal error:",
        err instanceof Error ? err.message : String(err)
      );
      process.exit(1);
    });
}
