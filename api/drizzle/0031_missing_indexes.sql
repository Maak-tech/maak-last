-- Missing indexes for common query patterns.
-- All use IF NOT EXISTS so this migration is safe to re-run.

-- VHI dirty flag partial index (already added in 0026 but declared here for completeness).
-- Keeps vhiCycle scan O(dirty_count) instead of O(total_users).
CREATE INDEX IF NOT EXISTS users_vhi_dirty_idx ON users(vhi_dirty) WHERE vhi_dirty = true;

-- Nora conversations by user, ordered by most-recently-updated.
-- The conversation list query orders by updated_at DESC; without this index it does a
-- full scan and in-memory sort.
CREATE INDEX IF NOT EXISTS nora_conversations_user_updated_idx
  ON nora_conversations(user_id, updated_at DESC);

-- Health timeline by user + source (event type) + time.
-- Common dashboard query: "all events of type X for user Y in date range".
-- NOTE: column is named `source` in the health_timeline table (not event_type).
CREATE INDEX IF NOT EXISTS health_timeline_user_source_time_idx
  ON health_timeline(user_id, source, occurred_at DESC);

-- Push tokens by user_id.
-- Push send queries look up tokens by userId; without this index every send
-- is a full table scan on push_tokens.
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens(user_id);

-- Medication adherence by user + scheduled_at.
-- Adherence reports and reminder status queries filter/sort by scheduled_at.
-- NOTE: column is named `scheduled_at` in the medication_adherence table.
CREATE INDEX IF NOT EXISTS med_adherence_user_scheduled_idx
  ON medication_adherence(user_id, scheduled_at DESC);

-- Alerts by user, unresolved only.
-- The most common dashboard query: unresolved alerts for a user, newest first.
CREATE INDEX IF NOT EXISTS alerts_user_unresolved_idx
  ON alerts(user_id, created_at DESC) WHERE resolved_at IS NULL;

-- Anomalies by user, unacknowledged only.
-- Caregiver dashboard query: unreviewed anomalies for a user, newest first.
-- NOTE: column is named `is_acknowledged` in the anomalies table.
CREATE INDEX IF NOT EXISTS anomalies_user_unacknowledged_idx
  ON anomalies(user_id, detected_at DESC) WHERE is_acknowledged = false;
