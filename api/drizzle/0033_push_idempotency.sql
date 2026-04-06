-- Add idempotency key to push delivery receipts.
-- When set, the unique index prevents duplicate sends for the same logical notification.
ALTER TABLE push_delivery_receipts ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS push_receipts_idempotency_idx
  ON push_delivery_receipts(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
