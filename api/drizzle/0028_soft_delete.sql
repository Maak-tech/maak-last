-- Add soft-delete support to the three highest-risk PHI tables.
-- deleted_at IS NULL means the row is live; non-NULL means soft-deleted.
-- Partial indexes cover only live rows so existing query plans are unchanged.

-- Medications
ALTER TABLE medications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS medications_not_deleted_idx ON medications(user_id) WHERE deleted_at IS NULL;

-- Allergies
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS allergies_not_deleted_idx ON allergies(user_id) WHERE deleted_at IS NULL;

-- Clinical Notes
ALTER TABLE clinical_notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS clinical_notes_not_deleted_idx ON clinical_notes(user_id) WHERE deleted_at IS NULL;
