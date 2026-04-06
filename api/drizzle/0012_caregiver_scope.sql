-- Migration 0012: Caregiver per-relationship sharing scope
-- sharingScope controls which health data categories a caregiver can read.
-- Default ['all'] grants the same access as before this migration.
-- Any other value is an allowlist: ['vitals','symptoms','medications','moods','labs','allergies','medical_history']

ALTER TABLE "family_members"
  ADD COLUMN IF NOT EXISTS "sharing_scope" JSONB NOT NULL DEFAULT '["all"]';

COMMENT ON COLUMN "family_members"."sharing_scope" IS
  'Allowlist of health data categories this member may access for other family members.
   ["all"] means unrestricted. Otherwise only categories in the array are permitted.
   Valid categories: vitals, symptoms, medications, moods, labs, allergies, medical_history';
