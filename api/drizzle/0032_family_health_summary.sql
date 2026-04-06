-- Family health summary: materialized denormalization for caregiver dashboard.
-- Replaces N×8 per-member queries with a single query over this table.
CREATE TABLE family_health_summary (
  id                        TEXT PRIMARY KEY,
  family_id                 TEXT NOT NULL,
  user_id                   TEXT NOT NULL,
  last_vital_at             TIMESTAMPTZ,
  last_symptom_at           TIMESTAMPTZ,
  last_mood_at              TIMESTAMPTZ,
  last_medication_taken_at  TIMESTAMPTZ,
  vhi_score                 NUMERIC,
  vhi_risk                  TEXT,
  vhi_updated_at            TIMESTAMPTZ,
  active_alert_count        INTEGER DEFAULT 0,
  critical_alert_count      INTEGER DEFAULT 0,
  medication_adherence_rate NUMERIC,
  updated_at                TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX family_health_summary_family_user_idx ON family_health_summary(family_id, user_id);
CREATE INDEX family_health_summary_family_updated_idx ON family_health_summary(family_id, updated_at DESC);

-- Initialize rows for all existing family members so the summary is immediately queryable.
INSERT INTO family_health_summary (id, family_id, user_id)
SELECT gen_random_uuid()::text, family_id, user_id
FROM family_members
ON CONFLICT DO NOTHING;
