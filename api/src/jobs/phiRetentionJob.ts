/**
 * PHI Data Retention Job — runs once per day at 02:00 UTC via Railway cron.
 *
 * Enforces configurable retention windows for health data tables, permanently
 * deleting rows that exceed the applicable retention period. The following
 * tables are NEVER touched by this job (permanent records):
 *   users, families, audit_trail, access_audit_logs, patient_consents
 *
 * Retention schedule:
 *   vitals               10 years  (recorded_at)   — personal health data
 *   symptoms             10 years  (recorded_at)
 *   moods                 7 years  (recorded_at)    — less clinically sensitive
 *   health_timeline      10 years  (occurred_at)
 *   ppg_embeddings        2 years  (created_at)     — biometric, shorter retention
 *   medication_reminders  3 years  (scheduled_at)   — operational data only
 *   anomalies             5 years  (created_at)
 *
 * Design notes:
 *   - Advisory lock (pg_try_advisory_lock) prevents double-runs if Railway
 *     fires two instances simultaneously.
 *   - Raw SQL via Drizzle's sql tag — no ORM abstraction needed for simple DELETEs.
 *   - rowCount is read from the driver result after each delete.
 *   - recordHeartbeat is called at the end so /health and monitors can detect
 *     silent job failures.
 */

import { sql } from "drizzle-orm";
import { db } from "../db";
import { recordHeartbeat, recordHeartbeatError } from "../lib/heartbeat";
import { logger } from "../lib/logger.js";
import { acquireJobLock, releaseJobLock } from "../lib/jobLock.js";

// ── Retention intervals (PostgreSQL interval strings) ────────────────────────
const RETENTION_RULES: Array<{
  table: string;
  dateColumn: string;
  interval: string;
  years: number;
}> = [
  { table: "vitals",               dateColumn: "recorded_at",  interval: "10 years", years: 10 },
  { table: "symptoms",             dateColumn: "recorded_at",  interval: "10 years", years: 10 },
  { table: "moods",                dateColumn: "recorded_at",  interval: "7 years",  years: 7  },
  { table: "health_timeline",      dateColumn: "occurred_at",  interval: "10 years", years: 10 },
  { table: "ppg_embeddings",       dateColumn: "created_at",   interval: "2 years",  years: 2  },
  { table: "medication_reminders", dateColumn: "scheduled_at", interval: "3 years",  years: 3  },
  { table: "anomalies",            dateColumn: "created_at",   interval: "5 years",  years: 5  },
];

// Expected run interval: 86400 seconds (24 hours)
const EXPECTED_INTERVAL_SECONDS = 86_400;

// ── Entry point ───────────────────────────────────────────────────────────────

async function runPhiRetention(): Promise<void> {
  // Distributed lock via job_locks table — works with Neon HTTP driver.
  // (pg_try_advisory_lock is session-scoped and does not work with HTTP connections.)
  const lockToken = await acquireJobLock('phiRetentionJob', 7200)
  if (!lockToken) {
    logger.warn("[phiRetention] Another instance is running — skipping.");
    return;
  }

  try {
    await processRetention();
    await recordHeartbeat("phiRetentionJob", EXPECTED_INTERVAL_SECONDS);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "[phiRetention] Fatal error during retention sweep");
    await recordHeartbeatError("phiRetentionJob", EXPECTED_INTERVAL_SECONDS, message);
    throw err;
  } finally {
    await releaseJobLock('phiRetentionJob', lockToken);
  }
}

// ── Core logic ────────────────────────────────────────────────────────────────

async function processRetention(): Promise<void> {
  logger.info("[phiRetention] Starting PHI data retention sweep.");

  const summary: Array<{ table: string; deleted: number; years: number }> = [];

  for (const rule of RETENTION_RULES) {
    try {
      const deleted = await deleteExpiredRows(rule.table, rule.dateColumn, rule.interval);
      summary.push({ table: rule.table, deleted, years: rule.years });
      logger.info(
        { table: rule.table, deleted, years: rule.years },
        "[phiRetention] table sweep complete"
      );
    } catch (err) {
      // Log per-table errors but continue with remaining tables so a single
      // table failure does not abort the entire retention sweep.
      logger.error(
        { table: rule.table, err },
        "[phiRetention] Error deleting from table"
      );
      summary.push({ table: rule.table, deleted: -1, years: rule.years });
    }
  }

  const totalDeleted = summary
    .filter((r) => r.deleted >= 0)
    .reduce((acc, r) => acc + r.deleted, 0);

  const errorCount = summary.filter((r) => r.deleted < 0).length;

  logger.info(
    { totalDeleted, tables: RETENTION_RULES.length, errors: errorCount },
    "[phiRetention] Sweep complete"
  );
}

// ── Delete helper ─────────────────────────────────────────────────────────────

async function deleteExpiredRows(
  table: string,
  dateColumn: string,
  interval: string
): Promise<number> {
  // Raw SQL delete — Drizzle's sql tag handles parameterisation.
  // Identifier injection is safe here because both `table` and `dateColumn`
  // are sourced exclusively from the hard-coded RETENTION_RULES constant above,
  // never from user input.
  const result = await db.execute(
    sql.raw(
      `DELETE FROM ${table} WHERE ${dateColumn} < now() - interval '${interval}'`
    )
  );
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}

// ── Run ───────────────────────────────────────────────────────────────────────

runPhiRetention()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "[phiRetention] Fatal error");
    process.exit(1);
  });
