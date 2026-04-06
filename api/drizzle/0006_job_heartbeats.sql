-- Migration 0006: Job heartbeats table
-- Tracks the last successful run time of every Railway cron job.
-- Used by GET /health?jobs=true and the job-heartbeat-monitor job
-- to detect silently-stopped cron jobs before they affect users.

CREATE TABLE IF NOT EXISTS "job_heartbeats" (
  "job_name"                  TEXT        NOT NULL PRIMARY KEY,
  "last_run_at"               TIMESTAMPTZ NOT NULL,
  "expected_interval_seconds" INTEGER     NOT NULL,
  "status"                    TEXT        NOT NULL DEFAULT 'ok',
  "error_message"             TEXT,
  "run_count"                 INTEGER     NOT NULL DEFAULT 1
);

-- Seed known jobs so the heartbeat monitor can detect them as stale
-- even before they have run for the first time (e.g. after a deploy).
-- last_run_at is set to epoch so the first health check immediately
-- reports them as "not yet run" rather than "healthy".
INSERT INTO "job_heartbeats" ("job_name", "last_run_at", "expected_interval_seconds", "status", "run_count")
VALUES
  ('vhi-cycle',              '1970-01-01 00:00:00+00', 900,  'ok', 0),
  ('escalation-timeout',     '1970-01-01 00:00:00+00', 300,  'ok', 0),
  ('medication-reminder',    '1970-01-01 00:00:00+00', 60,   'ok', 0),
  ('caregiver-digest',       '1970-01-01 00:00:00+00', 86400,'ok', 0),
  ('wearable-staleness',     '1970-01-01 00:00:00+00', 14400,'ok', 0),
  ('job-heartbeat-monitor',  '1970-01-01 00:00:00+00', 300,  'ok', 0),
  ('webhook-retry-worker',   '1970-01-01 00:00:00+00', 300,  'ok', 0),
  ('outcome-resolver',       '1970-01-01 00:00:00+00', 86400,'ok', 0)
ON CONFLICT ("job_name") DO NOTHING;
