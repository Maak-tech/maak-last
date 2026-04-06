-- Deduplication: same user, same vital type, same timestamp from same source = duplicate
-- First remove any existing duplicates (keep lowest id)
DELETE FROM vitals
WHERE id NOT IN (
  SELECT MIN(id)
  FROM vitals
  GROUP BY user_id, type, recorded_at, source
);

ALTER TABLE vitals
  ADD CONSTRAINT vitals_user_type_time_source_key
  UNIQUE (user_id, type, recorded_at, source);
