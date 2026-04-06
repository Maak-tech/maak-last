CREATE TABLE push_delivery_receipts (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  token        TEXT NOT NULL,
  message_id   TEXT,           -- Expo ticket ID returned from push send
  title        TEXT,
  sent_at      TIMESTAMPTZ DEFAULT now(),
  status       TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'not_registered')),
  error_code   TEXT,
  checked_at   TIMESTAMPTZ
);
CREATE INDEX push_receipts_user_idx ON push_delivery_receipts(user_id, sent_at DESC);
CREATE INDEX push_receipts_status_idx ON push_delivery_receipts(status) WHERE status = 'sent';
