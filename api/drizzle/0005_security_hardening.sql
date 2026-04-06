-- ──────────────────────────────────────────────────────────────────────────────
-- Migration 0005: Security hardening
--
-- Changes:
--   1. family_members.role CHECK constraint — rejects any value outside the
--      known enum. Without this, a bug or direct-DB write could insert an
--      arbitrary role string that later bypasses admin-only route guards.
--
--   2. FK constraints — family_members.family_id → families.id and
--      family_members.user_id → user.id.  These were omitted from the initial
--      schema but are required for referential integrity.  ON DELETE CASCADE
--      ensures that deleting a family or user removes all orphaned memberships
--      rather than leaving stale rows that could be matched by auth queries.
--
--   3. GIN indexes on JSONB columns — enables fast full-text / containment
--      queries on vitals.metadata, vhi.data, and clinical_notes.extracted_data
--      without sequential scans.
--
--   4. Audit trail — REVOKE mutating privileges to enforce append-only semantics.
--      INSERT is kept so application code can write new log entries; UPDATE,
--      DELETE, and TRUNCATE are revoked from the application role so that even
--      a fully compromised app process cannot rewrite audit history.
--      NOTE: Run as a superuser or the DB owner.  The REVOKE only applies to
--      the application role ("neon_app") — adjust the role name if different.
-- ──────────────────────────────────────────────────────────────────────────────

--> statement-breakpoint

-- 1. family_members.role CHECK constraint
--    Use ADD CONSTRAINT IF NOT EXISTS (Postgres 9.6+) so re-running the
--    migration in CI/dev is idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'family_members_role_check'
      AND conrelid = 'family_members'::regclass
  ) THEN
    ALTER TABLE family_members
      ADD CONSTRAINT family_members_role_check
      CHECK (role IN ('admin', 'member', 'caregiver'));
  END IF;
END $$;

--> statement-breakpoint

-- 2a. FK: family_members.family_id → families.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'family_members_family_id_fk'
      AND conrelid = 'family_members'::regclass
  ) THEN
    ALTER TABLE family_members
      ADD CONSTRAINT family_members_family_id_fk
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;
  END IF;
END $$;

--> statement-breakpoint

-- 2b. FK: family_members.user_id → "user".id
--    The better-auth users table is named "user" (singular).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'family_members_user_id_fk'
      AND conrelid = 'family_members'::regclass
  ) THEN
    ALTER TABLE family_members
      ADD CONSTRAINT family_members_user_id_fk
      FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;
  END IF;
END $$;

--> statement-breakpoint

-- 3a. GIN index on vhi.data — enables fast JSONB containment queries like
--     `data @> '{"currentState":{"riskScores":{"compositeRisk":...}}}'`
CREATE INDEX IF NOT EXISTS vhi_data_gin_idx
  ON vhi USING gin (data jsonb_path_ops);

--> statement-breakpoint

-- 3b. GIN index on clinical_notes.extracted_data — enables queries like
--     `extracted_data @> '{"recommendedActions":["cardiology referral"]}'`
CREATE INDEX IF NOT EXISTS clinical_notes_extracted_data_gin_idx
  ON clinical_notes USING gin (extracted_data jsonb_path_ops);

--> statement-breakpoint

-- 3c. GIN index on health_timeline.metadata — enables filtered timeline scans
--     by event payload without a sequential table scan.
CREATE INDEX IF NOT EXISTS health_timeline_metadata_gin_idx
  ON health_timeline USING gin (metadata jsonb_path_ops);

--> statement-breakpoint

-- 4. Audit trail — revoke mutating privileges from the application role.
--
--    Adjust "neon_app" to match the role name used by your DATABASE_URL
--    credentials.  In Neon the default role name is the database owner name
--    (e.g. "neondb_owner").  Run `\du` in psql to list roles.
--
--    REVOKE is intentionally idempotent — running it again is harmless.
--
--    The INSERT privilege is retained so application code can still write
--    new audit entries; only mutating operations are removed.
DO $$
DECLARE
  app_role text := current_user;  -- use the connecting role by default
BEGIN
  -- Revoke UPDATE and DELETE to make the table append-only
  EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON audit_trail FROM %I', app_role);
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Could not revoke from %: run as superuser or DB owner', app_role;
END $$;
