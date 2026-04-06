CREATE TABLE IF NOT EXISTS personalized_thresholds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_type       VARCHAR(50) NOT NULL,
  alert_low         NUMERIC(10,4),
  alert_high        NUMERIC(10,4),
  critical_low      NUMERIC(10,4),
  critical_high     NUMERIC(10,4),
  set_by            VARCHAR(20) NOT NULL DEFAULT 'user',
  set_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ,
  overrides_default BOOLEAN NOT NULL DEFAULT true,
  notes             VARCHAR(500),
  UNIQUE(user_id, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_thresholds_user
  ON personalized_thresholds(user_id);
