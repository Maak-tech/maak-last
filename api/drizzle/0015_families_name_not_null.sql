-- Migration 0015: Enforce non-null family name
-- A family without a name breaks caregiver digest push bodies and invite emails.
-- Backfill any existing null names with a default before adding the constraint.

UPDATE families SET name = 'My Family' WHERE name IS NULL;

ALTER TABLE families
  ALTER COLUMN name SET NOT NULL;
