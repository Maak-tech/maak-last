-- Migration 0010: Minor user guardian support
-- guardianId links a minor user to their legal guardian's users row.
-- When a family admin requests data for a minor, the system checks whether
-- the admin IS the guardian, or the guardian has explicitly consented to sharing.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "guardian_id" TEXT;

-- Index for looking up all minors associated with a guardian
CREATE INDEX IF NOT EXISTS "users_guardian_idx" ON "users" ("guardian_id");

-- Comment explaining the field
COMMENT ON COLUMN "users"."guardian_id" IS
  'References the legal guardian user ID for users under 18. NULL for adults.
   When a family admin reads a minor''s health data, the system verifies the
   admin is the guardian or that the guardian has consented to sharing.';
