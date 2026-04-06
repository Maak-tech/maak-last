CREATE TABLE IF NOT EXISTS job_locks (
  job_name    TEXT PRIMARY KEY,
  locked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ NOT NULL,
  instance_id TEXT NOT NULL
);
