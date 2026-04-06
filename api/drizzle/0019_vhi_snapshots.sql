-- Migration 0019: VHI snapshots for historical analysis
-- The vhi table only stores the LATEST computation per user.
-- vhi_snapshots archives every computation so we can answer:
--   "What was the user's risk score 3 months ago?"
--   "When did risk first cross the critical threshold?"
-- The vhiCycle job should INSERT here after every successful computation.

CREATE TABLE IF NOT EXISTS "vhi_snapshots" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "user_id"       TEXT NOT NULL,
  "version"       INTEGER NOT NULL,
  "computed_at"   TIMESTAMPTZ NOT NULL,
  "data"          JSONB NOT NULL,
  "triggered_by"  TEXT,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "vhi_snapshots_user_version_idx"
  ON "vhi_snapshots" ("user_id", "version" DESC);

CREATE INDEX IF NOT EXISTS "vhi_snapshots_user_time_idx"
  ON "vhi_snapshots" ("user_id", "computed_at" DESC);

-- Prevent unbounded growth: auto-archive snapshots older than 10 years
-- (enforced by phiRetentionJob, not here)
COMMENT ON TABLE "vhi_snapshots" IS
  'Archived VHI computations. Retained for 10 years per phiRetentionJob.
   The vhi table holds only the latest snapshot per user.';
