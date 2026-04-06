-- Migration 0013: Seed dnaParsingJob heartbeat row
-- dnaParsingJob is a triggered job (not scheduled) so it was omitted from 0006.
-- Adding it here so GET /health?jobs=true can surface it as "not yet run" rather
-- than silently missing from the jobs list.

INSERT INTO job_heartbeats (job_name, last_run_at, expected_interval_seconds, status, run_count)
VALUES ('dnaParsingJob', '1970-01-01 00:00:00+00', 3600, 'ok', 0)
ON CONFLICT (job_name) DO NOTHING;
