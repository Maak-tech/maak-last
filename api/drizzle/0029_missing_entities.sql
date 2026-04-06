-- Device readings (normalized wearable data)
CREATE TABLE device_readings (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  device_id        TEXT NOT NULL,
  device_type      TEXT NOT NULL,
  reading_type     TEXT NOT NULL,
  value            NUMERIC,
  value_json       JSONB,
  unit             TEXT,
  recorded_at      TIMESTAMPTZ NOT NULL,
  synced_at        TIMESTAMPTZ DEFAULT now(),
  source_activity_id TEXT,
  quality          TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX device_readings_user_device_time_idx ON device_readings(user_id, device_type, recorded_at DESC);
CREATE INDEX device_readings_user_type_time_idx ON device_readings(user_id, reading_type, recorded_at DESC);
CREATE UNIQUE INDEX device_readings_source_dedup ON device_readings(device_id, reading_type, recorded_at) WHERE source_activity_id IS NOT NULL;

-- Fall events
CREATE TABLE fall_events (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  detected_at         TIMESTAMPTZ NOT NULL,
  detection_source    TEXT NOT NULL DEFAULT 'wearable',
  severity            TEXT,
  location_context    TEXT,
  injury_reported     BOOLEAN DEFAULT false,
  consciousness_lost  BOOLEAN DEFAULT false,
  responded_at        TIMESTAMPTZ,
  responded_by        TEXT,
  alert_sent          BOOLEAN DEFAULT false,
  alert_sent_at       TIMESTAMPTZ,
  accelerometer_data  JSONB,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX fall_events_user_time_idx ON fall_events(user_id, detected_at DESC);
CREATE INDEX fall_events_unresponded_idx ON fall_events(user_id) WHERE responded_at IS NULL;

-- Health trends (precomputed cache)
CREATE TABLE health_trends (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  metric_type      TEXT NOT NULL,
  period_type      TEXT NOT NULL,
  period_start     TIMESTAMPTZ NOT NULL,
  period_end       TIMESTAMPTZ NOT NULL,
  avg_value        NUMERIC,
  min_value        NUMERIC,
  max_value        NUMERIC,
  std_dev          NUMERIC,
  sample_count     INTEGER NOT NULL DEFAULT 0,
  trend            TEXT,
  trend_slope      NUMERIC,
  trend_confidence NUMERIC,
  computed_at      TIMESTAMPTZ DEFAULT now(),
  valid_until      TIMESTAMPTZ
);
CREATE UNIQUE INDEX health_trends_user_metric_period_idx ON health_trends(user_id, metric_type, period_type, period_start);
CREATE INDEX health_trends_stale_idx ON health_trends(valid_until);

-- Health goals
CREATE TABLE health_goals (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  metric_type    TEXT NOT NULL,
  goal_type      TEXT NOT NULL,
  target_value   NUMERIC,
  target_min     NUMERIC,
  target_max     NUMERIC,
  unit           TEXT,
  deadline       TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'active',
  achieved_at    TIMESTAMPTZ,
  progress_json  JSONB,
  set_by_user_id TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX health_goals_user_active_idx ON health_goals(user_id, status);

-- Caregiver notes (replaces the old minimal schema)
CREATE TABLE IF NOT EXISTS caregiver_notes (
  id          TEXT PRIMARY KEY,
  author_id   TEXT NOT NULL,
  subject_id  TEXT NOT NULL,
  family_id   TEXT NOT NULL,
  content     TEXT NOT NULL,
  category    TEXT,
  visibility  TEXT NOT NULL DEFAULT 'care_team',
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
-- Drop old columns if the table already existed with the legacy schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caregiver_notes' AND column_name = 'member_id') THEN
    ALTER TABLE caregiver_notes
      DROP COLUMN IF EXISTS member_id,
      DROP COLUMN IF EXISTS caregiver_id,
      DROP COLUMN IF EXISTS caregiver_name,
      DROP COLUMN IF EXISTS note,
      DROP COLUMN IF EXISTS tags;
    ALTER TABLE caregiver_notes
      ADD COLUMN IF NOT EXISTS author_id   TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS subject_id  TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS family_id   TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS content     TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS category    TEXT,
      ADD COLUMN IF NOT EXISTS visibility  TEXT NOT NULL DEFAULT 'care_team',
      ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS caregiver_notes_subject_time_idx ON caregiver_notes(subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS caregiver_notes_author_idx ON caregiver_notes(author_id);

-- Notification rules (configurable alert thresholds)
CREATE TABLE notification_rules (
  id                         TEXT PRIMARY KEY,
  user_id                    TEXT NOT NULL,
  set_by_user_id             TEXT NOT NULL,
  metric_type                TEXT NOT NULL,
  condition                  TEXT NOT NULL,
  threshold                  NUMERIC NOT NULL,
  threshold_unit             TEXT,
  severity                   TEXT NOT NULL DEFAULT 'warning',
  notify_patient             BOOLEAN DEFAULT true,
  notify_caregivers          BOOLEAN DEFAULT true,
  notify_emergency_contacts  BOOLEAN DEFAULT false,
  cooldown_minutes           INTEGER DEFAULT 60,
  last_triggered_at          TIMESTAMPTZ,
  is_active                  BOOLEAN DEFAULT true,
  created_at                 TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX notification_rules_user_metric_idx ON notification_rules(user_id, metric_type);
CREATE INDEX notification_rules_active_idx ON notification_rules(is_active, user_id) WHERE is_active = true;

-- Notification queue (reliable async delivery)
CREATE TABLE notification_queue (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  channel          TEXT NOT NULL,
  title            TEXT,
  body             TEXT NOT NULL,
  data_json        JSONB,
  idempotency_key  TEXT UNIQUE,
  status           TEXT NOT NULL DEFAULT 'pending',
  attempts         INTEGER NOT NULL DEFAULT 0,
  max_attempts     INTEGER NOT NULL DEFAULT 3,
  scheduled_for    TIMESTAMPTZ DEFAULT now(),
  processed_at     TIMESTAMPTZ,
  error_message    TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX notification_queue_pending_idx ON notification_queue(status, scheduled_for) WHERE status = 'pending';
