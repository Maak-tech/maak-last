-- Migration 0007: Emergency contacts JSONB array
--
-- Replaces the single emergency_contact_name / emergency_contact_phone columns
-- with a JSONB array that supports multiple contacts in priority order.
--
-- Schema:
--   emergencyContacts: [
--     { name: string, phone: string, relation: string, isPrimary: boolean }
--   ]
--
-- The old columns are preserved as NOT NULL DEFAULT NULL so existing rows
-- are not broken.  A backfill populates emergencyContacts from the old columns
-- for any user that had data in them.  After a full deploy the old columns can
-- be dropped in a follow-up migration (0008).

-- 1. Add the new column (nullable — users with no contacts yet have NULL)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "emergency_contacts" JSONB DEFAULT '[]'::jsonb;

-- 2. Backfill: migrate existing single-contact rows into the array
UPDATE "users"
SET "emergency_contacts" = jsonb_build_array(
  jsonb_build_object(
    'name',      COALESCE("emergency_contact_name", ''),
    'phone',     COALESCE("emergency_contact_phone", ''),
    'relation',  'emergency contact',
    'isPrimary', true
  )
)
WHERE "emergency_contact_name" IS NOT NULL
  AND "emergency_contact_name" != ''
  AND "emergency_contacts" = '[]'::jsonb;

-- 3. GIN index for fast containment queries
--    (e.g. find users whose emergency contacts include a given phone number)
CREATE INDEX IF NOT EXISTS "users_emergency_contacts_gin_idx"
  ON "users" USING GIN ("emergency_contacts" jsonb_path_ops);
