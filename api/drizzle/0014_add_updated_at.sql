-- Migration 0014: Add updated_at to immutable-by-design health tables
-- These tables are append-only in normal operation (users don't edit vitals).
-- updated_at is added for audit completeness and HIPAA compliance.
-- DEFAULT now() ensures existing rows get the migration timestamp.

ALTER TABLE vitals
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE symptoms
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE moods
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE health_timeline
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
