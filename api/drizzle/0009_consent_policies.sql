-- Migration 0009: Consent policies versioning table
-- Tracks the current required version for each policy type so the
-- app can detect when users need to re-consent.

CREATE TABLE IF NOT EXISTS "consent_policies" (
  "policy_type"      TEXT        NOT NULL PRIMARY KEY,
  "current_version"  TEXT        NOT NULL,
  "changes_summary"  TEXT,
  "document_url"     TEXT,
  "effective_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at"       TIMESTAMPTZ DEFAULT now()
);

-- Seed initial policy versions.
-- Increment current_version here whenever a material policy change is published.
-- The mobile app calls GET /api/consent/check to detect mismatches.
INSERT INTO "consent_policies" ("policy_type", "current_version", "changes_summary", "effective_at")
VALUES
  ('terms_of_service',  '1.0', 'Initial terms of service',             now()),
  ('privacy_policy',    '1.0', 'Initial privacy policy (HIPAA)',       now()),
  ('genetic_data',      '1.0', 'Initial consent for DNA data processing', now()),
  ('caregiver_sharing', '1.0', 'Initial consent for family data sharing', now()),
  ('research_opt_in',   '1.0', 'Optional research participation consent', now())
ON CONFLICT ("policy_type") DO NOTHING;

-- Add policyType column to user-level consents if not present
-- (patientConsents.version already exists — we add policyType to link to the policy)
ALTER TABLE "patient_consents"
  ADD COLUMN IF NOT EXISTS "policy_type" TEXT DEFAULT 'privacy_policy';

-- Add an index for efficient "does this user have current consent?" lookups
CREATE INDEX IF NOT EXISTS "patient_consents_user_type_version_idx"
  ON "patient_consents" ("user_id", "policy_type", "version");
