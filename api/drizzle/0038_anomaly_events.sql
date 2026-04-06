CREATE TABLE IF NOT EXISTS anomaly_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_type      VARCHAR(50) NOT NULL,
  reading_id       UUID,
  observed_value   NUMERIC(12,4) NOT NULL,
  baseline_mean    NUMERIC(12,4) NOT NULL,
  baseline_std_dev NUMERIC(12,4) NOT NULL,
  z_score          NUMERIC(6,3) NOT NULL,
  anomaly_class    VARCHAR(50) NOT NULL,
  requires_review  BOOLEAN NOT NULL DEFAULT false,
  detected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed        BOOLEAN NOT NULL DEFAULT false,
  dismissed_at     TIMESTAMPTZ,
  escalation_id    UUID
);

CREATE INDEX IF NOT EXISTS idx_anomalies_user_detected
  ON anomaly_events(user_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_anomalies_requires_review
  ON anomaly_events(requires_review, dismissed)
  WHERE requires_review = true AND dismissed = false;
