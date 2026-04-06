CREATE TABLE IF NOT EXISTS user_baselines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_type      VARCHAR(50) NOT NULL,
  mean             NUMERIC(10,4) NOT NULL,
  std_dev          NUMERIC(10,4) NOT NULL,
  p10              NUMERIC(10,4),
  p25              NUMERIC(10,4),
  p75              NUMERIC(10,4),
  p90              NUMERIC(10,4),
  sample_count     INTEGER NOT NULL,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_start_at  TIMESTAMPTZ NOT NULL,
  window_end_at    TIMESTAMPTZ NOT NULL,
  confidence_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  is_stable        BOOLEAN NOT NULL DEFAULT false,
  recompute_reason VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_baselines_user_metric
  ON user_baselines(user_id, metric_type);
