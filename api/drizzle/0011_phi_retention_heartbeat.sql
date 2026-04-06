-- Migration 0011: Add phiRetentionJob to job_heartbeats
INSERT INTO job_heartbeats (job_name, last_run_at, expected_interval_seconds, status)
VALUES ('phiRetentionJob', '1970-01-01 00:00:00+00', 86400, 'pending')
ON CONFLICT (job_name) DO NOTHING;
