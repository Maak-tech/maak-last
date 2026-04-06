/**
 * Job heartbeat helper.
 *
 * Every cron job calls `recordHeartbeat(jobName, expectedIntervalSeconds)` at
 * the end of a successful run. This upserts a row in the `job_heartbeats`
 * table so that the /health endpoint and external uptime monitors can detect
 * jobs that have silently stopped firing.
 *
 * Usage (at the end of any job's run function):
 *
 *   import { recordHeartbeat, recordHeartbeatError } from '../lib/heartbeat'
 *   await recordHeartbeat('vhi-cycle', 15 * 60)
 *
 * On error:
 *   await recordHeartbeatError('vhi-cycle', 15 * 60, error.message)
 *
 * Never throws — heartbeat failure must not crash the job.
 */

import { sql } from "drizzle-orm";
import { db } from "../db";

export async function recordHeartbeat(
  jobName: string,
  expectedIntervalSeconds: number
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO job_heartbeats (job_name, last_run_at, expected_interval_seconds, status, error_message, run_count)
      VALUES (${jobName}, now(), ${expectedIntervalSeconds}, 'ok', NULL, 1)
      ON CONFLICT (job_name) DO UPDATE
        SET last_run_at              = now(),
            expected_interval_seconds = ${expectedIntervalSeconds},
            status                   = 'ok',
            error_message            = NULL,
            run_count                = job_heartbeats.run_count + 1
    `);
  } catch (err) {
    // Log but never rethrow — heartbeat loss is observable, job failure is worse
    console.error(
      `[heartbeat] Failed to record heartbeat for "${jobName}":`,
      err instanceof Error ? err.message : err
    );
  }
}

export async function recordHeartbeatError(
  jobName: string,
  expectedIntervalSeconds: number,
  errorMessage: string
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO job_heartbeats (job_name, last_run_at, expected_interval_seconds, status, error_message, run_count)
      VALUES (${jobName}, now(), ${expectedIntervalSeconds}, 'error', ${errorMessage.slice(0, 500)}, 1)
      ON CONFLICT (job_name) DO UPDATE
        SET last_run_at               = now(),
            expected_interval_seconds  = ${expectedIntervalSeconds},
            status                    = 'error',
            error_message             = ${errorMessage.slice(0, 500)},
            run_count                 = job_heartbeats.run_count + 1
    `);
  } catch (err) {
    console.error(
      `[heartbeat] Failed to record error heartbeat for "${jobName}":`,
      err instanceof Error ? err.message : err
    );
  }
}
