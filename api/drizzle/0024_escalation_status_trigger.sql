-- Migration: enforce escalation status consistency via DB trigger
-- The `status` column is now fully derived from `resolved_at` and `acknowledged_at`.
-- Application code should only set the timestamp columns; this trigger will
-- automatically keep `status` in sync on every INSERT and UPDATE.

-- Function to derive status from timestamps
CREATE OR REPLACE FUNCTION escalation_status_from_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- If resolved_at is set, status must be 'resolved'
  IF NEW.resolved_at IS NOT NULL THEN
    NEW.status := 'resolved';
  -- If acknowledged_at is set (but not resolved), status must be 'acknowledged'
  ELSIF NEW.acknowledged_at IS NOT NULL THEN
    NEW.status := 'acknowledged';
  -- Otherwise status must be 'active'
  ELSE
    NEW.status := 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to enforce consistency on every INSERT or UPDATE
DROP TRIGGER IF EXISTS enforce_escalation_status ON escalations;
CREATE TRIGGER enforce_escalation_status
  BEFORE INSERT OR UPDATE ON escalations
  FOR EACH ROW EXECUTE FUNCTION escalation_status_from_timestamps();

-- Fix any existing inconsistent rows (run once; trigger handles future rows)
UPDATE escalations
SET status = CASE
  WHEN resolved_at IS NOT NULL THEN 'resolved'
  WHEN acknowledged_at IS NOT NULL THEN 'acknowledged'
  ELSE 'active'
END
WHERE status != CASE
  WHEN resolved_at IS NOT NULL THEN 'resolved'
  WHEN acknowledged_at IS NOT NULL THEN 'acknowledged'
  ELSE 'active'
END;
