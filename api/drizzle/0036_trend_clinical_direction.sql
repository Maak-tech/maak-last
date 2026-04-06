-- Add clinical direction and significance flag to health_trends
ALTER TABLE health_trends
  ADD COLUMN IF NOT EXISTS clinical_direction VARCHAR(20)
    CHECK (clinical_direction IN ('improving', 'worsening', 'stable', 'ambiguous')),
  ADD COLUMN IF NOT EXISTS is_clinically_significant BOOLEAN NOT NULL DEFAULT false;

-- Add formula_version and input_manifest to vhi_snapshots
-- (check actual table name in schema — may be 'vhi_snapshots' or similar)
ALTER TABLE vhi_snapshots
  ADD COLUMN IF NOT EXISTS formula_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS input_manifest JSONB;

CREATE INDEX IF NOT EXISTS idx_vhi_formula_version
  ON vhi_snapshots(formula_version, user_id);
