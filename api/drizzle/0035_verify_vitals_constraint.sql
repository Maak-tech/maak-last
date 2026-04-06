-- Ensure the vitals uniqueness constraint exists (was created in 0021 but verify)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vitals_user_id_type_recorded_at_source_key'
      AND contype = 'u'
  ) THEN
    ALTER TABLE vitals
      ADD CONSTRAINT vitals_user_id_type_recorded_at_source_key
      UNIQUE (user_id, type, recorded_at, source);
  END IF;
END $$;
