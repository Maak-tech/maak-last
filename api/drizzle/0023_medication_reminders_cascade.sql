-- Drop old FK if exists, re-add with CASCADE
ALTER TABLE medication_reminders
  DROP CONSTRAINT IF EXISTS medication_reminders_medication_id_fkey;

ALTER TABLE medication_reminders
  ADD CONSTRAINT medication_reminders_medication_id_fkey
  FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE;
