/**
 * Job Heartbeat Monitor — runs every 5 minutes via Railway cron.
 *
 * Checks the job_heartbeats table and fires an alert if any registered job
 * has not pinged within (expectedIntervalSeconds * 2) — i.e. it has missed
 * at least one full cycle.
 *
 * This job itself records its own heartbeat, so if IT stops firing, external
 * uptime monitors (Better Uptime, UptimeRobot) can detect it via the
 * GET /health?jobs=true endpoint.
 *
 * Stale job action:
 *   - Console error (picked up by Railway logs + any log drain)
 *   - Creates a system_alert in the alerts table for operator review
 *   - Does NOT send push notifications to users — this is an ops concern
 *
 * Alert dedup: a stale alert for the same job is not re-created if one
 * already exists (isAcknowledged=false) within the last hour.
 */

import { db } from "../db";
import { and, eq, gte, sql } from "drizzle-orm";
import { jobHeartbeats, alerts } from "../db/schema";
import { recordHeartbeat } from "../lib/heartbeat";

const JOB_NAME = "job-heartbeat-monitor";
const EXPECTED_INTERVAL_SECONDS = 5 * 60; // 5 minutes

async function runJobHeartbeatMonitor(): Promise<void> {
  const now = new Date();

  // 1. Read all registered job heartbeats
  const rows = await db.select().from(jobHeartbeats);

  let staleCount = 0;

  for (const row of rows) {
    // Skip this job itself — it obviously hasn't run yet this cycle
    if (row.jobName === JOB_NAME) continue;

    // A job is stale if it hasn't run within 2× its expected interval
    const stalenessThresholdMs = row.expectedIntervalSeconds * 2 * 1000;
    const cutoff = new Date(now.getTime() - stalenessThresholdMs);

    if (row.lastRunAt >= cutoff) continue; // healthy

    const minutesAgo = Math.round((now.getTime() - row.lastRunAt.getTime()) / 60_000);
    const expectedMinutes = Math.round(row.expectedIntervalSeconds / 60);

    console.error(
      `[jobHeartbeat] STALE: "${row.jobName}" last ran ${minutesAgo}m ago ` +
        `(expected every ${expectedMinutes}m, missed ${Math.floor(minutesAgo / expectedMinutes)} cycle(s))`
    );

    staleCount++;

    // 2. Check if we already have an open stale alert for this job (1-hour dedup)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const [existing] = await db
      .select({ id: alerts.id })
      .from(alerts)
      .where(
        and(
          eq(alerts.type, "job_stale"),
          sql`${alerts.metadata}->>'jobName' = ${row.jobName}`,
          eq(alerts.isAcknowledged, false),
          gte(alerts.createdAt, oneHourAgo)
        )
      )
      .limit(1);

    if (existing) continue; // already alerted

    // 3. Insert operator alert — no userId (system-level alert)
    await db.insert(alerts).values({
      id: crypto.randomUUID(),
      userId: "system",
      type: "job_stale",
      severity: "high",
      title: `Job stopped: ${row.jobName}`,
      body:
        `The "${row.jobName}" cron job last ran ${minutesAgo} minutes ago. ` +
        `Expected every ${expectedMinutes} minute(s). ` +
        (row.status === "error" && row.errorMessage
          ? `Last error: ${row.errorMessage.slice(0, 200)}`
          : "No error recorded — job may have stopped silently."),
      isAcknowledged: false,
      metadata: {
        jobName: row.jobName,
        lastRunAt: row.lastRunAt.toISOString(),
        expectedIntervalSeconds: row.expectedIntervalSeconds,
        minutesAgo,
        lastStatus: row.status,
      },
    });
  }

  if (staleCount > 0) {
    console.error(`[jobHeartbeat] ${staleCount} stale job(s) detected.`);
  } else {
    console.log(`[jobHeartbeat] All ${rows.length} registered jobs are healthy.`);
  }

  // 4. Record own heartbeat
  await recordHeartbeat(JOB_NAME, EXPECTED_INTERVAL_SECONDS);
}

runJobHeartbeatMonitor()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[jobHeartbeat] Fatal error:", err);
    process.exit(1);
  });
