-- Composite index for the most common vitals query pattern:
-- WHERE user_id = ? AND type = ? AND recorded_at BETWEEN ? AND ?
-- CONCURRENTLY avoids locking the table during index build in production.
CREATE INDEX CONCURRENTLY IF NOT EXISTS vitals_user_type_recorded_idx
  ON vitals(user_id, type, recorded_at DESC);

-- Same composite pattern for symptoms queries.
CREATE INDEX CONCURRENTLY IF NOT EXISTS symptoms_user_type_recorded_idx
  ON symptoms(user_id, type, recorded_at DESC);
