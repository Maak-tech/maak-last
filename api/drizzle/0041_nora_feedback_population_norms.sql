CREATE TABLE IF NOT EXISTS nora_message_feedback (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id  VARCHAR(100) NOT NULL,
  message_id       VARCHAR(100) NOT NULL,
  rating           INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  flag             VARCHAR(30) CHECK (flag IN ('wrong', 'harmful', 'unhelpful', 'helpful')),
  reviewed_by_team BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nora_feedback_user
  ON nora_message_feedback(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nora_feedback_unreviewed
  ON nora_message_feedback(reviewed_by_team)
  WHERE reviewed_by_team = false;

CREATE TABLE IF NOT EXISTS population_norms (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type    VARCHAR(50) NOT NULL,
  age_band       VARCHAR(20) NOT NULL,
  biological_sex VARCHAR(10) NOT NULL,
  p5             NUMERIC(10,4),
  p25            NUMERIC(10,4),
  p50            NUMERIC(10,4),
  p75            NUMERIC(10,4),
  p95            NUMERIC(10,4),
  source         VARCHAR(200) NOT NULL,
  valid_from     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pop_norms_lookup
  ON population_norms(metric_type, age_band, biological_sex);

-- Seed evidence-based population norms (NHANES 2017-2020 / AHA 2023 guidelines)
INSERT INTO population_norms (id, metric_type, age_band, biological_sex, p5, p25, p50, p75, p95, source, valid_from)
VALUES
  -- Heart Rate (bpm) — All Adults
  (gen_random_uuid(), 'heart_rate', '18-29', 'all', 55, 62, 70, 80, 95, 'NHANES 2017-2020', '2023-01-01'),
  (gen_random_uuid(), 'heart_rate', '30-44', 'all', 56, 63, 71, 81, 96, 'NHANES 2017-2020', '2023-01-01'),
  (gen_random_uuid(), 'heart_rate', '45-59', 'all', 57, 64, 72, 82, 97, 'NHANES 2017-2020', '2023-01-01'),
  (gen_random_uuid(), 'heart_rate', '60-74', 'all', 55, 62, 71, 80, 95, 'NHANES 2017-2020', '2023-01-01'),
  (gen_random_uuid(), 'heart_rate', '75+',   'all', 54, 61, 70, 80, 94, 'NHANES 2017-2020', '2023-01-01'),
  -- Systolic BP (mmHg)
  (gen_random_uuid(), 'blood_pressure_systolic', '18-29', 'all', 100, 109, 118, 127, 138, 'AHA 2023', '2023-01-01'),
  (gen_random_uuid(), 'blood_pressure_systolic', '30-44', 'all', 104, 113, 122, 133, 145, 'AHA 2023', '2023-01-01'),
  (gen_random_uuid(), 'blood_pressure_systolic', '45-59', 'all', 108, 118, 128, 140, 155, 'AHA 2023', '2023-01-01'),
  (gen_random_uuid(), 'blood_pressure_systolic', '60-74', 'all', 112, 122, 133, 146, 162, 'AHA 2023', '2023-01-01'),
  (gen_random_uuid(), 'blood_pressure_systolic', '75+',   'all', 116, 126, 138, 150, 166, 'AHA 2023', '2023-01-01'),
  -- SpO2 (%)
  (gen_random_uuid(), 'spo2', '18-29', 'all', 96, 97, 98, 99, 100, 'NHANES 2017-2020', '2023-01-01'),
  (gen_random_uuid(), 'spo2', '30-44', 'all', 96, 97, 98, 99, 100, 'NHANES 2017-2020', '2023-01-01'),
  (gen_random_uuid(), 'spo2', '45-59', 'all', 95, 97, 98, 99, 100, 'NHANES 2017-2020', '2023-01-01'),
  (gen_random_uuid(), 'spo2', '60-74', 'all', 94, 96, 97, 98, 99,  'NHANES 2017-2020', '2023-01-01'),
  (gen_random_uuid(), 'spo2', '75+',   'all', 93, 95, 97, 98, 99,  'NHANES 2017-2020', '2023-01-01')
ON CONFLICT DO NOTHING;
