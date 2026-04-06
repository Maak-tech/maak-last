-- Migration 0030: Add missing FK constraints
--
-- These constraints were intentionally deferred until after the schema had
-- stabilised.  All columns already exist; we are only adding referential
-- integrity enforcement.  Every FK uses a safe ON DELETE action (SET NULL or
-- CASCADE) so existing application code never needs to change write order.
--
-- Safe to re-run: each ADD CONSTRAINT will fail if the constraint already
-- exists, so wrap in a DO block if you need idempotency.

-- ── users.family_id → families.id ────────────────────────────────────────────
ALTER TABLE users
  ADD CONSTRAINT users_family_id_fkey
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL;

-- ── users.guardian_id → users.id (self-referential) ──────────────────────────
ALTER TABLE users
  ADD CONSTRAINT users_guardian_id_fkey
  FOREIGN KEY (guardian_id) REFERENCES users(id) ON DELETE SET NULL;

-- ── vitals.user_id → users.id ────────────────────────────────────────────────
ALTER TABLE vitals
  ADD CONSTRAINT vitals_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ── symptoms.user_id → users.id ──────────────────────────────────────────────
ALTER TABLE symptoms
  ADD CONSTRAINT symptoms_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ── moods.user_id → users.id ─────────────────────────────────────────────────
ALTER TABLE moods
  ADD CONSTRAINT moods_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ── alerts.user_id → users.id ────────────────────────────────────────────────
ALTER TABLE alerts
  ADD CONSTRAINT alerts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ── escalations.user_id → users.id ───────────────────────────────────────────
ALTER TABLE escalations
  ADD CONSTRAINT escalations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ── family_members.user_id → users.id ────────────────────────────────────────
ALTER TABLE family_members
  ADD CONSTRAINT family_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ── family_members.family_id → families.id ───────────────────────────────────
ALTER TABLE family_members
  ADD CONSTRAINT family_members_family_id_fkey
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;

-- ── escalations.assigned_to → users.id (conditional) ────────────────────────
-- The schema does not currently define an assigned_to column on escalations.
-- This guard ensures the migration stays safe if the column is added later
-- without a corresponding migration update.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'escalations' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE escalations
      ADD CONSTRAINT escalations_assigned_to_fkey
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── family_invitations.invited_by → users.id ─────────────────────────────────
-- Column in schema is `invitedBy` (DB column: invited_by).
-- Note: the Drizzle schema field is named invitedBy, not invitedByUserId.
ALTER TABLE family_invitations
  ADD CONSTRAINT family_invitations_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;

-- ── health_timeline source column CHECK constraint ────────────────────────────
-- The healthTimeline table uses `source` (not source_type) as the event-type
-- discriminator.  A CHECK constraint prevents unknown event types from being
-- inserted and makes the allowed domain explicit at the DB level.
ALTER TABLE health_timeline
  ADD CONSTRAINT health_timeline_source_check
  CHECK (source IN (
    'vital',
    'symptom',
    'medication',
    'lab',
    'mood',
    'fall_event',
    'anomaly',
    'escalation',
    'goal_achieved',
    'caregiver_note'
  ));
