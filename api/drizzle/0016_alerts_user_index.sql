-- Migration 0016: Index on alerts (user_id, created_at)
-- The caregiver digest job queries alerts by user_id — without this index
-- it performs a full table scan per family member per day.

CREATE INDEX IF NOT EXISTS "alerts_user_created_idx"
  ON alerts (user_id, created_at DESC);
