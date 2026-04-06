CREATE TABLE IF NOT EXISTS medication_dose_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id   UUID NOT NULL,
  reminder_id     UUID,
  scheduled_for   TIMESTAMPTZ NOT NULL,
  status          VARCHAR(20) NOT NULL CHECK (status IN ('taken', 'skipped', 'late', 'missed')),
  taken_at        TIMESTAMPTZ,
  delay_minutes   INTEGER
    GENERATED ALWAYS AS (
      CASE WHEN taken_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (taken_at - scheduled_for))::INTEGER / 60
        ELSE NULL END
    ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dose_log_user_med
  ON medication_dose_log(user_id, medication_id, scheduled_for DESC);

CREATE INDEX IF NOT EXISTS idx_dose_log_status
  ON medication_dose_log(user_id, status, scheduled_for DESC);
